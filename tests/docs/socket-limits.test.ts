import { connect, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '@server/src/app'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { readContract } from '@server/src/contract/document'

/**
 * Docs wire 预算的真实 socket 验收。
 *
 * `app.inject()` 走内存通道，不经过 Node 的 HTTP 解析器，因此 `Content-Length` 预检、
 * chunked 累加与"未声明长度"都只能用真实 TCP 连接证明。数据库由隔离 PostgreSQL 提供。
 *
 * 传输层与内容层都会返回 413 `DOCS_LIMIT_EXCEEDED`，两者由 Fastify 的行为区分：
 * 解析器在 `onDone` 的错误分支上设置 `connection: close` 且不再读完正文，因此
 * **传输层拒绝 = 413 + `connection: close`**；正文被完整消费后再被内容预算拒绝时
 * 连接保持 `keep-alive`。本文件用这条差异断言"恰好等于预算的正文是否被传输层放行"。
 */

const fixtures: TestAuth[] = []
const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const JSON_HEADERS = { 'content-type': 'application/json' }

interface DocsContract {
  paths: Record<
    string,
    Record<string, { 'x-fastify-config'?: { docs?: { kind?: string; wireBytes?: number } } }>
  >
}

/** `x-fastify-config.docs` 中声明的 wire 预算；不从本文件复制常量。 */
function declaredWire(kind: 'content' | 'command'): { budget: number; count: number } {
  const contract = readContract() as unknown as DocsContract
  const budgets: number[] = []
  for (const item of Object.values(contract.paths)) {
    for (const operation of Object.values(item)) {
      const docs = operation?.['x-fastify-config']?.docs
      if (docs?.kind === kind && typeof docs.wireBytes === 'number') budgets.push(docs.wireBytes)
    }
  }
  const unique = [...new Set(budgets)]
  if (unique.length !== 1)
    throw new Error(`Docs ${kind} wire budget is not uniform: ${unique.join(', ')}`)
  return { budget: unique[0]!, count: budgets.length }
}

const DOCUMENT_PREFIX =
  '{"expectedTreeVersion":1,"parentId":null,"beforeDocumentId":null,"title":"T","contentSchemaVersion":1,' +
  '"content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"'
const DOCUMENT_SUFFIX = '"}]}]}}'
const DOCUMENT_FRAMING = Buffer.byteLength(DOCUMENT_PREFIX) + Buffer.byteLength(DOCUMENT_SUFFIX)

const SPACE_PREFIX = '{"name":"'
const SPACE_SUFFIX = '","description":""}'
const SPACE_FRAMING = Buffer.byteLength(SPACE_PREFIX) + Buffer.byteLength(SPACE_SUFFIX)

/** 构造字节数完全可控的正文；`size` 是 UTF-8 字节数，不是字符数。 */
function padded(prefix: string, suffix: string, framing: number, size: number): Buffer {
  const fill = size - framing
  if (fill < 1) throw new Error(`Body budget ${size} leaves no room for padding`)
  return Buffer.from(prefix + 'x'.repeat(fill) + suffix, 'utf8')
}

interface RawResponse {
  /** 服务端在返回任何状态行之前就关闭连接时为 0。 */
  status: number
  headers: Record<string, string>
  body: Buffer
  /** 响应是否完整读完；传输层拒绝时服务端会先关闭连接。 */
  complete: boolean
}

interface RawRequestOptions {
  path: string
  headers: Record<string, string>
  body?: Buffer
  /** 用 `Transfer-Encoding: chunked` 发送，不声明 `Content-Length`。 */
  chunked?: boolean
  chunkSize?: number
  /** 既不声明 `Content-Length` 也不声明 `Transfer-Encoding`；服务端无法得知正文长度。 */
  omitLength?: boolean
  /**
   * 未使用 chunked 时按该大小分块写出正文。
   *
   * 服务端按声明长度在读完正文之前就拒绝并关闭连接；一次性灌入 9 MiB 会让那个响应
   * 在 RST 中丢失。分块写法在每块之间让出事件循环，响应一到达就停止发送。
   */
  writeChunkSize?: number
  /**
   * 声明了 `Content-Length` 时，写完请求头后等待服务端先行拒绝的最长时间（毫秒）。
   *
   * Fastify 在读完正文之前就按声明长度拒绝，因此那个 413 会在我们写出第一个字节前
   * 就已经在路上了。这里是**等待该信号**而不是固定延时：收到任何响应字节就立刻继续，
   * 只有服务端明确没有先行拒绝时才会耗尽这个宽限期。慢 CI 只会让被接纳的请求多等一会，
   * 不会让"先拒绝"变成"先灌满"，因此没有固定延时那种抖动风险。
   */
  headGraceMs?: number
}

/** 最小原始 HTTP/1.1 客户端，只解析第一个响应。 */
function rawRequest(port: number, options: RawRequestOptions): Promise<RawResponse> {
  return new Promise((resolve) => {
    let settled = false
    const socket: Socket = connect({ host: '127.0.0.1', port })
    const head = [`POST ${options.path} HTTP/1.1`, `Host: 127.0.0.1:${port}`]
    for (const [key, value] of Object.entries(options.headers)) head.push(`${key}: ${value}`)
    if (options.chunked) head.push('Transfer-Encoding: chunked')
    else if (options.omitLength) head.push('Connection: close')
    else head.push(`Content-Length: ${options.body?.byteLength ?? 0}`)

    let received = Buffer.alloc(0)
    const settle = (complete: boolean) => {
      if (settled) return
      const end = received.indexOf('\r\n\r\n')
      const lines = received
        .subarray(0, end === -1 ? received.byteLength : end)
        .toString('latin1')
        .split('\r\n')
      const headers: Record<string, string> = {}
      for (const line of lines.slice(1)) {
        const separator = line.indexOf(':')
        if (separator > 0)
          headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim()
      }
      const status = Number(lines[0]!.split(' ')[1])
      settled = true
      resolve(
        Number.isInteger(status)
          ? {
              status,
              headers,
              body: end === -1 ? Buffer.alloc(0) : received.subarray(end + 4),
              complete,
            }
          : { status: 0, headers, body: Buffer.alloc(0), complete: false },
      )
    }
    socket.on('error', () => settle(false))
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk])
      const end = received.indexOf('\r\n\r\n')
      if (end === -1) return
      const declared = Number(
        /^content-length:\s*(\d+)$/im.exec(received.subarray(0, end).toString('latin1'))?.[1],
      )
      if (Number.isFinite(declared) && received.byteLength >= end + 4 + declared) {
        settle(true)
        socket.destroy()
      }
    })
    socket.on('close', () => settle(false))
    /** 分块写出并让出事件循环；响应一到达（`settled`）就停止，不再继续灌字节。 */
    const writeBody = async () => {
      const body = options.body ?? Buffer.alloc(0)
      if (options.chunked) {
        const size = options.chunkSize ?? 512 * 1024
        for (let offset = 0; offset < body.byteLength; offset += size) {
          if (settled) return
          const slice = body.subarray(offset, offset + size)
          socket.write(`${slice.byteLength.toString(16)}\r\n`)
          socket.write(slice)
          socket.write('\r\n')
          await new Promise((resolve) => setImmediate(resolve))
        }
        if (settled) return
        socket.write('0\r\n\r\n')
        return
      }
      const size = options.writeChunkSize ?? 256 * 1024
      for (let offset = 0; offset < body.byteLength; offset += size) {
        if (settled) return
        await new Promise<void>((resolve) => {
          const done = (): void => resolve()
          socket.once('error', done)
          socket.write(body.subarray(offset, offset + size), () => {
            socket.removeListener('error', done)
            done()
          })
        })
      }
      if (settled) return
      if (options.omitLength) socket.end()
    }
    /**
     * 只在声明了 `Content-Length` 时等待：chunked 与未声明长度的两种写法
     * 服务端都无从在读完正文前拒绝，等下去纯属浪费。
     */
    const waitForHeadRejection = (): Promise<void> => {
      if (options.chunked === true || options.omitLength === true) return Promise.resolve()
      return new Promise((resolve) => {
        const finish = (): void => {
          clearTimeout(timer)
          socket.removeListener('data', finish)
          socket.removeListener('close', finish)
          socket.removeListener('error', finish)
          resolve()
        }
        socket.on('data', finish)
        socket.once('close', finish)
        socket.once('error', finish)
        const timer = setTimeout(finish, options.headGraceMs ?? 2_000)
      })
    }
    socket.on('connect', async () => {
      socket.write(`${head.join('\r\n')}\r\n\r\n`)
      await waitForHeadRejection()
      await writeBody()
    })
  })
}

/** 413 的两种来源：正文被消费后由内容预算拒绝，或正文根本没被读完就由解析器拒绝。 */
function rejectionLayer(response: RawResponse): 'transport' | 'content' {
  expect(response.status).toBe(413)
  return response.headers.connection === 'close' ? 'transport' : 'content'
}

async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const app = createApp({ ...fixture })
  apps.push(app)
  await app.ready()
  await fixture.seedUser({
    email: 'docs-socket@example.com',
    nickname: 'Docs',
    password: 'valid password',
  })
  const { token } = await fixture.authServices.login({
    email: 'docs-socket@example.com',
    password: 'valid password',
  })
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (address === null || typeof address === 'string')
    throw new Error('Docs socket test did not bind a port')
  return { app, authorization: `Bearer ${token}`, port: address.port }
}

/** 每个用例使用独立空间，`expectedTreeVersion` 才能固定为 1。 */
async function newSpace(app: FastifyInstance, authorization: string): Promise<string> {
  const space = await app.inject({
    method: 'POST',
    url: '/api/docs/spaces',
    headers: { authorization },
    payload: { name: 'Socket', description: '' },
  })
  expect(space.statusCode, space.body).toBe(201)
  return space.json<{ id: string }>().id
}

async function documentCount(app: FastifyInstance, spaceId: string): Promise<number> {
  const tree = await app.inject({ method: 'GET', url: `/api/docs/spaces/${spaceId}/tree` })
  expect(tree.statusCode).toBe(200)
  return tree.json<{ items: unknown[] }>().items.length
}

describe('Docs 9 MiB 正文 wire 预算（真实 socket）', () => {
  it('admits a Content-Length body of exactly the budget and rejects one byte more at the transport', async () => {
    const { app, authorization, port } = await setup()
    const { budget } = declaredWire('content')
    expect(budget).toBe(9_437_184)

    const under = await rawRequest(port, {
      path: `/api/docs/spaces/${await newSpace(app, authorization)}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, 8_388_608),
    })
    // 8 MiB 正文（规范化后仍在 8 MiB 内）完整入库，证明预算之下的路径真实可用。
    expect(under.status, under.body.toString('utf8')).toBe(201)

    const exact = await rawRequest(port, {
      path: `/api/docs/spaces/${await newSpace(app, authorization)}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, budget),
    })
    // 恰好等于预算：传输层放行，正文被完整消费后才由内容预算拒绝。
    expect(rejectionLayer(exact)).toBe('content')

    const over = await rawRequest(port, {
      path: `/api/docs/spaces/${await newSpace(app, authorization)}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, budget + 1),
    })
    // 超过预算一字节：解析器不再读完正文就拒绝。
    expect(rejectionLayer(over)).toBe('transport')
  })

  it('enforces the same budget for chunked bodies that declare no Content-Length', async () => {
    const { app, authorization, port } = await setup()
    const { budget } = declaredWire('content')

    const usable = await rawRequest(port, {
      path: `/api/docs/spaces/${await newSpace(app, authorization)}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, 65_536),
      chunked: true,
      chunkSize: 8192,
    })
    expect(usable.status, usable.body.toString('utf8')).toBe(201)

    const exact = await rawRequest(port, {
      path: `/api/docs/spaces/${await newSpace(app, authorization)}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, budget),
      chunked: true,
      chunkSize: 512 * 1024,
    })
    expect(rejectionLayer(exact)).toBe('content')

    const over = await rawRequest(port, {
      path: `/api/docs/spaces/${await newSpace(app, authorization)}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, budget + 1),
      chunked: true,
      chunkSize: 512 * 1024,
    })
    // 没有 Content-Length 预检可依赖，累加计数必须独立拦下超限正文。
    expect(rejectionLayer(over)).toBe('transport')
  })

  it('never reads or persists an oversized body whose length is not declared at all', async () => {
    const { app, authorization, port } = await setup()
    const { budget } = declaredWire('content')

    const smallSpace = await newSpace(app, authorization)
    const small = await rawRequest(port, {
      path: `/api/docs/spaces/${smallSpace}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, 4_096),
      omitLength: true,
    })
    // 长度未声明时正文根本不被读取：连一个合法的小文档都不会被当成请求体。
    expect(small.status, small.body.toString('utf8')).toBe(400)
    expect(await documentCount(app, smallSpace)).toBe(0)

    const oversizedSpace = await newSpace(app, authorization)
    const oversized = await rawRequest(port, {
      path: `/api/docs/spaces/${oversizedSpace}/documents`,
      headers: { ...JSON_HEADERS, authorization },
      body: padded(DOCUMENT_PREFIX, DOCUMENT_SUFFIX, DOCUMENT_FRAMING, budget + 1),
      omitLength: true,
    })
    // 服务端不等待、也不缓冲未声明长度的超限字节，连接被终止且没有任何行被写入。
    expect(oversized.status === 0 || oversized.status >= 400).toBe(true)
    expect(oversized.complete && oversized.status >= 200 && oversized.status < 300).toBe(false)
    // 用例名承诺"never reads or persists"：与 4 KiB 对照用例一样落到行数断言，
    // 而不是只检查响应形态——被丢弃的连接也不能留下任何文档行。
    expect(await documentCount(app, oversizedSpace)).toBe(0)
  })

  it('keeps the 64 KiB command budget independent of the 9 MiB content budget', async () => {
    const { app, authorization, port } = await setup()
    const { budget } = declaredWire('command')
    expect(budget).toBe(65_536)

    const exact = await rawRequest(port, {
      path: '/api/docs/spaces',
      headers: { ...JSON_HEADERS, authorization },
      body: padded(SPACE_PREFIX, SPACE_SUFFIX, SPACE_FRAMING, budget),
    })
    // 恰好等于命令预算：解析器放行，随后由 AJV 拒绝超长的 name。
    expect(exact.status).not.toBe(413)
    expect(exact.status).toBe(400)

    const over = await rawRequest(port, {
      path: '/api/docs/spaces',
      headers: { ...JSON_HEADERS, authorization },
      body: padded(SPACE_PREFIX, SPACE_SUFFIX, SPACE_FRAMING, budget + 1),
    })
    expect(rejectionLayer(over)).toBe('transport')

    const spaces = await app.inject({ method: 'GET', url: '/api/docs/spaces' })
    expect(spaces.json<{ items: unknown[] }>().items).toHaveLength(0)
  })
})
