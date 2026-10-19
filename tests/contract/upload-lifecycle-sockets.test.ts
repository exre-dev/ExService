import { request as httpRequest, type ClientRequest } from 'node:http'
import { Writable } from 'node:stream'
import { afterEach, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { compileComponentSchema } from '@tests/helpers/contract'
import { createApp } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { multipartBody, type TestPart } from '@tests/helpers/multipart'
import {
  createAppWithStorage,
  fileStorageFixture,
  type StorageTestFixture,
} from '@tests/helpers/storage'
import type { StorageServices } from '@server/src/modules/storage/factory'

/**
 * 共用 multipart 上传生命周期的真实连接验收。
 *
 * 这些用例只在真实 socket 上成立：`app.inject()` 会一次性交出完整请求体，
 * 无法构造 stalled part、只发 headers、deadline 竞争或响应头已发出的状态。
 * 资源释放一律用可观察结果（后续成功上传、容量拒绝、handler 未被调用）证明，
 * 不靠内存数字或 GC 时间判定。
 */

const validateEnvelope = compileComponentSchema('ErrorEnvelope')

const fixtures: TestAuth[] = []
const apps: FastifyInstance[] = []
const storages: StorageTestFixture[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
  for (const storage of storages.splice(0)) storage.cleanup()
})

interface Connection {
  req: ClientRequest
  result: Promise<{
    status: number
    headers: Record<string, string | string[] | undefined>
    body: string
  }>
  /** 连接被中断前收到的原始字节；用于断言没有把 JSON 追加到半截字节后面。 */
  partial: () => Buffer
}

function client(
  port: number,
  path: string,
  method = 'POST',
  headers: Record<string, string> = {},
): Connection {
  const chunks: Buffer[] = []
  let req!: ClientRequest
  const result = new Promise<{
    status: number
    headers: Record<string, string | string[] | undefined>
    body: string
  }>((resolve, reject) => {
    req = httpRequest({ host: '127.0.0.1', port, path, method, headers, agent: false }, (res) => {
      res.on('data', (chunk) => chunks.push(chunk as Buffer))
      res.on('end', () =>
        resolve({
          status: res.statusCode!,
          headers: res.headers,
          body: Buffer.concat(chunks).toString(),
        }),
      )
      res.on('error', reject)
    })
    req.on('error', reject)
  })
  // Deliberate disconnect tests must not create an unhandled rejected Promise.
  void result.catch(() => {})
  return { req, result, partial: () => Buffer.concat(chunks) }
}

/** 覆盖某 operation 的 route config 限额，并暴露该活动对象与恢复 deadline 的入口。 */
function overrideConfig(
  app: FastifyInstance,
  key: 'storageUpload',
  overrides: Record<string, number>,
) {
  let limits: Record<string, number> | undefined
  let originalDeadline: number | undefined
  app.addHook('onRoute', (route) => {
    const config = (route.config ?? {}) as Record<string, Record<string, number> | undefined>
    const found = config[key]
    if (found === undefined) return
    limits = found
    originalDeadline = found.deadlineMs
    Object.assign(found, overrides)
  })
  return {
    /** 限额对象保持活动：测试可在请求之间继续调整它。 */
    limits: () => {
      if (limits === undefined) throw new Error(`${key} route was not registered`)
      return limits
    },
    restoreDeadline: () => {
      if (limits === undefined || originalDeadline === undefined)
        throw new Error(`${key} route was not registered`)
      limits.deadlineMs = originalDeadline
    },
  }
}

function textPart(name: string, value: string): TestPart {
  return { name, contentType: 'text/plain', bytes: Buffer.from(value, 'utf8') }
}
function dataPart(bytes: Uint8Array): TestPart {
  return {
    name: 'data',
    filename: 'upload.bin',
    contentType: 'application/octet-stream',
    bytes: Buffer.from(bytes),
  }
}

async function storageSetup(
  options: {
    overrides?: Record<string, number>
    maxBytes?: string
    origins?: ReadonlySet<string>
    logger?: { stream: Writable; level: string }
  } = {},
) {
  const f = await createTestAuth()
  fixtures.push(f)
  const storage = fileStorageFixture(
    options.maxBytes === undefined ? undefined : { STORAGE_MAX_BYTES: options.maxBytes },
  )
  storages.push(storage)
  const app =
    options.origins === undefined && options.logger === undefined
      ? createAppWithStorage(f, storage.storage)
      : createApp({
          authServices: f.authServices,
          profileServices: f.profileServices,
          joinServices: f.joinServices,
          invitationServices: f.invitationServices,
          storageServices: storage.storage,
          notifications: f.notifications,
          clickupServices: f.clickupServices,
          supportServices: f.supportServices,
          corsAllowedOrigins: options.origins,
          logger: options.logger,
        })
  apps.push(app)
  const config =
    options.overrides === undefined
      ? {
          limits: () => {
            throw new Error('storageUpload overrides were not requested')
          },
          restoreDeadline: () => undefined,
        }
      : overrideConfig(app, 'storageUpload', options.overrides)
  // 存储槽位屏障用于核对连接中断后的容量释放。
  let observed = 0
  const waiters: Array<{ count: number; resolve: () => void }> = []
  app.addHook('preValidation', async (request) => {
    if (request.url !== '/api/storage/uploads') return
    observed++
    for (const waiter of waiters.filter((waiter) => waiter.count <= observed)) waiter.resolve()
  })
  await f.seedUser({
    email: 'lifecycle@example.com',
    nickname: 'Lifecycle',
    password: 'valid password',
  })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'lifecycle@example.com', password: 'valid password' },
  })
  expect(login.statusCode).toBe(200)
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (address === null || typeof address === 'string') throw new Error('No socket address')
  return {
    f,
    app,
    port: address.port,
    services: storage.storage,
    limits: config.limits,
    restoreDeadline: config.restoreDeadline,
    token: (login.json() as { token: string }).token,
    entered: (count: number) =>
      observed >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.push({ count, resolve })),
  }
}

/** 只写第一个 part 的头部与半个字段值并挂住：解析停在字段内，请求一直占着槽位。 */
function holdStorage(port: number, token: string, boundary = 'lifecycle-boundary') {
  const connection = client(port, '/api/storage/uploads', 'POST', {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    authorization: `Bearer ${token}`,
  })
  connection.req.write(`--${boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\nstall`)
  return connection
}

it('takeover keeps the exact contract envelope, content type and safe headers on a real socket', async () => {
  const { port, token } = await storageSetup({ overrides: { deadlineMs: 150 } })
  const connection = holdStorage(port, token)
  const response = await connection.result
  expect(response.status).toBe(408)
  const body = JSON.parse(response.body) as {
    error: { code: string; message: string; requestId: string }
  }
  expect(body.error.code).toBe('STORAGE_TIMEOUT')
  // 序列化前的 envelope 与序列化后的真实响应都精确符合 Contract。
  expect(Object.keys(body)).toEqual(['error'])
  expect(Object.keys(body.error).sort()).toEqual(['code', 'message', 'requestId'])
  expect(validateEnvelope(body), JSON.stringify(validateEnvelope.errors)).toBe(true)
  // content-type 是「显式状态码 + application/json 选中正确 serializer」唯一的线上可观测证据。
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8')
  expect(response.headers['cache-control']).toBe('no-store')
  expect(response.headers['connection']).toBe('close')
  expect(response.headers['x-request-id']).toEqual(expect.any(String))
  expect(body.error.requestId).toBe(response.headers['x-request-id'])
  expect(response.headers['content-length']).toBe(String(Buffer.byteLength(response.body)))
}, 60000)

it('keeps CORS and Vary headers through the takeover response', async () => {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  const origin = 'http://127.0.0.1:9999'
  const { port, token } = await storageSetup({
    overrides: { deadlineMs: 150 },
    origins: new Set([origin]),
    logger: { stream, level: 'warn' },
  })
  const connection = client(port, '/api/storage/uploads', 'POST', {
    'content-type': 'multipart/form-data; boundary=lifecycle-boundary',
    authorization: `Bearer ${token}`,
    origin,
  })
  connection.req.write(
    '--lifecycle-boundary\r\nContent-Disposition: form-data; name="key"\r\n\r\nstall',
  )
  const response = await connection.result
  expect(response.status).toBe(408)
  // 接管不走 onSend，因此 foundation 在 onRequest 设置的 CORS 头必须靠 getHeaders() 透传。
  expect(response.headers['access-control-allow-origin']).toBe(origin)
  expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id')
  expect(String(response.headers['vary'])).toContain('Origin')
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8')
  // 迟到 rejection 已被消费：日志里只有安全分类，没有原始异常文本。
  const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
  expect(
    entries.some((entry) => entry.code === 'STORAGE_TIMEOUT' && entry.statusCode === 408),
  ).toBe(true)
  const text = lines.join('\n')
  for (const leak of [
    'premature close',
    'PrematureClose',
    'Stream destroyed',
    'unexpected end of form',
    'ERR_STREAM_PREMATURE_CLOSE',
    ' at ',
  ]) {
    expect(text, leak).not.toContain(leak)
  }
  lines.length = 0
}, 60000)

it('accepts a real chunked storage upload of exactly the wire budget and stores its bytes', async () => {
  const maxBytes = 1024
  const body = multipartBody([textPart('key', 'exact.bin'), dataPart(new Uint8Array(maxBytes))])
  // 让 wire 预算恰好等于这份真实 multipart 的长度；+1 变体只把开销减一。
  const overhead = body.payload.length - maxBytes
  expect(overhead).toBeGreaterThan(1)
  const { port, app, token, limits } = await storageSetup({
    overrides: { wireOverheadBytes: overhead, deadlineMs: 400 },
    maxBytes: String(maxBytes),
  })

  // chunked（不设 Content-Length）：wire 恰好等于预算时 counter 放行。
  const exact = client(port, '/api/storage/uploads', 'POST', {
    ...body.headers,
    authorization: `Bearer ${token}`,
  })
  exact.req.write(body.payload)
  exact.req.end()
  const accepted = await exact.result
  expect(accepted.status, accepted.body).toBe(200)
  // 字节确实落盘：走公开下载路由取回，而不是只信 200。
  const stored = await app.inject({ method: 'GET', url: '/api/storage/files?key=exact.bin' })
  expect(stored.statusCode).toBe(200)
  expect(stored.rawPayload.byteLength).toBe(maxBytes)

  // 同一份真实 multipart，预算少一个字节：这次由 counter 拦下。
  limits().wireOverheadBytes = overhead - 1
  const over = client(port, '/api/storage/uploads', 'POST', {
    ...body.headers,
    authorization: `Bearer ${token}`,
  })
  over.req.write(body.payload)
  over.req.end()
  const rejected = await over.result
  expect(rejected.status, rejected.body).toBe(413)
  expect((JSON.parse(rejected.body) as { error: { code: string } }).error.code).toBe(
    'STORAGE_TOO_LARGE',
  )
  expect(rejected.headers['content-type']).toBe('application/json; charset=utf-8')
}, 60000)

it('rejects unauthenticated storage headers before receiving a body and still accepts a legal upload', async () => {
  const { port, app, token } = await storageSetup()
  const anonymous = client(port, '/api/storage/uploads', 'POST', {
    'content-type': 'multipart/form-data; boundary=admission-boundary',
  })
  anonymous.req.flushHeaders()
  const rejected = await anonymous.result
  expect(rejected.status).toBe(401)
  expect((JSON.parse(rejected.body) as { error: { code: string } }).error.code).toBe(
    'SESSION_INVALID',
  )

  const { payload, headers } = multipartBody([
    textPart('key', 'admission.bin'),
    dataPart(new Uint8Array([1, 2])),
  ])
  const accepted = client(port, '/api/storage/uploads', 'POST', {
    ...headers,
    authorization: `Bearer ${token}`,
  })
  accepted.req.end(payload)
  expect((await accepted.result).status).toBe(200)
  const stored = await app.inject({ method: 'GET', url: '/api/storage/files?key=admission.bin' })
  expect(stored.statusCode).toBe(200)
  expect(stored.rawPayload).toEqual(Buffer.from([1, 2]))
}, 60000)
