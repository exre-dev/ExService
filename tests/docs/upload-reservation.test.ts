import { connect, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '@server/src/app'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

/**
 * S4-2：预留上传"不读取正文"的真实 TCP 证明。
 *
 * 设计 §8 要求本期测试证明 501 在读取请求体**之前**发生并关闭/终结本请求：不等待用户
 * 传完大文件，不泄漏 slot 或悬挂连接。`app.inject()` 走内存通道、不经过 Node 的 HTTP
 * 解析器，因此这里用最小原始 HTTP/1.1 客户端发送三种"故意不传完"的帧：
 *
 * - 声明远超预算的 `Content-Length`，一个正文字节都不发；
 * - 声明 `Content-Length`，只发出其中一小部分就停下；
 * - `Transfer-Encoding: chunked`，发若干块但永不发终止块。
 *
 * 三种写法下服务端都必须在不拿到完整正文的情况下先给出响应（认证后 501、匿名 401），
 * 带 no-store 与 `Connection: close`，随后终结连接且不留下任何业务写入。
 *
 * 关于分块大小：客户端在响应已到达之后继续灌入约 1 MiB 以上字节时，该响应会在 RST 中
 * 丢失，服务端看起来像"挂住"。这是 `tests/docs/socket-limits.test.ts` 已记录的客户端观测
 * 现象，不是服务端行为；因此本文件把每次写出的正文控制在 64 KiB 以内，并在拿到响应后
 * 立即停止发送。判定"服务端没等正文"的依据是**声明/未终止的长度与已送出字节的差额**，
 * 不是客户端能否在持续灌字节时读到响应。
 */

const fixtures: TestAuth[] = []
const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const DOCS_TABLES = [
  'docs_spaces',
  'docs_documents',
  'docs_templates',
  'docs_attachments',
  'docs_comments',
] as const

/** 只声明不发送：远超任何 Docs 预算，服务端若等待正文就不可能在截止时间前响应。 */
const DECLARED_LENGTH = 256 * 1024 * 1024
/**
 * 部分发送场景送出的字节：一次写完即停。
 *
 * 必须远小于服务端的首字节延迟，否则服务端的 `Connection: close` 会在客户端仍在灌字节时
 * 把连接重置掉，已到达的响应随 RST 一起丢失。4 KiB 在匿名（约 1–4 ms）与已认证（约
 * 5–20 ms，含一次会话查询）两条路径上都先于响应写完，因此两种认证列都稳定可观测。
 */
const PARTIAL_SENT_BYTES = 4 * 1024
/** chunked 场景送出的字节；终止块永不发送。 */
const CHUNKED_SENT_BYTES = 4 * 1024
const CHUNK_SIZE = 4 * 1024
const RESPONSE_DEADLINE_MS = 15_000
const CLOSE_DEADLINE_MS = 3_000
/** 服务端必须在正文传完前很久就响应；这里给一个远小于截止时间的宽松上界。 */
const PROMPT_RESPONSE_MS = 5_000

interface UploadProbeResult {
  status: number
  headers: Record<string, string>
  body: Buffer
  /** 从写出请求头到收到第一个响应字节的耗时；-1 表示截止时间内没有任何响应。 */
  firstByteMs: number
  /** 响应首字节到达时已经写出的正文字节数；-1 同上。 */
  sentBeforeResponse: number
  /** 客户端是否把请求的正文发完了（chunked 场景即是否发出终止块）。 */
  bodyCompleted: boolean
  /** 是否在截止时间内拿到完整响应。 */
  completed: boolean
  /** 服务端是否在响应之后终结了连接。 */
  closedByServer: boolean
}

interface UploadProbeOptions {
  method?: 'GET' | 'POST'
  path: string
  headers: Record<string, string>
  /** 声明的 `Content-Length`；`chunked` 时忽略。 */
  declaredLength: number
  /** 计划写出的正文字节数。 */
  plannedBytes: number
  chunkSize: number
  /** 用 `Transfer-Encoding: chunked` 发送，不声明 `Content-Length`，且不发终止块。 */
  chunked?: boolean
  deadlineMs: number
  closeDeadlineMs: number
}

/** 最小原始 HTTP/1.1 客户端：只解析第一个响应，并记录响应到达时已送出的正文字节。 */
function probe(port: number, options: UploadProbeOptions): Promise<UploadProbeResult> {
  return new Promise((resolve) => {
    const started = Date.now()
    const filler = Buffer.alloc(options.chunkSize, 0x61)
    const socket: Socket = connect({ host: '127.0.0.1', port })
    let received = Buffer.alloc(0)
    let sent = 0
    let parsed: {
      status: number
      headers: Record<string, string>
      firstByteMs: number
      sentBeforeResponse: number
    } | null = null
    let body = Buffer.alloc(0)
    let responseComplete = false
    let closed = false
    let settled = false
    let deadline: ReturnType<typeof setTimeout> | undefined
    let closeDeadline: ReturnType<typeof setTimeout> | undefined

    const settle = (completed: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      clearTimeout(closeDeadline)
      socket.destroy()
      resolve({
        status: parsed?.status ?? 0,
        headers: parsed?.headers ?? {},
        body,
        firstByteMs: parsed?.firstByteMs ?? -1,
        sentBeforeResponse: parsed?.sentBeforeResponse ?? -1,
        // chunked 场景永远不发终止块，因此正文恒为未完成；CL 场景看是否达到声明长度。
        bodyCompleted: options.chunked === true ? false : sent >= options.declaredLength,
        completed,
        closedByServer: closed,
      })
    }

    const inspect = (): void => {
      const end = received.indexOf('\r\n\r\n')
      if (end === -1) return
      if (parsed === null) {
        const lines = received.subarray(0, end).toString('latin1').split('\r\n')
        const headers: Record<string, string> = {}
        for (const line of lines.slice(1)) {
          const separator = line.indexOf(':')
          if (separator > 0)
            headers[line.slice(0, separator).trim().toLowerCase()] = line
              .slice(separator + 1)
              .trim()
        }
        parsed = {
          status: Number(lines[0]!.split(' ')[1]),
          headers,
          firstByteMs: Date.now() - started,
          sentBeforeResponse: sent,
        }
      }
      if (responseComplete) return
      const declared = Number(parsed.headers['content-length'])
      const start = end + 4
      if (Number.isFinite(declared) && received.byteLength >= start + declared) {
        body = received.subarray(start, start + declared)
        responseComplete = true
        // 响应已完整；给服务端一点时间按 `Connection: close` 终结连接。
        closeDeadline = setTimeout(() => settle(true), options.closeDeadlineMs)
      }
    }

    const write = (bytes: Buffer): Promise<void> =>
      new Promise((resolveWrite) => {
        socket.write(bytes, () => resolveWrite())
      })

    socket.on('error', () => {
      if (responseComplete) {
        closed = true
        settle(true)
      } else settle(false)
    })
    socket.on('close', () => {
      closed = true
      settle(responseComplete)
    })
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk])
      inspect()
    })
    socket.on('connect', async () => {
      const head = [
        `${options.method ?? 'POST'} ${options.path} HTTP/1.1`,
        `Host: 127.0.0.1:${port}`,
        ...Object.entries(options.headers).map(([key, value]) => `${key}: ${value}`),
      ]
      head.push(
        options.chunked === true
          ? 'Transfer-Encoding: chunked'
          : `Content-Length: ${options.declaredLength}`,
      )
      socket.write(`${head.join('\r\n')}\r\n\r\n`)
      try {
        // 响应一到达就停止发送，避免把已到达的响应卷进 RST。
        while (sent < options.plannedBytes && parsed === null) {
          const size = Math.min(options.chunkSize, options.plannedBytes - sent)
          if (options.chunked === true) {
            await write(Buffer.from(`${size.toString(16)}\r\n`))
            await write(filler.subarray(0, size))
            await write(Buffer.from('\r\n'))
          } else {
            await write(filler.subarray(0, size))
          }
          sent += size
          await new Promise((resolveYield) => setImmediate(resolveYield))
        }
      } catch {
        // 服务端抢先关闭连接属于预期路径，结果由 settle 处理。
      }
    })
    deadline = setTimeout(() => settle(false), options.deadlineMs)
  })
}

const MULTIPART_HEADERS = { 'content-type': 'multipart/form-data; boundary=----exre-docs-probe' }

async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const app = createApp({ ...fixture })
  apps.push(app)
  await app.ready()
  await fixture.seedUser({
    email: 'docs-upload@example.com',
    nickname: 'Docs',
    password: 'valid password',
  })
  const { token } = await fixture.authServices.login({
    email: 'docs-upload@example.com',
    password: 'valid password',
  })
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (address === null || typeof address === 'string')
    throw new Error('Docs upload test did not bind a port')
  return { app, fixture, authorization: `Bearer ${token}`, port: address.port }
}

/** 真实存在的文档：让"无业务写入"对比的是非空基线，而不是空库。 */
async function newDocument(app: FastifyInstance, authorization: string): Promise<string> {
  const space = await app.inject({
    method: 'POST',
    url: '/api/docs/spaces',
    headers: { authorization },
    payload: { name: 'Upload', description: '' },
  })
  expect(space.statusCode, space.body).toBe(201)
  const document = await app.inject({
    method: 'POST',
    url: `/api/docs/spaces/${space.json<{ id: string }>().id}/documents`,
    headers: { authorization },
    payload: {
      expectedTreeVersion: 1,
      parentId: null,
      beforeDocumentId: null,
      title: 'Host',
      contentSchemaVersion: 1,
      content: { type: 'doc', content: [] },
    },
  })
  expect(document.statusCode, document.body).toBe(201)
  return document.json<{ document: { id: string } }>().document.id
}

async function tableCounts(fixture: TestAuth): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const table of DOCS_TABLES) {
    counts[table] = Number(
      (await fixture.db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0]!.n,
    )
  }
  return counts
}

/** 预留上传的统一响应形态；`Connection: close` 是这一类独有的终结语义。 */
function expectReservationReply(result: UploadProbeResult, status: 401 | 501): void {
  expect(result.completed, `completed=${result.completed} status=${result.status}`).toBe(true)
  expect(result.status, result.body.toString('utf8')).toBe(status)
  expect(result.headers['cache-control']).toBe('no-store')
  expect(result.headers.connection).toBe('close')
  expect(result.headers['x-request-id']).toBeTruthy()
  expect(result.firstByteMs).toBeGreaterThanOrEqual(0)
  expect(result.firstByteMs).toBeLessThan(PROMPT_RESPONSE_MS)
  expect(result.closedByServer).toBe(true)
}

describe('Docs 预留上传的真实 TCP 提前响应', () => {
  it('answers a headers-only upload with 501 before a single body byte arrives', async () => {
    const { app, authorization, port } = await setup()
    const documentId = await newDocument(app, authorization)

    const result = await probe(port, {
      path: `/api/docs/documents/${documentId}/attachments`,
      headers: { ...MULTIPART_HEADERS, authorization },
      declaredLength: DECLARED_LENGTH,
      plannedBytes: 0,
      chunkSize: CHUNK_SIZE,
      deadlineMs: RESPONSE_DEADLINE_MS,
      closeDeadlineMs: CLOSE_DEADLINE_MS,
    })

    expectReservationReply(result, 501)
    expect(JSON.parse(result.body.toString('utf8')).error.code).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
    // 一个正文字节都没送出就拿到响应，且声明的 256 MiB 从未真正上传。
    expect(result.sentBeforeResponse).toBe(0)
    expect(result.bodyCompleted).toBe(false)
  })

  it('answers a partially sent upload with 501 without waiting for the rest of the body', async () => {
    const { app, authorization, port } = await setup()
    const documentId = await newDocument(app, authorization)

    const result = await probe(port, {
      path: `/api/docs/documents/${documentId}/attachments`,
      headers: { ...MULTIPART_HEADERS, authorization },
      declaredLength: DECLARED_LENGTH,
      plannedBytes: PARTIAL_SENT_BYTES,
      chunkSize: CHUNK_SIZE,
      deadlineMs: RESPONSE_DEADLINE_MS,
      closeDeadlineMs: CLOSE_DEADLINE_MS,
    })

    expectReservationReply(result, 501)
    expect(JSON.parse(result.body.toString('utf8')).error.code).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
    // 关键判别式是"声明长度远未满足时服务端就响应了"，而不是客户端刚好写满 4 KiB：
    // 客户端写速度不是服务端的时序保证，因此上界用不超过计划字节，下界用远小于声明长度。
    expect(result.sentBeforeResponse).toBeLessThanOrEqual(PARTIAL_SENT_BYTES)
    expect(result.sentBeforeResponse).toBeLessThan(DECLARED_LENGTH)
    expect(result.bodyCompleted).toBe(false)
  })

  it('answers an unterminated chunked upload with 501 without waiting for the terminating chunk', async () => {
    const { app, authorization, port } = await setup()
    const documentId = await newDocument(app, authorization)

    const result = await probe(port, {
      path: `/api/docs/documents/${documentId}/attachments`,
      headers: { ...MULTIPART_HEADERS, authorization },
      declaredLength: 0,
      plannedBytes: CHUNKED_SENT_BYTES,
      chunkSize: CHUNK_SIZE,
      chunked: true,
      deadlineMs: RESPONSE_DEADLINE_MS,
      closeDeadlineMs: CLOSE_DEADLINE_MS,
    })

    expectReservationReply(result, 501)
    expect(JSON.parse(result.body.toString('utf8')).error.code).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
    // chunked 场景没有 Content-Length 预检可依赖：终止块从未发出，响应仍然先到。
    expect(result.sentBeforeResponse).toBe(CHUNKED_SENT_BYTES)
    expect(result.bodyCompleted).toBe(false)
  })

  it('authenticates before the reservation and still never waits for the body', async () => {
    const { app, authorization, port } = await setup()
    const documentId = await newDocument(app, authorization)

    const result = await probe(port, {
      path: `/api/docs/documents/${documentId}/attachments`,
      headers: { ...MULTIPART_HEADERS },
      declaredLength: DECLARED_LENGTH,
      plannedBytes: 0,
      chunkSize: CHUNK_SIZE,
      deadlineMs: RESPONSE_DEADLINE_MS,
      closeDeadlineMs: CLOSE_DEADLINE_MS,
    })

    // 认证先于 501：匿名请求拿到的是 401，而且同样不等待正文。
    expectReservationReply(result, 401)
    expect(result.sentBeforeResponse).toBe(0)
    expect(result.bodyCompleted).toBe(false)
  })

  it('leaves no business write and keeps serving after the abandoned uploads', async () => {
    const { app, fixture, authorization, port } = await setup()
    const documentId = await newDocument(app, authorization)
    const before = await tableCounts(fixture)
    expect(before.docs_spaces).toBe(1)
    expect(before.docs_documents).toBe(1)

    for (const headers of [
      { ...MULTIPART_HEADERS, authorization },
      { ...MULTIPART_HEADERS, 'content-type': 'multipart/form-data; boundary=----exre-docs-probe' },
    ]) {
      const result = await probe(port, {
        path: `/api/docs/documents/${documentId}/attachments`,
        headers,
        declaredLength: DECLARED_LENGTH,
        plannedBytes: PARTIAL_SENT_BYTES,
        chunkSize: CHUNK_SIZE,
        deadlineMs: RESPONSE_DEADLINE_MS,
        closeDeadlineMs: CLOSE_DEADLINE_MS,
      })
      expect(result.completed, `headers=${Object.keys(headers).join(',')}`).toBe(true)
      expect([401, 501]).toContain(result.status)
      expect(result.closedByServer).toBe(true)
      expect(result.bodyCompleted).toBe(false)
    }

    // 被放弃的连接没有产生任何业务写入。
    expect(await tableCounts(fixture)).toEqual(before)

    // 也没有占住服务端的处理能力：新连接上的普通读照常成功。
    const healthy = await probe(port, {
      method: 'GET',
      path: '/api/docs/spaces',
      headers: {},
      declaredLength: 0,
      plannedBytes: 0,
      chunkSize: CHUNK_SIZE,
      deadlineMs: 5_000,
      closeDeadlineMs: 250,
    })
    expect(healthy.status).toBe(200)
    expect(healthy.headers['cache-control']).toBe('no-store')
    // 普通读不带 `Connection: close`：终结连接是预留上传独有的行为，不是全局退化。
    expect(healthy.headers.connection).not.toBe('close')
  })
})
