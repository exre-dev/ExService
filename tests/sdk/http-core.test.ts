import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { ExAxiosError } from '@sdk/src/http/errors'
import { createConfig, type RuntimeEnvironment } from '@sdk/src/config'
import { createHttpCore } from '@sdk/src/http/core'

function browserHttp(
  environment: Omit<RuntimeEnvironment, 'readToken'> & {
    readToken?: () => string | null | undefined
  },
  options: TestOptions = {},
) {
  const read = environment.readToken
  const runtime: RuntimeEnvironment = {
    ...environment,
    readToken: read
      ? () => {
          const value = read()
          return value === undefined ? { kind: 'unavailable' } : { kind: 'known', value }
        }
      : undefined,
  }
  const state = createConfig(runtime)
  if (options.baseUrl) state.setBaseUrl(options.baseUrl)
  if (options.onSessionExpired) state.setSessionExpiredHandler(options.onSessionExpired)
  const request = createHttpCore(runtime, state)
  return {
    ...state,
    request: (config: Parameters<typeof request>[0]) =>
      request({ alert: options.alert, ...config }),
  }
}
interface TestOptions {
  baseUrl?: string
  websiteBaseUrl?: string
  alert?: boolean
  onSessionExpired?: (
    context: import('@sdk/src/request-types').SessionExpiredContext,
  ) => void | Promise<void>
}
function testHttp(options: TestOptions = {}) {
  return browserHttp({ environment: 'node' }, options)
}

const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        }),
    ),
  )
})

async function fixture(handler: Parameters<typeof createServer>[0]): Promise<string> {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected TCP address')
  return `http://127.0.0.1:${address.port}`
}

describe('ExAxios Node HTTP boundary', () => {
  it('rejects ambiguous Authorization headers before an unrelated credential can invalidate the current session', async () => {
    let received = 0,
      expired = 0
    const origin = await fixture((_request, response) => {
      received++
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'ambiguous' },
        }),
      )
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      onSessionExpired: () => {
        expired++
      },
    })
    sdk.setAccessToken('current')
    for (const headers of [
      { Authorization: 'Bearer current', authorization: 'Bearer other' },
      { 'Authorization ': 'Bearer other' },
    ]) {
      await expect(sdk.request({ url: '/health', headers })).rejects.toMatchObject({
        code: 'CONFIG_ERROR',
      })
    }
    expect(received).toBe(0)
    expect(expired).toBe(0)
  })
  it('encodes contract path/query inputs and serializes JSON and multipart without inventing a bodyless POST content type', async () => {
    const received: Array<{ url?: string; type?: string; body: string }> = []
    const origin = await fixture(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      received.push({
        url: request.url,
        type: request.headers['content-type'],
        body: Buffer.concat(chunks).toString(),
      })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{}')
    })
    const sdk = testHttp({ baseUrl: `${origin}/api` }),
      request = sdk.request
    await request({
      url: '/notifications/{notificationId}',
      pathParams: { notificationId: 'part one' },
      params: { tag: ['a b', 'c/d'], omitted: undefined },
    })
    await request({ url: '/json', method: 'POST', data: { message: 'hello' } })
    const form = new FormData()
    form.append('value', 'multipart-value')
    await request({ url: '/multipart', method: 'POST', data: form })
    await request({ url: '/bodyless', method: 'POST' })
    expect(received[0]!.url).toBe('/api/notifications/part%20one?tag=a+b&tag=c%2Fd')
    expect(received[1]).toMatchObject({ type: 'application/json', body: '{"message":"hello"}' })
    expect(received[2]!.type).toMatch(/^multipart\/form-data; boundary=/)
    expect(received[2]!.body).toContain('multipart-value')
    expect(received[3]).toMatchObject({ type: undefined, body: '' })
  })

  it('rejects unsafe templates, malformed or excess path values, query objects, and low-level overrides before sending', async () => {
    const received: string[] = []
    const origin = await fixture((request, response) => {
      received.push(request.url ?? '')
      response.end('{}')
    })
    const request = testHttp({ baseUrl: `${origin}/api` }).request
    for (const config of [
      { url: `${origin}/api/health` },
      { url: '//remote.test/api' },
      { url: '/health?x=1' },
      { url: '/health#x' },
      { url: '/a/../health' },
      { url: '/%2e%2e/health' },
      { url: '/a\\health' },
      { url: '/a%2Fhealth' },
      { url: '/n/{id}' },
      { url: '/n/{id}', pathParams: { id: 'a/b' } },
      { url: '/n/{id}', pathParams: { id: '%2f' } },
      { url: '/n/{id}', pathParams: { id: '.' } },
      { url: '/n/{id}', pathParams: { id: '\ud800' } },
      { url: '/n/{id}', pathParams: { id: 'x', extra: 'y' } },
      { url: '/n', params: { key: {} } },
      { url: '/n', transport: () => {} },
      { url: '/n', validateStatus: () => true },
      { url: '/n', transformResponse: [] },
    ])
      await expect(request(config as never)).rejects.toMatchObject({ code: 'CONFIG_ERROR' })
    expect(received).toEqual([])
  })

  it.each(['blob', 'arraybuffer'] as const)(
    'preserves binary %s session envelopes through the inclusive 64 KiB budget',
    async (responseType) => {
      for (const size of [5077, 65_536]) {
        const empty = JSON.stringify({
          error: { code: 'SESSION_INVALID', message: '', requestId: 'body-id' },
        })
        const payload = JSON.stringify({
          error: {
            code: 'SESSION_INVALID',
            message: 'x'.repeat(size - Buffer.byteLength(empty)),
            requestId: 'body-id',
          },
        })
        expect(Buffer.byteLength(payload)).toBe(size)
        const origin = await fixture((_request, response) => {
          response.writeHead(401, {
            'content-type': 'application/json',
            'x-request-id': 'header-id',
          })
          response.end(payload)
        })
        let handled = 0
        const sdk = testHttp({
          baseUrl: origin + '/api',
          onSessionExpired: () => {
            handled++
          },
          alert: false,
        })
        sdk.setAccessToken('current')
        await expect(
          sdk.request({ url: '/storage/files', params: { key: 'fixture' }, responseType }),
        ).rejects.toMatchObject({ code: 'SESSION_INVALID', requestId: 'body-id', status: 401 })
        await expect(
          sdk.request({ url: '/storage/files', params: { key: 'fixture' }, responseType }),
        ).rejects.toMatchObject({ code: 'SESSION_INVALID', requestId: 'body-id' })
        expect(sdk.resolve().token).toBeNull()
        expect(handled).toBe(1)
      }
    },
  )

  it.each(['blob', 'arraybuffer'] as const)(
    'rejects over-budget, wrong-media, malformed and invalid-JSON binary %s envelopes without session effects',
    async (responseType) => {
      const empty = JSON.stringify({
        error: { code: 'SESSION_INVALID', message: '', requestId: 'body-id' },
      })
      const oversized = JSON.stringify({
        error: {
          code: 'SESSION_INVALID',
          message: 'x'.repeat(65_537 - Buffer.byteLength(empty)),
          requestId: 'body-id',
        },
      })
      expect(Buffer.byteLength(oversized)).toBe(65_537)
      const valid = JSON.stringify({
        error: { code: 'SESSION_INVALID', message: 'safe', requestId: 'body-id' },
      })
      const origin = await fixture((request, response) => {
        response.writeHead(401, {
          'content-type': request.url?.endsWith('/media') ? 'text/plain' : 'application/json',
          'x-request-id': 'header-id',
        })
        response.end(
          request.url?.endsWith('/large')
            ? oversized
            : request.url?.endsWith('/malformed')
              ? JSON.stringify({
                  error: {
                    code: 'SESSION_INVALID',
                    message: 'safe',
                    requestId: 'body-id',
                    extra: true,
                  },
                })
              : request.url?.endsWith('/invalid-json')
                ? '{invalid'
                : valid,
        )
      })
      let handled = 0
      const sdk = testHttp({
        baseUrl: origin + '/api',
        onSessionExpired: () => {
          handled++
        },
        alert: false,
      })
      sdk.setAccessToken('current')
      for (const url of ['/large', '/media', '/malformed', '/invalid-json']) {
        await expect(sdk.request({ url, responseType })).rejects.toMatchObject({
          code: 'HTTP_ERROR',
          requestId: 'header-id',
          status: 401,
        })
      }
      expect(sdk.resolve().token).toBe('current')
      expect(handled).toBe(0)
    },
  )
  it('returns JSON body and attaches a scoped token', async () => {
    const received: string[] = []
    const origin = await fixture((request, response) => {
      received.push(request.headers.authorization ?? '')
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ status: 'ok' }))
    })
    const sdk = testHttp({ baseUrl: `${origin}/api`, websiteBaseUrl: `${origin}/api` })
    const http = sdk.request
    sdk.setAccessToken('secret')
    expect(await http({ url: '/health' })).toEqual({ status: 'ok' })
    expect(received).toEqual(['Bearer secret'])
  })

  it('does not follow an authenticated redirect outside the API scope', async () => {
    const received: string[] = []
    const destination = await fixture((request, response) => {
      received.push(request.headers.authorization ?? '')
      response.end('reached')
    })
    const origin = await fixture((_request, response) => {
      response.writeHead(302, { location: `${destination}/receive` })
      response.end()
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    sdk.setAccessToken('secret')
    await expect(http({ url: '/redirect' })).rejects.toBeInstanceOf(ExAxiosError)
    expect(received).toEqual([])
  })

  it.each([302, 307])(
    'does not forward an explicit website Authorization through a %i redirect',
    async (status) => {
      const received: string[] = []
      const destination = await fixture((request, response) => {
        received.push(request.headers.authorization ?? '')
        response.end('reached')
      })
      const origin = await fixture((_request, response) => {
        response.writeHead(status, { location: `${destination}/receive` })
        response.end()
      })
      const sdk = testHttp({
        baseUrl: `${origin}/api`,
        websiteBaseUrl: `${origin}/api`,
        alert: false,
      })
      const http = sdk.request
      await expect(
        http({ url: '/redirect', headers: { Authorization: 'Bearer storage-token' } }),
      ).rejects.toMatchObject({ kind: 'http', status })
      expect(received).toEqual([])
    },
  )

  it.each([302, 307])(
    'blocks %i redirects to same-origin /docs and another origin for both authentication sources',
    async (status) => {
      const local: string[] = [],
        remote: string[] = []
      const destination = await fixture((request, response) => {
        remote.push(request.headers.authorization ?? '')
        response.end('reached')
      })
      const origin = await fixture((request, response) => {
        if (request.url === '/docs') {
          local.push(request.headers.authorization ?? '')
          response.end('reached')
          return
        }
        response.writeHead(status, {
          location: request.url === '/api/to-docs' ? '/docs' : `${destination}/receive`,
        })
        response.end()
      })
      const sdk = testHttp({
        baseUrl: `${origin}/api`,
        websiteBaseUrl: `${origin}/api`,
        alert: false,
      })
      const http = sdk.request
      for (const mode of ['explicit', 'automatic'] as const) {
        if (mode === 'automatic') sdk.setAccessToken('internal-token')
        for (const url of ['/to-docs', '/to-remote']) {
          const headers =
            mode === 'explicit' ? { Authorization: 'Bearer storage-token' } : undefined
          await expect(http({ url, headers })).rejects.toMatchObject({ kind: 'http', status })
        }
      }
      expect(local).toEqual([])
      expect(remote).toEqual([])
    },
  )

  it('distinguishes API scope from its prefix neighbor and preserves setters after invalid input', async () => {
    const received: Array<{ url: string; auth?: string }> = []
    const origin = await fixture((request, response) => {
      received.push({ url: request.url ?? '', auth: request.headers.authorization })
      response.setHeader('content-type', 'application/json')
      response.end('{}')
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    sdk.setAccessToken('secret')
    expect(() => sdk.setBaseUrl('https://user:secret@example.test/api')).toThrow(ExAxiosError)
    expect(() => sdk.setAccessToken('bad\r\ntoken')).toThrow(ExAxiosError)
    await http({ url: '/ok' })
    await expect(http({ url: `${origin}/api-other` })).rejects.toMatchObject({
      code: 'CONFIG_ERROR',
    })
    expect(received).toEqual([{ url: '/api/ok', auth: 'Bearer secret' }])
  })

  it('rejects unknown runtime options and unsafe URL forms before any request', async () => {
    const received: string[] = []
    const origin = await fixture((request, response) => {
      received.push(request.url ?? '')
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{}')
    })
    const missing = testHttp({ alert: false })
    await expect(missing.request({ url: '/health' })).rejects.toMatchObject({
      code: 'CONFIG_ERROR',
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    for (const config of [
      { url: '/unsafe', adapter: 'fetch' },
      { url: '/unsafe', socketPath: '/tmp/socket' },
      { url: '/unsafe', headers: { Host: 'evil.test' } },
      { url: '/unsafe', timeout: -1 },
      { url: '/%2Fescape' },
      { url: '/..\\docs' },
    ])
      await expect(http(config as Parameters<typeof http>[0])).rejects.toMatchObject({
        code: 'CONFIG_ERROR',
      })
    expect(() => sdk.setBaseUrl('ftp://example.test/api')).toThrow(ExAxiosError)
    await http({ url: '/ok' })
    expect(received).toEqual(['/api/ok'])
  })

  it('encodes query parameters and rejects absolute targets on other ports', async () => {
    const received: Array<{ url: string; auth?: string }> = []
    const origin = await fixture((request, response) => {
      received.push({ url: request.url ?? '', auth: request.headers.authorization })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{}')
    })
    const other = await fixture((request, response) => {
      received.push({ url: request.url ?? '', auth: request.headers.authorization })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{}')
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    sdk.setAccessToken('secret')
    await http({ url: '/sp ace', params: { tag: ['a b', 'c'], omitted: undefined } })
    await expect(http({ url: `${other}/api/health` })).rejects.toMatchObject({
      code: 'CONFIG_ERROR',
    })
    expect(received).toEqual([{ url: '/api/sp%20ace?tag=a+b&tag=c', auth: 'Bearer secret' }])
  })

  it('lets the typed storage download carry an encoded slash in its query key over real HTTP', async () => {
    const received: string[] = []
    const origin = await fixture((request, response) => {
      received.push(request.url ?? '')
      response.writeHead(200, { 'content-type': 'application/octet-stream' })
      response.end(Buffer.from([3, 4, 5]))
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    const body = (await http({
      url: '/storage/files',
      params: { key: 'demo/file.bin' },
      responseType: 'arraybuffer',
    })) as ArrayBuffer
    expect([...new Uint8Array(body)]).toEqual([3, 4, 5])
    expect(received).toEqual(['/api/storage/files?key=demo%2Ffile.bin'])
    await expect(http({ url: '/storage%2Ffiles' })).rejects.toMatchObject({ code: 'CONFIG_ERROR' })
  })

  it('classifies the actual Axios fetch adapter deadline as TIMEOUT', async () => {
    const origin = await fixture((_request, _response) => {})
    const sdk = browserHttp(
      { environment: 'browser', origin },
      { baseUrl: `${origin}/api`, websiteBaseUrl: `${origin}/api`, alert: false },
    )
    const http = sdk.request
    await expect(http({ url: '/slow', timeout: 20 })).rejects.toMatchObject({
      kind: 'timeout',
      code: 'TIMEOUT',
    })
  })

  it('does not clear the local session for an unrelated explicit Authorization', async () => {
    const auth: string[] = []
    const origin = await fixture((request, response) => {
      auth.push(request.headers.authorization ?? '')
      if (request.url === '/api/ok') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end('{}')
        return
      }
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({ error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'r' } }),
      )
    })
    let expired = 0
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
      onSessionExpired: () => {
        expired++
      },
    })
    const http = sdk.request
    sdk.setAccessToken('internal')
    await expect(
      http({ url: '/expired', headers: { Authorization: 'Bearer other' } }),
    ).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    await http({ url: '/ok' })
    expect(expired).toBe(0)
    expect(auth).toEqual(['Bearer other', 'Bearer internal'])
  })

  it('classifies a JSON error and ignores a forged incoming request ID', async () => {
    const origin = await fixture((_request, response) => {
      response.writeHead(429, {
        'content-type': 'application/json',
        'x-request-id': 'header-id',
        'retry-after': '2',
      })
      response.end(
        JSON.stringify({
          error: { code: 'RATE_LIMITED', message: '请稍后重试', requestId: 'body-id' },
        }),
      )
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    await expect(http({ url: '/wait' })).rejects.toMatchObject({
      kind: 'http',
      code: 'RATE_LIMITED',
      status: 429,
      requestId: 'body-id',
      retryAfterSeconds: 2,
    })
  })

  it('handles one concurrent invalid session once and allows a newly supplied token', async () => {
    let count = 0
    const auth: string[] = []
    const origin = await fixture((request, response) => {
      auth.push(request.headers.authorization ?? '')
      if (request.url === '/api/ok') {
        response.setHeader('content-type', 'application/json')
        response.end('{}')
        return
      }
      response.setHeader('content-type', 'application/json')
      response.statusCode = 401
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: '登录状态已失效', requestId: 'req-1' },
        }),
      )
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
      onSessionExpired: () => {
        count++
      },
    })
    const http = sdk.request
    sdk.setAccessToken('old')
    const results = await Promise.allSettled([http({ url: '/expired' }), http({ url: '/expired' })])
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(count).toBe(1)
    sdk.setAccessToken('new')
    await http({ url: '/ok' })
    expect(auth).toEqual(['Bearer old', 'Bearer old', 'Bearer new'])
  })

  it('ignores a late invalid session from an older token revision', async () => {
    let release!: () => void, arrived!: () => void
    const reached = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const auth: string[] = []
    const origin = await fixture(async (request, response) => {
      auth.push(request.headers.authorization ?? '')
      if (request.url === '/api/slow') {
        arrived()
        await gate
        response.statusCode = 401
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({
            error: { code: 'SESSION_INVALID', message: '登录状态已失效', requestId: 'req-2' },
          }),
        )
      } else {
        response.setHeader('content-type', 'application/json')
        response.end('{}')
      }
    })
    let expired = 0
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
      onSessionExpired: () => {
        expired++
      },
    })
    const http = sdk.request
    sdk.setAccessToken('old')
    const pending = http({ url: '/slow' })
    await reached
    sdk.setAccessToken('new')
    release()
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    await http({ url: '/ok' })
    expect(expired).toBe(0)
    expect(auth).toEqual(['Bearer old', 'Bearer new'])
  })

  it('ignores a late 401 from an older website scope and can expire a newly set token', async () => {
    let release!: () => void, arrived!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reached = new Promise<void>((resolve) => {
      arrived = resolve
    })
    const oldOrigin = await fixture(async (_request, response) => {
      arrived()
      await gate
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'old' },
        }),
      )
    })
    const newAuth: string[] = []
    const newOrigin = await fixture((request, response) => {
      newAuth.push(request.headers.authorization ?? '')
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'new' },
        }),
      )
    })
    let expired = 0
    const sdk = testHttp({
      baseUrl: `${oldOrigin}/api`,
      websiteBaseUrl: `${oldOrigin}/api`,
      alert: false,
      onSessionExpired: () => {
        expired++
      },
    })
    const http = sdk.request
    sdk.setAccessToken('old-token')
    const pending = http({ url: '/slow' })
    await reached
    sdk.setBaseUrl(`${newOrigin}/api`)
    sdk.setAccessToken('new-token')
    release()
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(expired).toBe(0)
    await expect(http({ url: '/expire' })).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(expired).toBe(1)
    sdk.setAccessToken('another-token')
    await expect(http({ url: '/expire' })).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(expired).toBe(2)
    expect(newAuth).toEqual(['Bearer new-token', 'Bearer another-token'])
  })

  it('does not clear or navigate when a bound browser session becomes unreadable', async () => {
    let reads = 0,
      clears = 0,
      notifications = 0,
      navigations = 0
    const authorization: string[] = []
    const origin = await fixture((request, response) => {
      authorization.push(request.headers.authorization ?? '')
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'unreadable' },
        }),
      )
    })
    const sdk = browserHttp(
      {
        environment: 'browser',
        origin,
        readToken: () => {
          if (++reads === 1) return 'old-token'
          throw new Error('storage unavailable')
        },
        clearToken: () => {
          clears++
          return true
        },
        notify: () => {
          notifications++
        },
        navigate: () => {
          navigations++
        },
      },
      { baseUrl: `${origin}/api`, websiteBaseUrl: `${origin}/api` },
    )
    const http = sdk.request
    await expect(http({ url: '/expired' })).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(authorization).toEqual(['Bearer old-token'])
    expect(clears).toBe(0)
    expect(notifications).toBe(0)
    expect(navigations).toBe(0)
  })

  it('does not replace an explicit in-memory token with an unrelated persisted token', async () => {
    const authorization: string[] = []
    const origin = await fixture((request, response) => {
      authorization.push(request.headers.authorization ?? '')
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'manual' },
        }),
      )
    })
    let stored = 'persisted-token',
      clears = 0
    const sdk = browserHttp(
      {
        environment: 'browser',
        origin,
        readToken: () => stored,
        clearToken: () => {
          clears++
          stored = ''
          return true
        },
      },
      { baseUrl: `${origin}/api`, websiteBaseUrl: `${origin}/api`, alert: false },
    )
    const http = sdk.request
    sdk.setAccessToken('manual-token')
    await expect(http({ url: '/expired' })).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(authorization).toEqual(['Bearer manual-token'])
    expect(stored).toBe('persisted-token')
    expect(clears).toBe(0)
  })

  it('keeps network, cancellation, and timeout errors free of request details', async () => {
    const origin = await fixture((_request, _response) => {})
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(http({ url: '/cancel', signal: cancelled.signal })).rejects.toMatchObject({
      code: 'CANCELLED',
    })
    await expect(http({ url: '/timeout', timeout: 10 })).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('snapshots alert choice at send time and leaves callback errors behind', async () => {
    const messages: string[] = []
    const origin = await fixture((_request, response) => {
      response.statusCode = 503
      response.end('not-json')
    })
    const sdk = browserHttp(
      { environment: 'node', notify: (message) => messages.push(message) },
      { baseUrl: `${origin}/api`, websiteBaseUrl: `${origin}/api`, alert: false },
    )
    const http = sdk.request
    await expect(http({ url: '/silent' })).rejects.toBeInstanceOf(ExAxiosError)
    await expect(http({ url: '/loud', alert: true })).rejects.toMatchObject({ code: 'HTTP_ERROR' })
    expect(messages).toEqual(['请求失败，请稍后重试'])
  })

  it('rejects invalid success JSON and parses small binary errors and HTTP-date Retry-After', async () => {
    const retryDate = new Date(Date.now() + 30_000).toUTCString()
    const origin = await fixture((request, response) => {
      if (request.url === '/api/invalid') {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end('{invalid')
        return
      }
      response.writeHead(429, { 'content-type': 'application/json', 'retry-after': retryDate })
      response.end(
        JSON.stringify({
          error: { code: 'RATE_LIMITED', message: 'try later', requestId: 'binary-id' },
        }),
      )
    })
    const sdk = testHttp({
      baseUrl: `${origin}/api`,
      websiteBaseUrl: `${origin}/api`,
      alert: false,
    })
    const http = sdk.request
    await expect(http({ url: '/invalid' })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 200,
    })
    const error = await http({ url: '/binary', responseType: 'arraybuffer' }).then(
      () => {
        throw new Error('expected HTTP failure')
      },
      (value) => value as ExAxiosError,
    )
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429, requestId: 'binary-id' })
    expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(28)
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(30)
  })

  it('preserves the HTTP error when notification and session callbacks throw', async () => {
    const origin = await fixture((_request, response) => {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'safe-id' },
        }),
      )
    })
    const sdk = browserHttp(
      {
        environment: 'node',
        notify: () => {
          throw new Error('notify failed')
        },
      },
      {
        baseUrl: `${origin}/api`,
        websiteBaseUrl: `${origin}/api`,
        onSessionExpired: () => {
          throw new Error('callback failed')
        },
      },
    )
    sdk.setAccessToken('secret')
    await expect(sdk.request({ url: '/expired' })).rejects.toMatchObject({
      code: 'SESSION_INVALID',
      requestId: 'safe-id',
    })
  })
})
