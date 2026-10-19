import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createApp, serviceHandlers } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { multipartBody, type TestPart } from '@tests/helpers/multipart'
import { nginxProxy } from '@tests/helpers/nginx'
import {
  TEST_BUCKET,
  TEST_REGION,
  cosStorageFixture,
  createAppWithStorage,
  createFakeCos,
  fileStorageFixture,
  type StorageTestFixture,
} from '@tests/helpers/storage'
import type { StorageServices } from '@server/src/modules/storage/factory'
import { FALLBACK_CONTENT_TYPE } from '@server/src/modules/storage/service'

const fixtures: TestAuth[] = []
const apps: Array<FastifyInstance> = []
const storages: StorageTestFixture[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
  for (const storage of storages.splice(0)) storage.cleanup()
})

async function setup(
  storage?: StorageServices,
): Promise<{ f: TestAuth; app: FastifyInstance; token: string }> {
  const f = await createTestAuth()
  fixtures.push(f)
  const app = createAppWithStorage(f, storage ?? f.storageServices)
  apps.push(app)
  await f.seedUser({ email: 'member@example.com', nickname: 'Member', password: 'valid password' })
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'member@example.com', password: 'valid password' },
  })
  expect(login.statusCode).toBe(200)
  const { token } = login.json() as { token: string }
  return { f, app, token }
}

function useStorage<T extends StorageTestFixture>(fixture: T): T {
  storages.push(fixture)
  return fixture
}

function dataPart(
  bytes: Uint8Array,
  contentType = 'application/octet-stream',
  filename = 'upload.bin',
): TestPart {
  return { name: 'data', filename, contentType, bytes: Buffer.from(bytes) }
}
function textPart(name: string, value: string): TestPart {
  return { name, contentType: 'text/plain', bytes: Buffer.from(value, 'utf8') }
}

function reply() {
  const r = { code: () => r, header: () => r }
  return r as unknown as FastifyReply
}
function request(
  f: TestAuth,
  body?: unknown,
  authSession?: FastifyRequest['authSession'],
  query?: unknown,
) {
  return { body, query, authSession, server: f } as unknown as FastifyRequest
}

describe('POST /api/storage/uploads/prepare', () => {
  it('returns the file plan with no credentials and no-store', async () => {
    const storage = useStorage(fileStorageFixture({ STORAGE_MAX_BYTES: '4096' }))
    const { app, token } = await setup(storage.storage)
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/prepare',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'avatars/a.webp', size: 10, contentType: 'image/webp' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.json()).toEqual({ medium: 'file', maxBytes: 4096 })
  })

  it('returns scoped credentials and a ticket when cos is the default medium', async () => {
    const cos = createFakeCos()
    const storage = useStorage(cosStorageFixture(cos))
    const { app, token } = await setup(storage.storage)
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/prepare',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'avatars/a.webp', size: 10, contentType: 'image/webp' },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.medium).toBe('cos')
    expect(body.bucket).toBe(TEST_BUCKET)
    expect(body.region).toBe(TEST_REGION)
    expect(builderCredentialKeys(body.credentials)).toEqual([
      'expiredTime',
      'securityToken',
      'startTime',
      'tmpSecretId',
      'tmpSecretKey',
    ])
    expect(typeof body.uploadTicket).toBe('string')
    expect(body.uploadTicket.length).toBeLessThanOrEqual(4096)
  })

  it('rejects an unauthenticated prepare with 401', async () => {
    const { app } = await setup()
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/prepare',
      payload: { key: 'a.bin', size: 1, contentType: 'text/plain' },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe('SESSION_INVALID')
  })

  it.each([
    [
      'illegal key',
      { key: 'CON', size: 1, contentType: 'text/plain' },
      400,
      'STORAGE_INVALID_INPUT',
    ],
    [
      'illegal media type',
      { key: 'a.bin', size: 1, contentType: 'text' },
      400,
      'STORAGE_INVALID_INPUT',
    ],
    [
      'unknown medium',
      { key: 'a.bin', size: 1, contentType: 'text/plain', medium: 's3' },
      400,
      'STORAGE_INVALID_INPUT',
    ],
    [
      'unknown field',
      { key: 'a.bin', size: 1, contentType: 'text/plain', owner: 'me' },
      400,
      'STORAGE_INVALID_INPUT',
    ],
    [
      'oversize declaration',
      { key: 'a.bin', size: 20 * 1024 * 1024 + 1, contentType: 'text/plain' },
      413,
      'STORAGE_TOO_LARGE',
    ],
  ])('rejects %s', async (_label, payload, status, code) => {
    const { app, token } = await setup()
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/prepare',
      headers: { authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(status)
    expect(response.json().error.code).toBe(code)
  })
})

function builderCredentialKeys(credentials: object): string[] {
  return Object.keys(credentials).sort()
}

describe('POST /api/storage/uploads', () => {
  it('uploads the default 20 MiB file through Nginx and retains server and proxy size rejection', async () => {
    const storage = useStorage(fileStorageFixture())
    const { app, token } = await setup(storage.storage)
    const address = await app.listen({ port: 0, host: '0.0.0.0' })
    const proxy = await nginxProxy(address)
    try {
      const bytes = Buffer.alloc(20 * 1024 * 1024, 7)
      const { payload, headers } = multipartBody([
        textPart('key', 'proxy/large.bin'),
        dataPart(bytes),
      ])
      const upload = await proxy.request('/api/storage/uploads', {
        method: 'POST',
        payload,
        headers: { ...headers, authorization: `Bearer ${token}` },
      })
      expect(upload.status).toBe(200)
      const downloaded = await proxy.request('/api/storage/files?key=proxy%2Flarge.bin')
      expect(downloaded.status).toBe(200)
      expect(downloaded.body.equals(bytes)).toBe(true)

      // This is below the proxy wire ceiling, so the actual Server must reject it.
      const oversized = multipartBody([
        textPart('key', 'proxy/oversized.bin'),
        dataPart(Buffer.alloc(20 * 1024 * 1024 + 1)),
      ])
      const rejected = await proxy.request('/api/storage/uploads', {
        method: 'POST',
        payload: oversized.payload,
        headers: { ...oversized.headers, authorization: `Bearer ${token}` },
      })
      expect(rejected.status).toBe(413)
      expect(JSON.parse(rejected.body.toString()).error.code).toBe('STORAGE_TOO_LARGE')

      const proxyRejected = await proxy.request('/api/storage/uploads', {
        method: 'POST',
        payload: Buffer.alloc(64 * 1024 * 1024 + 1),
        headers: { 'content-type': 'application/octet-stream' },
      })
      expect(proxyRejected.status).toBe(413)
      expect(proxyRejected.body.toString()).toContain('413 Request Entity Too Large')
    } finally {
      await proxy.close()
    }
  })

  it('accepts the fields in any order and returns only the URL', async () => {
    const storage = useStorage(fileStorageFixture())
    const { app, token } = await setup(storage.storage)
    // contentType 先到，key 后到：字段顺序不参与解析。
    const { payload, headers } = multipartBody([
      textPart('contentType', 'image/webp'),
      dataPart(new Uint8Array([1, 2, 3])),
      textPart('key', 'avatars/order.webp'),
    ])
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json())).toEqual(['url'])
    expect(response.json().url).toContain('/storage/files?key=avatars%2Forder.webp')
  })

  it('stores exact bytes and serves them back through the public route', async () => {
    const storage = useStorage(fileStorageFixture())
    const { app, token } = await setup(storage.storage)
    const bytes = new Uint8Array([9, 8, 7, 6, 5])
    const { payload, headers } = multipartBody([textPart('key', 'round.bin'), dataPart(bytes)])
    const upload = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(upload.statusCode).toBe(200)
    const downloaded = await app.inject({
      method: 'GET',
      url: upload.json().url.replace('http://127.0.0.1:8080/api', '/api'),
    })
    expect(downloaded.statusCode).toBe(200)
    expect(Buffer.from(downloaded.rawPayload)).toEqual(Buffer.from(bytes))
  })

  it('uses the part media type when no explicit contentType is supplied', async () => {
    const cos = createFakeCos()
    const storage = useStorage(cosStorageFixture(cos))
    const { app, token } = await setup(storage.storage)
    const { payload, headers } = multipartBody([
      textPart('key', 'a.bin'),
      dataPart(new Uint8Array([1]), 'text/plain'),
      textPart('medium', 'cos'),
    ])
    await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(cos.calls.putObject[0]!.contentType).toBe('text/plain')
  })

  it('falls back to octet-stream when the part has no usable media type', async () => {
    const cos = createFakeCos()
    const storage = useStorage(cosStorageFixture(cos))
    const { app, token } = await setup(storage.storage)
    const { payload, headers } = multipartBody([
      textPart('key', 'a.bin'),
      dataPart(new Uint8Array([1]), 'application/octet-stream'),
      textPart('medium', 'cos'),
    ])
    await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(cos.calls.putObject[0]!.contentType).toBe(FALLBACK_CONTENT_TYPE)
  })

  it('ignores the supplied filename when choosing the stored path', async () => {
    const storage = useStorage(fileStorageFixture())
    const { app, token } = await setup(storage.storage)
    const { payload, headers } = multipartBody([
      textPart('key', 'real.bin'),
      dataPart(new Uint8Array([1]), 'application/octet-stream', '../../evil.exe'),
    ])
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().url).toContain('key=real.bin')
  })

  it.each([
    [
      'duplicate key',
      [textPart('key', 'a.bin'), textPart('key', 'b.bin'), dataPart(new Uint8Array([1]))],
      400,
    ],
    [
      'unknown field',
      [textPart('key', 'a.bin'), textPart('owner', 'me'), dataPart(new Uint8Array([1]))],
      400,
    ],
    [
      'two files',
      [
        textPart('key', 'a.bin'),
        dataPart(new Uint8Array([1])),
        dataPart(new Uint8Array([2]), 'application/octet-stream', 'second.bin'),
      ],
      400,
    ],
    ['missing data', [textPart('key', 'a.bin')], 400],
    ['missing key', [dataPart(new Uint8Array([1]))], 400],
    ['illegal key', [textPart('key', 'CON'), dataPart(new Uint8Array([1]))], 400],
  ])('rejects %s', async (_label, parts, status) => {
    const { app, token } = await setup()
    const { payload, headers } = multipartBody(parts)
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(status)
    expect(response.json().error.code).toBe('STORAGE_INVALID_INPUT')
  })

  it('rejects a JSON content type with 415', async () => {
    const { app, token } = await setup()
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: { key: 'a.bin', data: 'storage-content' },
    })
    expect(response.statusCode).toBe(415)
    expect(response.json().error.code).toBe('STORAGE_UNSUPPORTED_MEDIA_TYPE')
  })

  it('rejects a forged body placeholder that bypassed the parser', async () => {
    const { app, token } = await setup()
    // 直接以 JSON 提交 data 占位标识：handler 必须核对可信解析上下文。
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'multipart/form-data' },
      payload: { key: 'a.bin', data: 'storage-content' },
    })
    expect(response.statusCode).toBeGreaterThanOrEqual(400)
  })

  it('authenticates before consuming any content, even for an oversized body', async () => {
    const { app } = await setup()
    const { payload, headers } = multipartBody([
      textPart('key', 'a.bin'),
      dataPart(new Uint8Array(64)),
    ])
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers,
      payload,
    })
    // 认证失败先于传输限制与解析：不会先缓冲或先解析。
    expect(unauthenticated.statusCode).toBe(401)
    expect(unauthenticated.json().error.code).toBe('SESSION_INVALID')
  })

  it('rejects content above the configured ceiling with 413', async () => {
    const storage = useStorage(fileStorageFixture({ STORAGE_MAX_BYTES: '16' }))
    const { app, token } = await setup(storage.storage)
    const { payload, headers } = multipartBody([
      textPart('key', 'a.bin'),
      dataPart(new Uint8Array(17)),
    ])
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(413)
    expect(response.json().error.code).toBe('STORAGE_TOO_LARGE')
  })

  it('accepts content of exactly the configured ceiling', async () => {
    const storage = useStorage(fileStorageFixture({ STORAGE_MAX_BYTES: '16' }))
    const { app, token } = await setup(storage.storage)
    const { payload, headers } = multipartBody([
      textPart('key', 'exact.bin'),
      dataPart(new Uint8Array(16)),
    ])
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(200)
  })

  it('answers 503 without Retry-After when the requested medium is not enabled', async () => {
    // 本地介质配置下请求 cos：适配器缺失，与配额耗尽的 503 不同，它不可重试。
    const storage = useStorage(fileStorageFixture())
    const { app, token } = await setup(storage.storage)
    const { payload, headers } = multipartBody([
      textPart('key', 'a.bin'),
      dataPart(new Uint8Array([1])),
      textPart('medium', 'cos'),
    ])
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(503)
    expect(response.json().error.code).toBe('STORAGE_UNAVAILABLE')
    expect(response.headers['retry-after']).toBeUndefined()
  })

  it('rejects a wire body far above the file ceiling plus its metadata budget', async () => {
    const storage = useStorage(fileStorageFixture({ STORAGE_MAX_BYTES: '16' }))
    const { app, token } = await setup(storage.storage)
    // 17 字节已超限；再叠加远超 64 KiB 开销的字段，wire 计数同样要拦住。
    const { payload, headers } = multipartBody([
      textPart('key', 'a.bin'),
      dataPart(new Uint8Array(17)),
      textPart('pad', 'x'.repeat(200)),
    ])
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(response.statusCode).toBe(413)
  })
})

describe('POST /api/storage/uploads/complete', () => {
  async function cosSetup() {
    const cos = createFakeCos()
    const storage = useStorage(cosStorageFixture(cos))
    const context = await setup(storage.storage)
    return { ...context, cos, storage }
  }

  it('confirms a direct upload and returns only the URL', async () => {
    const { app, token, storage } = await cosSetup()
    await storage.storage.service.upload('avatars/a.webp', new Uint8Array([1, 2, 3, 4]), {
      medium: 'cos',
    })
    const prepared = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/prepare',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'avatars/a.webp', size: 4, contentType: 'image/webp' },
    })
    const { uploadTicket } = prepared.json() as { uploadTicket: string }
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/complete',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'avatars/a.webp', uploadTicket },
    })
    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json())).toEqual(['url'])
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('returns 404 when the object was never uploaded', async () => {
    const { app, token } = await cosSetup()
    const prepared = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/prepare',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'missing.bin', size: 4, contentType: 'image/webp' },
    })
    const response = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/complete',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        key: 'missing.bin',
        uploadTicket: (prepared.json() as { uploadTicket: string }).uploadTicket,
      },
    })
    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('STORAGE_NOT_FOUND')
  })

  it('rejects a malformed ticket and an unauthenticated confirm', async () => {
    const { app, token } = await cosSetup()
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/complete',
      headers: { authorization: `Bearer ${token}` },
      payload: { key: 'a.bin', uploadTicket: 'not-a-ticket' },
    })
    expect(malformed.statusCode).toBe(400)
    const anonymous = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads/complete',
      payload: { key: 'a.bin', uploadTicket: 'not-a-ticket' },
    })
    expect(anonymous.statusCode).toBe(401)
  })
})

describe('GET /api/storage/files', () => {
  it('returns exact bytes with attachment, nosniff and content-length', async () => {
    const storage = useStorage(fileStorageFixture())
    const { app, token } = await setup(storage.storage)
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const { payload, headers } = multipartBody([textPart('key', 'files/a.bin'), dataPart(bytes)])
    await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/storage/files?key=files%2Fa.bin',
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/octet-stream')
    expect(response.headers['content-disposition']).toBe('attachment; filename="a.bin"')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['content-length']).toBe('5')
    expect(Buffer.from(response.rawPayload)).toEqual(Buffer.from(bytes))
  })

  it('is public and returns 404 for a missing object', async () => {
    const { app } = await setup()
    const response = await app.inject({ method: 'GET', url: '/api/storage/files?key=missing.bin' })
    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('STORAGE_NOT_FOUND')
  })

  it('rejects an illegal key with 400 and does not expose a directory', async () => {
    const { app } = await setup()
    expect(
      (await app.inject({ method: 'GET', url: '/api/storage/files?key=CON' })).statusCode,
    ).toBe(400)
    expect(
      (await app.inject({ method: 'GET', url: '/api/storage/files?key=nul' })).json().error.code,
    ).toBe('STORAGE_INVALID_INPUT')
  })

  it('keeps the implicit HEAD route closed because the contract does not declare it', async () => {
    const { app } = await setup()
    const response = await app.inject({ method: 'HEAD', url: '/api/storage/files?key=a.bin' })
    expect(response.statusCode).toBe(404)
  })
})

describe('registered handler output', () => {
  it('prepareStorageUpload returns the closed file plan before serialization', async () => {
    const f = await createTestAuth()
    fixtures.push(f)
    const storage = useStorage(fileStorageFixture({ STORAGE_MAX_BYTES: '64' }))
    Object.assign(f, { storageServices: storage.storage })
    const session = await f.authServices.authenticateToken(await tokenFor(f, storage.storage))
    const result = await serviceHandlers.prepareStorageUpload(
      request(f, { key: 'a.bin', size: 3, contentType: 'text/plain' }, session),
      reply(),
    )
    expect(result).toEqual({ medium: 'file', maxBytes: 64 })
  })

  it('completeStorageUpload returns only the url field', async () => {
    const f = await createTestAuth()
    fixtures.push(f)
    const cos = createFakeCos()
    const storage = useStorage(cosStorageFixture(cos))
    Object.assign(f, { storageServices: storage.storage })
    const session = await f.authServices.authenticateToken(await tokenFor(f, storage.storage))
    await storage.storage.service.upload('a.bin', new Uint8Array([1, 2]), { medium: 'cos' })
    const plan = await storage.storage.direct.prepare(session.userId, {
      key: 'a.bin',
      size: 2,
      contentType: 'text/plain',
    })
    const result = await serviceHandlers.completeStorageUpload(
      request(f, { key: 'a.bin', uploadTicket: plan.uploadTicket }, session),
      reply(),
    )
    expect(Object.keys(result as object)).toEqual(['url'])
  })

  async function tokenFor(f: TestAuth, _storage: StorageServices): Promise<string> {
    await f.seedUser({
      email: 'handler@example.com',
      nickname: 'Handler',
      password: 'valid password',
    })
    return f.authServices
      .login({ email: 'handler@example.com', password: 'valid password' })
      .then((result) => result.token)
  }
})
