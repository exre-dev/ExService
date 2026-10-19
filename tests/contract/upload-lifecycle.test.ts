import { afterEach, describe, expect, it } from 'vitest'
import { compileComponentSchema } from '@tests/helpers/contract'
import type { FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import { createApp, serviceHandlers } from '@workspace/server'
import { StorageError, type StorageErrorCode } from '@server/src/modules/storage/errors'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { multipartBody, type TestPart } from '@tests/helpers/multipart'
import {
  createAppWithStorage,
  fileStorageFixture,
  type StorageTestFixture,
} from '@tests/helpers/storage'

/**
 * 共用 multipart 上传生命周期的 Contract 层验收。
 *
 * 覆盖三件旧测试没有明确断言的事：
 * 1. 提前终结输出的 envelope 在序列化前后都精确符合 Contract 的 ErrorEnvelope；
 * 2. 共享错误映射只能产出该 operation 在 Contract 已声明的状态码；
 * 3. 存储上传 operation 的 handler 原始返回值（序列化前）符合响应 schema。
 */

const validateEnvelope = compileComponentSchema('ErrorEnvelope')
const validateUpload = compileComponentSchema('StorageUploadResult')

const fixtures: TestAuth[] = []
const storages: StorageTestFixture[] = []
const apps: Array<ReturnType<typeof createApp>> = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
  for (const storage of storages.splice(0)) storage.cleanup()
})

/**
 * 记录 Glue 交给 Fastify 的 route schema，并保留 route 对象引用。
 *
 * `onRoute` 钩子的执行顺序：本测试的钩子先于各 transport 的钩子，因此 bodyLimit
 * （由 lifecycle controller 赋值）只能在 `app.ready()` 之后从同一对象读取。
 */
function observeRoute(operationId: string) {
  const observed: { statuses: string[]; route?: RouteOptions } = { statuses: [] }
  return {
    observed,
    hook: (route: RouteOptions) => {
      const schema = route.schema as
        { operationId?: string; response?: Record<string, unknown> } | undefined
      if (schema?.operationId !== operationId) return
      observed.statuses = Object.keys(schema.response ?? {}).sort()
      observed.route = route
    },
  }
}

/** 提前终结适配只能输出数值状态码；Contract 的 `default` 不是可输出状态。 */
const numericStatuses = (statuses: readonly string[]): string[] =>
  statuses.filter((status) => /^[1-9]\d{2}$/.test(status))

const STORAGE_UPLOAD_STATUSES = ['200', '400', '401', '408', '409', '413', '415', '500', '503']

/**
 * 提前终结只能输出该 operation 在 Contract 已声明的状态码。
 *
 * 这里逐条钉住「共享映射在本路径上真正会产出的状态」而不是只比对键集合：
 * 命中未声明状态时 `serializeInput` 会抛 `FST_ERR_MISSING_CONTENTTYPE_SERIALIZATION_FN`
 * 而不是回退到默认 serializer，连接会被销毁且没有任何 envelope，排查成本很高。
 */
describe('takeover status guard', () => {
  const declared = (statuses: readonly string[]): number[] => statuses.map(Number)

  it('covers every status the storage upload lifecycle can emit', () => {
    const codes: StorageErrorCode[] = [
      'STORAGE_TIMEOUT',
      'STORAGE_TOO_LARGE',
      'STORAGE_INVALID_INPUT',
      'STORAGE_UNSUPPORTED_MEDIA_TYPE',
    ]
    for (const code of codes) {
      expect(declared(STORAGE_UPLOAD_STATUSES), code).toContain(new StorageError(code).statusCode)
    }
  })
})

describe('declared response statuses and body limit', () => {
  it('binds the takeover guard to the storage upload statuses declared by the contract', async () => {
    const f = await createTestAuth()
    fixtures.push(f)
    const storage = fileStorageFixture()
    storages.push(storage)
    const { observed, hook } = observeRoute('uploadStorageContent')
    const app = createAppWithStorage(f, storage.storage)
    app.addHook('onRoute', hook)
    apps.push(app)
    await app.ready()
    expect(observed.statuses).toEqual([...STORAGE_UPLOAD_STATUSES, 'default'].sort())
    expect(numericStatuses(observed.statuses)).toEqual(STORAGE_UPLOAD_STATUSES)
  })
})

describe('early takeover envelope', () => {
  it('accepts the contract ErrorEnvelope and rejects extra, missing and mistyped fields', () => {
    const envelope = { error: { code: 'STORAGE_TIMEOUT', message: 'x', requestId: 'y' } }
    expect(validateEnvelope(envelope)).toBe(true)
    expect(
      validateEnvelope({
        error: { code: 'STORAGE_TIMEOUT', message: 'x', requestId: 'y', extra: true },
      }),
    ).toBe(false)
    expect(validateEnvelope({ error: { code: 'STORAGE_TIMEOUT', message: 'x' } })).toBe(false)
    expect(
      validateEnvelope({ error: { code: 'STORAGE_TIMEOUT', message: 'x', requestId: 42 } }),
    ).toBe(false)
    expect(
      validateEnvelope({
        error: { code: 'STORAGE_TIMEOUT', message: 'x', requestId: 'y' },
        extra: 1,
      }),
    ).toBe(false)
  })
})

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

/**
 * 在测试侧的 onRoute 中包装 Glue 已登记（并被 lifecycle 包装过）的 handler，
 * 捕获序列化之前的原始返回值，避免只断言被 schema 改写过的 HTTP 响应体。
 */
function captureHandlerOutput(operationId: string) {
  const captured: Array<unknown> = []
  let calls = 0
  return {
    captured,
    calls: () => calls,
    hook: (route: RouteOptions) => {
      const schema = route.schema as { operationId?: string } | undefined
      if (schema?.operationId !== operationId) return
      const handler = route.handler as (
        this: unknown,
        request: FastifyRequest,
        reply: FastifyReply,
      ) => unknown
      // 保留 Fastify 传给 handler 的 `this`，不替换成 route 对象。
      route.handler = async function capturedHandler(
        this: unknown,
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        calls++
        const result = await handler.call(this, request, reply)
        captured.push(result)
        return result
      }
    },
  }
}

describe('raw upload handler output', () => {
  it('returns the contract shape from the real storage parser context before serialization', async () => {
    const f = await createTestAuth()
    fixtures.push(f)
    const storage = fileStorageFixture()
    storages.push(storage)
    const capture = captureHandlerOutput('uploadStorageContent')
    const app = createAppWithStorage(f, storage.storage)
    app.addHook('onRoute', capture.hook)
    apps.push(app)
    await app.ready()
    await f.seedUser({
      email: 'raw-storage@example.com',
      nickname: 'Raw',
      password: 'valid password',
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'raw-storage@example.com', password: 'valid password' },
    })
    const token = (login.json() as { token: string }).token

    const { payload, headers } = multipartBody([
      textPart('key', 'raw.bin'),
      dataPart(new Uint8Array([1, 2, 3])),
    ])
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/storage/uploads',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(accepted.statusCode, accepted.body).toBe(200)
    expect(capture.calls()).toBe(1)
    const raw = capture.captured[0] as { url: string }
    expect(validateUpload(raw), JSON.stringify(validateUpload.errors)).toBe(true)
    expect(Object.keys(raw as object)).toEqual(['url'])
    expect(accepted.json()).toEqual(raw)
    expect(raw.url).toContain('key=raw.bin')
  })

  it('rejects response values that violate the upload result schemas', () => {
    expect(validateUpload({ url: 'https://example.test/a' })).toBe(true)
    expect(validateUpload({})).toBe(false)
    expect(validateUpload({ url: 1 })).toBe(false)
  })

  it('rejects a forged storage placeholder through the direct handler without a parser context', async () => {
    const f = await createTestAuth()
    fixtures.push(f)
    const storage = fileStorageFixture()
    storages.push(storage)
    const app = createAppWithStorage(f, storage.storage)
    apps.push(app)
    await app.ready()
    await f.seedUser({
      email: 'forged-storage@example.com',
      nickname: 'Forged',
      password: 'valid password',
    })
    const token = await f.authServices
      .login({ email: 'forged-storage@example.com', password: 'valid password' })
      .then((result) => result.token)
    const session = await f.authServices.authenticateToken(token)
    const reply = { header: () => reply, code: () => reply } as unknown as FastifyReply
    // 直接调用 handler：没有真实解析上下文，伪造的 data 占位标识必须被拒绝。
    // `storage.test.ts` 的 HTTP 用例只断言 >=400，这条把分类钉死为 STORAGE_INVALID_INPUT。
    await expect(
      serviceHandlers.uploadStorageContent(
        {
          server: f,
          authSession: session,
          body: { key: 'a.bin', data: 'storage-content' },
        } as unknown as FastifyRequest,
        reply,
      ),
    ).rejects.toMatchObject({ code: 'STORAGE_INVALID_INPUT' })
  })
})
