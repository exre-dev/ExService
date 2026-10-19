import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageSdkError, toStorageSdkError } from '@sdk/src/errors'
import { createServer, type Server } from 'node:http'
import { createRuntime } from '@sdk/src/runtime'
import { transport } from '@sdk/src/storage/node'

const putObject = vi.fn(async () => ({ statusCode: 200 }))
const constructorArgs: unknown[] = []

/**
 * 裸包名由 vitest.config.ts 的别名解析到 packages/sdk 下的同一份依赖；
 * 没有别名时从 tests/ 出发解析不到，mock 会静默失效并让 SDK 真的去连 COS。
 */
vi.mock('cos-nodejs-sdk-v5', () => ({
  default: class {
    constructor(options: unknown) {
      constructorArgs.push(options)
    }
    putObject = putObject
  },
}))

let BASE = ''
let server: Server
const CREDENTIALS = {
  tmpSecretId: 'tmp-id',
  tmpSecretKey: 'tmp-key',
  securityToken: 'tmp-token',
  startTime: 1_800_000_000,
  expiredTime: 1_800_001_800,
}

interface Recorded {
  url: string
  method: string
  authorization?: string
  json?: unknown
  fields?: Record<string, string>
  fileBytes?: Uint8Array
  fileType?: string
  filename?: string
}

const calls: Recorded[] = []
let responder: (
  url: string,
) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }> = () => ({
  status: 200,
  body: {},
})

beforeEach(async () => {
  calls.length = 0
  putObject.mockClear()
  constructorArgs.length = 0
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const recorded: Recorded = {
      url,
      method: request.method ?? 'GET',
      authorization: request.headers.authorization,
    }
    const bytes: Buffer[] = []
    for await (const chunk of request) bytes.push(Buffer.from(chunk))
    const body = Buffer.concat(bytes)
    const type = request.headers['content-type'] ?? ''
    if (type.startsWith('multipart/form-data')) {
      const form = await new Response(new Uint8Array(body), {
        headers: { 'content-type': type },
      }).formData()
      recorded.fields = {}
      for (const [name, value] of form.entries()) {
        if (typeof value === 'string') recorded.fields[name] = value
        else {
          recorded.fileBytes = new Uint8Array(await value.arrayBuffer())
          recorded.fileType = value.type
          recorded.filename = value.name
        }
      }
    } else {
      try {
        recorded.json = JSON.parse(body.toString('utf8'))
      } catch {
        recorded.json = undefined
      }
    }
    calls.push(recorded)
    try {
      const answer = await responder(url)
      response.writeHead(answer.status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(answer.body))
    } catch {
      response.destroy()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected TCP fixture')
  BASE = `http://127.0.0.1:${address.port}/api`
})

afterEach(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function sdk(
  token: (() => string | Promise<string>) | string = 'token-a',
  requestPolicy?: { timeoutMs?: number; signal?: AbortSignal },
) {
  const client = createRuntime({ environment: 'node' }, async () => transport, requestPolicy)
  client.setBaseUrl(BASE)
  const value = typeof token === 'function' ? token() : token
  if (typeof value !== 'string') throw new Error('Tests require synchronous credentials')
  client.setAccessToken(value || null)
  return client
}
describe('SDK file branch', () => {
  it('maps binary normalisation failures to a stable input error without exposing the original exception', async () => {
    const input = new Blob(['data'])
    input.arrayBuffer = async () => {
      throw new Error('private input detail')
    }
    const error = await sdk()
      .storage.upload('a.bin', input)
      .catch((error) => error)
    expect(error).toBeInstanceOf(StorageSdkError)
    expect(error).toMatchObject({ code: 'INVALID_INPUT' })
    expect(error.message).not.toContain('private input detail')
    expect(calls).toEqual([])
  })
  it.each(
    [
      null,
      [],
      { medium: 'other' },
      { contentType: 'text/plain\r\nsecret' },
      { unexpected: true },
    ].map((options) => ({ options })),
  )(
    'maps malformed upload options to INVALID_INPUT before sending: $options',
    async ({ options }) => {
      await expect(
        sdk().storage.upload('a.bin', new Uint8Array([1]), options as never),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
      expect(calls).toEqual([])
    },
  )
  it('prepares, uploads multipart and returns only the URL string', async () => {
    responder = (url) =>
      url.endsWith('/prepare')
        ? { status: 200, body: { medium: 'file', maxBytes: 20 * 1024 * 1024 } }
        : { status: 200, body: { url: `${BASE}/storage/files?key=demo%2Fa.bin` } }

    const result = await sdk().storage.upload('demo/a.bin', new Uint8Array([1, 2, 3]), {
      contentType: 'image/webp',
    })
    expect(result).toBe(`${BASE}/storage/files?key=demo%2Fa.bin`)
    expect(calls.map((call) => call.url)).toEqual([
      '/api/storage/uploads/prepare',
      '/api/storage/uploads',
    ])

    const upload = calls[1]!
    expect(upload.fields).toMatchObject({
      key: 'demo/a.bin',
      medium: 'file',
      contentType: 'image/webp',
    })
    expect(Array.from(upload.fileBytes!)).toEqual([1, 2, 3])
    // boundary 由 FormData 生成，不手写 Content-Type。
    expect(upload.filename).toBe('a.bin')
  })

  it('pins one credential across concurrent uploads on the shared runtime', async () => {
    responder = (url) =>
      url.endsWith('/prepare')
        ? { status: 200, body: { medium: 'file', maxBytes: 1024 } }
        : { status: 200, body: { url: 'u' } }
    const client = sdk()
    await Promise.all([
      client.storage.upload('a.bin', new Uint8Array([1])),
      client.storage.upload('b.bin', new Uint8Array([2])),
    ])
    expect(calls.map((call) => call.authorization)).toEqual(Array(4).fill('Bearer token-a'))
    expect(
      calls
        .filter((call) => call.url === '/api/storage/uploads')
        .map((call) => call.fields?.key)
        .sort(),
    ).toEqual(['a.bin', 'b.bin'])
  })

  it('accepts Blob input and uses its media type', async () => {
    responder = (url) =>
      url.endsWith('/prepare')
        ? { status: 200, body: { medium: 'file', maxBytes: 1024 } }
        : { status: 200, body: { url: 'u' } }
    await sdk().storage.upload('a.bin', new Blob([new Uint8Array([7])], { type: 'text/plain' }))
    expect(calls[0]!.json).toMatchObject({ key: 'a.bin', size: 1, contentType: 'text/plain' })
    expect(calls[1]!.fields!.contentType).toBe('text/plain')
  })

  it('falls back to octet-stream when no media type is available', async () => {
    responder = (url) =>
      url.endsWith('/prepare')
        ? { status: 200, body: { medium: 'file', maxBytes: 1024 } }
        : { status: 200, body: { url: 'u' } }
    await sdk().storage.upload('a.bin', new Uint8Array([7]))
    expect(calls[0]!.json).toMatchObject({ contentType: 'application/octet-stream' })
  })

  it('pre-checks against the server maxBytes before uploading', async () => {
    responder = () => ({ status: 200, body: { medium: 'file', maxBytes: 4 } })
    await expect(sdk().storage.upload('a.bin', new Uint8Array(5))).rejects.toMatchObject({
      code: 'TOO_LARGE',
    })
    expect(calls).toHaveLength(1)
  })
})

describe('SDK cos branch', () => {
  const plan = {
    medium: 'cos',
    maxBytes: 1024,
    bucket: 'exre-1250000000',
    region: 'ap-guangzhou',
    key: 'demo/a.bin',
    credentials: CREDENTIALS,
    uploadTicket: 'ticket-value',
  }

  function cosResponder() {
    responder = (url) => {
      if (!url.endsWith('/prepare'))
        return { status: 200, body: { url: 'https://signed.example/a.bin' } }
      // 计划里的 key 取服务器回显值，用于验证 SDK 沿用服务器决定的 key。
      const requested = calls.at(-1)!.json as { key: string }
      return { status: 200, body: { ...plan, key: requested.key } }
    }
  }

  it('maps the Node COS 120-second deadline to TIMEOUT and releases its timer', async () => {
    vi.useFakeTimers()
    putObject.mockImplementationOnce(() => new Promise(() => {}))
    try {
      const pending = transport
        .putObject({
          bucket: plan.bucket,
          region: plan.region,
          key: plan.key,
          bytes: new Uint8Array([1]),
          contentType: 'application/octet-stream',
          credentials: CREDENTIALS,
        })
        .catch((cause) => toStorageSdkError({ cause }))
      await vi.advanceTimersByTimeAsync(120_000)
      expect(await pending).toMatchObject({ code: 'TIMEOUT' })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('puts the object with STS credentials and then confirms', async () => {
    cosResponder()
    const result = await sdk().storage.upload('demo/a.bin', new Uint8Array([1, 2, 3, 4]), {
      contentType: 'image/webp',
    })
    expect(result).toBe('https://signed.example/a.bin')
    expect(calls.map((call) => call.url)).toEqual([
      '/api/storage/uploads/prepare',
      '/api/storage/uploads/complete',
    ])
    expect(calls[1]!.json).toEqual({ key: 'demo/a.bin', uploadTicket: 'ticket-value' })
  })

  it('calls PutObject explicitly with attachment, no-store and an explicit length', async () => {
    cosResponder()
    await sdk().storage.upload('demo/a.bin', new Uint8Array([1, 2, 3, 4]), {
      contentType: 'image/webp',
    })
    expect(putObject).toHaveBeenCalledTimes(1)
    expect(putObject.mock.calls[0]![0]).toMatchObject({
      Bucket: 'exre-1250000000',
      Region: 'ap-guangzhou',
      Key: 'demo/a.bin',
      ContentLength: 4,
      ContentType: 'image/webp',
      ContentDisposition: 'attachment',
      CacheControl: 'no-store',
    })
    expect(Buffer.from(putObject.mock.calls[0]![0]!.Body as Buffer)).toEqual(
      Buffer.from([1, 2, 3, 4]),
    )
  })

  it('never sends the Bearer token to COS and builds one client per call', async () => {
    cosResponder()
    await sdk().storage.upload('one.bin', new Uint8Array([1]))
    await sdk().storage.upload('two.bin', new Uint8Array([2]))
    // 每次调用独立持有凭证，不使用全局可变缓存。
    expect(constructorArgs).toHaveLength(2)
    for (const args of constructorArgs) {
      expect(JSON.stringify(args)).not.toContain('Bearer')
    }
    // 每次调用使用服务器为本次 key 返回的计划，凭证实例互不共享。
    expect(putObject.mock.calls.map((call) => call[0]!.Key)).toEqual(['one.bin', 'two.bin'])
    expect(constructorArgs[0]).not.toBe(constructorArgs[1])
  })

  it('pins the medium returned by prepare and does not switch to file mid-flight', async () => {
    cosResponder()
    await sdk().storage.upload('demo/a.bin', new Uint8Array([1]))
    // 客户端不能改用其他本站路径：全部请求都在 baseUrl 之下。
    expect(calls.every((call) => call.url.startsWith('/api/'))).toBe(true)
    expect(calls.some((call) => call.url === '/api/storage/uploads')).toBe(false)
  })

  it('does not retry when the confirm step fails', async () => {
    responder = (url) =>
      url.endsWith('/prepare')
        ? { status: 200, body: plan }
        : {
            status: 404,
            body: {
              error: { code: 'STORAGE_NOT_FOUND', message: '对象不存在。', requestId: 'req-9' },
            },
          }
    await expect(sdk().storage.upload('demo/a.bin', new Uint8Array([1]))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(putObject).toHaveBeenCalledTimes(1)
    expect(calls.filter((call) => call.url === '/api/storage/uploads/complete')).toHaveLength(1)
  })

  it('does not attempt another confirm when PutObject itself fails', async () => {
    cosResponder()
    putObject.mockRejectedValueOnce(new Error('cos network down'))
    await expect(sdk().storage.upload('demo/a.bin', new Uint8Array([1]))).rejects.toBeInstanceOf(
      StorageSdkError,
    )
    expect(calls.filter((call) => call.url === '/api/storage/uploads/complete')).toHaveLength(0)
  })
})

describe('SDK error mapping', () => {
  const stages = [
    {
      stage: 'prepare',
      path: '/api/storage/uploads/prepare',
      medium: 'file',
      requests: ['/api/storage/uploads/prepare'],
      puts: 0,
    },
    {
      stage: 'upload',
      path: '/api/storage/uploads',
      medium: 'file',
      requests: ['/api/storage/uploads/prepare', '/api/storage/uploads'],
      puts: 0,
    },
    {
      stage: 'complete',
      path: '/api/storage/uploads/complete',
      medium: 'cos',
      requests: ['/api/storage/uploads/prepare', '/api/storage/uploads/complete'],
      puts: 1,
    },
  ]
  const failures = [
    { failure: 'network', code: 'NETWORK' },
    { failure: 'timeout', code: 'TIMEOUT' },
    { failure: 'abort', code: 'TIMEOUT' },
  ]

  it('maps a browser fetch adapter deadline during prepare to StorageSdkError TIMEOUT', async () => {
    responder = async () =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ status: 200, body: { medium: 'file', maxBytes: 1024 } }), 100),
      )
    vi.stubGlobal('location', { origin: new URL(BASE).origin })
    try {
      const browserStorage = createRuntime(
        { environment: 'browser', origin: new URL(BASE).origin },
        async () => transport,
        { timeoutMs: 20 },
      )
      browserStorage.setAccessToken('token-a')
      await expect(
        browserStorage.storage.upload('a.bin', new Uint8Array([1])),
      ).rejects.toMatchObject({ code: 'TIMEOUT' })
      expect(calls.map((call) => call.url)).toEqual(['/api/storage/uploads/prepare'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each(stages.flatMap((stage) => failures.map((failure) => ({ ...stage, ...failure }))))(
    'maps $failure errors during $stage without retrying or continuing',
    async ({ path, medium, requests, puts, failure, code }) => {
      const controller = new AbortController()
      responder = (url) => {
        if (url === path) {
          if (failure === 'network') throw new TypeError('socket failed')
          if (failure === 'abort') setTimeout(() => controller.abort(), 5)
          return new Promise((resolve) => setTimeout(() => resolve({ status: 200, body: {} }), 100))
        }
        return {
          status: 200,
          body:
            medium === 'file'
              ? { medium: 'file', maxBytes: 1024 }
              : {
                  medium: 'cos',
                  maxBytes: 1024,
                  bucket: 'exre-1250000000',
                  region: 'ap-guangzhou',
                  key: 'a.bin',
                  credentials: CREDENTIALS,
                  uploadTicket: 'ticket-value',
                },
        }
      }

      const error = await sdk(() => 'token-a', { timeoutMs: 25, signal: controller.signal })
        .storage.upload('a.bin', new Uint8Array([1]))
        .then(
          () => {
            throw new Error('expected failure')
          },
          (error: unknown) => error,
        )
      expect(error).toBeInstanceOf(StorageSdkError)
      expect(error).toMatchObject({ code })
      expect(calls.map((call) => call.url)).toEqual(requests)
      expect(putObject).toHaveBeenCalledTimes(puts)
    },
  )

  it('maps server codes, status and requestId onto StorageSdkError', async () => {
    responder = () => ({
      status: 413,
      body: {
        error: { code: 'STORAGE_TOO_LARGE', message: '内容超过允许的大小。', requestId: 'req-1' },
      },
    })
    const error = await sdk()
      .storage.upload('a.bin', new Uint8Array([1]))
      .then(
        () => {
          throw new Error('expected failure')
        },
        (e: unknown) => e as StorageSdkError,
      )
    expect(error).toBeInstanceOf(StorageSdkError)
    expect(error.code).toBe('TOO_LARGE')
    expect(error.status).toBe(413)
    expect(error.requestId).toBe('req-1')
  })

  it('keeps URLs, tickets and credentials out of the error text', async () => {
    responder = () => ({
      status: 400,
      body: {
        error: {
          code: 'STORAGE_INVALID_INPUT',
          message: 'bad key https://bucket.cos.ap-guangzhou.myqcloud.com/a?token=tmp-token',
          requestId: 'req-2',
        },
      },
    })
    const error = await sdk()
      .storage.upload('a.bin', new Uint8Array([1]))
      .then(
        () => {
          throw new Error('expected failure')
        },
        (e: unknown) => e as StorageSdkError,
      )
    expect(error.message).not.toContain('tmp-token')
    expect(error.message).not.toContain('https://')
    expect(error.message).toContain('INVALID_INPUT')
  })

  it('does not copy a server or cloud exception containing plain credentials and upload tickets into upload messages', async () => {
    responder = () => ({
      status: 400,
      body: {
        error: {
          code: 'STORAGE_INVALID_INPUT',
          message: 'token-a tmp-token ticket-value',
          requestId: 'safe',
        },
      },
    })
    const serverError = await sdk()
      .storage.upload('a.bin', new Uint8Array([1]))
      .catch((error) => error)
    const cloudError = toStorageSdkError({ cause: new Error('token-a tmp-token ticket-value') })
    for (const error of [serverError, cloudError]) {
      for (const sensitive of ['token-a', 'tmp-token', 'ticket-value'])
        expect(error.message).not.toContain(sensitive)
    }
    expect(serverError).toMatchObject({ code: 'INVALID_INPUT', requestId: 'safe', status: 400 })
  })

  it('rejects a Node baseUrl that is not absolute', () => {
    expect(() => sdk().setBaseUrl('/api')).toThrow()
  })

  it('rejects an empty access token before calling the server', async () => {
    await expect(sdk(() => '').storage.upload('a.bin', new Uint8Array([1]))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(calls).toHaveLength(0)
  })
})

describe('SDK upload context gates', () => {
  const plan = {
    medium: 'cos',
    maxBytes: 1024,
    bucket: 'exre-1250000000',
    region: 'ap-guangzhou',
    key: 'a.bin',
    credentials: CREDENTIALS,
    uploadTicket: 'ticket',
  }

  it.each(['prepare', 'file', 'cos-import', 'cos-put', 'complete'] as const)(
    'stops after %s if the token or address changes, including before returning success',
    async (stage) => {
      for (const change of ['token', 'base'] as const) {
        calls.length = 0
        putObject.mockClear()
        let client: ReturnType<typeof createRuntime>
        const changeContext = () =>
          change === 'token'
            ? client.setAccessToken('new-token')
            : client.setBaseUrl(`${BASE}/other`)
        client = createRuntime({ environment: 'node' }, async () => {
          if (stage === 'cos-import') changeContext()
          return {
            putObject: async (input) => {
              await transport.putObject(input)
              if (stage === 'cos-put') changeContext()
            },
          }
        })
        client.setBaseUrl(BASE)
        client.setAccessToken('old-token')
        responder = (url) => {
          if (url.endsWith('/prepare')) {
            if (stage === 'prepare') changeContext()
            return {
              status: 200,
              body:
                stage === 'file' || stage === 'prepare' ? { medium: 'file', maxBytes: 1024 } : plan,
            }
          }
          if (stage === 'file' || stage === 'complete') changeContext()
          return { status: 200, body: { url: 'uploaded' } }
        }
        await expect(client.storage.upload('a.bin', new Uint8Array([1]))).rejects.toMatchObject({
          code: 'CONFIG_CHANGED',
        })
        expect(calls.map((call) => call.url)).toEqual(
          stage === 'file'
            ? ['/api/storage/uploads/prepare', '/api/storage/uploads']
            : stage === 'complete'
              ? ['/api/storage/uploads/prepare', '/api/storage/uploads/complete']
              : ['/api/storage/uploads/prepare'],
        )
        expect(putObject).toHaveBeenCalledTimes(stage === 'cos-put' || stage === 'complete' ? 1 : 0)
      }
    },
  )

  it('refreshes directly written persisted credentials between stages and never completes under a new account', async () => {
    let stored = 'old'
    const client = createRuntime(
      {
        environment: 'browser',
        origin: new URL(BASE).origin,
        readToken: () => ({ kind: 'known', value: stored }),
      },
      async () => transport,
    )
    responder = () => {
      stored = 'new'
      return { status: 200, body: plan }
    }
    await expect(client.storage.upload('a.bin', new Uint8Array([1]))).rejects.toMatchObject({
      code: 'CONFIG_CHANGED',
    })
    expect(calls.map((call) => call.authorization)).toEqual(['Bearer old'])
    expect(putObject).not.toHaveBeenCalled()
  })

  it('allows equal setters and same-byte source changes during upload', async () => {
    const client = createRuntime(
      {
        environment: 'browser',
        origin: new URL(BASE).origin,
        readToken: () => ({ kind: 'known', value: 'token-a' }),
      },
      async () => transport,
    )
    responder = (url) => {
      client.setBaseUrl(`${BASE}/`)
      client.setAccessToken('token-a')
      return {
        status: 200,
        body: url.endsWith('/prepare') ? { medium: 'file', maxBytes: 1024 } : { url: 'u' },
      }
    }
    expect(await client.storage.upload('a.bin', new Uint8Array([1]))).toBe('u')
    expect(calls.map((call) => call.authorization)).toEqual(['Bearer token-a', 'Bearer token-a'])
  })

  it('preserves a real stage failure and shared session handling even after invalidation changes the revision', async () => {
    const client = sdk()
    let expired = 0
    client.setSessionExpiredHandler(() => {
      expired++
    })
    responder = () => ({
      status: 401,
      body: { error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'stage-failure' } },
    })
    await expect(client.storage.upload('a.bin', new Uint8Array([1]))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
      requestId: 'stage-failure',
    })
    expect(expired).toBe(1)
    expect(calls).toHaveLength(1)
  })

  it('snapshots a sliced input view before asynchronous prepare can mutate its backing bytes', async () => {
    const bytes = new Uint8Array([9, 1, 2, 9]),
      view = bytes.subarray(1, 3)
    responder = (url) => {
      bytes.fill(7)
      return {
        status: 200,
        body: url.endsWith('/prepare') ? { medium: 'file', maxBytes: 1024 } : { url: 'u' },
      }
    }
    await sdk().storage.upload('a.bin', view)
    expect(calls[0]!.json).toMatchObject({ size: 2 })
    expect([...calls[1]!.fileBytes!]).toEqual([1, 2])
  })
})
