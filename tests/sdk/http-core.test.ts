import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { createRuntime } from '@sdk/src/runtime'

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
async function service(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw Error('Missing address')
  return `http://127.0.0.1:${address.port}`
}
function json(res: ServerResponse, status: number, body: unknown, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

it('joins a deployment prefix with the complete PHP path, serializes inputs and returns the native envelope', async () => {
  const seen: Array<{
    url: string
    authorization: string | undefined
    cookie: string | undefined
  }> = []
  const origin = await service((req, res) => {
    seen.push({
      url: req.url ?? '',
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
    })
    json(res, 200, { msg: 'ok', data: { status: 'ok' } })
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(`${origin}/backend`)
  sdk.setAccessToken('site-token')
  const request = sdk.instance as (config: Record<string, unknown>) => Promise<unknown>
  expect(await request({ url: '/api/health' })).toEqual({ msg: 'ok', data: { status: 'ok' } })
  await request({
    url: '/api/notifications/{notificationId}',
    pathParams: { notificationId: 'a b' },
    params: { mode: 'x/y' },
  })
  expect(seen).toEqual([
    { url: '/backend/api/health', authorization: 'Bearer site-token', cookie: undefined },
    {
      url: '/backend/api/notifications/a%20b?mode=x%2Fy',
      authorization: 'Bearer site-token',
      cookie: undefined,
    },
  ])
})

it('rejects undeclared operations and unsafe paths before sending a credential', async () => {
  let calls = 0
  const origin = await service((_req, res) => {
    calls++
    json(res, 200, {})
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(`${origin}/backend`)
  sdk.setAccessToken('site-token')
  const request = sdk.instance as (config: Record<string, unknown>) => Promise<unknown>
  for (const config of [
    { url: '/api/missing' },
    { url: '/api/auth/login', method: 'GET' },
    { url: '/api/notifications/{notificationId}', pathParams: { notificationId: '..' } },
    { url: '/api/health', headers: { Authorization: 'a', authorization: 'b' } },
    { url: '/api/health', adapter: 'http' },
    { url: '/api/health', params: { unsafe: { nested: 'value' } } },
  ])
    await expect(request(config)).rejects.toMatchObject({ code: 'CONFIG_ERROR' })
  expect(calls).toBe(0)
})

it('accepts only small JSON {msg} business errors and keeps real status and Retry-After', async () => {
  let mode = 'valid'
  const origin = await service((_req, res) => {
    if (mode === 'html') {
      res.writeHead(500, { 'content-type': 'text/html' })
      res.end('<h1>secret</h1>')
      return
    }
    if (mode === 'unknown') {
      json(res, 500, { message: 'secret' })
      return
    }
    if (mode === 'large') {
      json(res, 500, { msg: 'secret'.repeat(12000) })
      return
    }
    json(res, 429, { msg: '请稍后重试' }, { 'retry-after': '5' })
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  const request = sdk.instance as (config: Record<string, unknown>) => Promise<unknown>
  await expect(request({ url: '/api/health', responseType: 'blob' })).rejects.toMatchObject({
    kind: 'http',
    code: 'HTTP_ERROR',
    status: 429,
    message: '请稍后重试',
    retryAfterSeconds: 5,
  })
  for (mode of ['html', 'unknown', 'large'])
    await expect(
      request({ url: '/api/health', responseType: 'arraybuffer' }),
    ).rejects.toMatchObject({ code: 'HTTP_ERROR', message: '请求失败，请稍后重试', status: 500 })
})

it('accepts exactly 64 KiB of JSON error bytes and rejects the next byte', async () => {
  const empty = JSON.stringify({ msg: '' })
  let size = 65_536
  const origin = await service((_req, res) =>
    json(res, 401, { msg: 'x'.repeat(size - Buffer.byteLength(empty)) }),
  )
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  for (const responseType of ['blob', 'arraybuffer'] as const) {
    await expect(sdk.instance({ url: '/api/health', responseType })).rejects.toMatchObject({
      message: 'x'.repeat(size - Buffer.byteLength(empty)),
      status: 401,
    })
    size = 65_537
    await expect(sdk.instance({ url: '/api/health', responseType })).rejects.toMatchObject({
      message: '请求失败，请稍后重试',
      status: 401,
    })
    size = 65_536
  }
})

it('expires only a protected 401 for the current token, preserving anonymous and foreign Authorization failures', async () => {
  const seen: string[] = []
  const origin = await service((req, res) => {
    seen.push(req.headers.authorization ?? '')
    json(res, req.url === '/api/auth/me' || req.url === '/api/auth/login' ? 401 : 403, {
      msg: '凭据错误',
    })
  })
  let token: string | null = 'current',
    cleared = 0,
    expired = 0
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    readToken: () => ({ kind: 'known', value: token }),
    clearToken: (expected) => {
      if (token !== expected) return false
      token = null
      cleared++
      return true
    },
  })
  sdk.setSessionExpiredHandler(() => {
    expired++
  })
  const request = sdk.instance as (config: Record<string, unknown>) => Promise<unknown>
  await expect(request({ url: '/api/auth/login', method: 'POST' })).rejects.toMatchObject({
    status: 401,
  })
  await expect(
    request({ url: '/api/auth/me', headers: { Authorization: 'Bearer other' } }),
  ).rejects.toMatchObject({ status: 401 })
  await expect(request({ url: '/api/health' })).rejects.toMatchObject({ status: 403 })
  expect(token).toBe('current')
  expect(cleared).toBe(0)
  await expect(request({ url: '/api/auth/me', alert: false })).rejects.toMatchObject({
    code: 'HTTP_ERROR',
    status: 401,
  })
  expect(token).toBeNull()
  expect(cleared).toBe(1)
  expect(expired).toBe(1)
  expect(seen).toEqual(['Bearer current', 'Bearer other', 'Bearer current', 'Bearer current'])
})

it('does not clear a replacement credential after a late protected 401', async () => {
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const origin = await service(async (_req, res) => {
    await gate
    json(res, 401, { msg: '过期' })
  })
  let token: string | null = 'old',
    cleared = 0
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    readToken: () => ({ kind: 'known', value: token }),
    clearToken: () => {
      cleared++
      token = null
      return true
    },
  })
  const pending = sdk.instance({ url: '/api/auth/me' })
  token = 'new'
  release?.()
  await expect(pending).rejects.toMatchObject({ status: 401 })
  expect(token).toBe('new')
  expect(cleared).toBe(0)
})

it('does not clear a token on a new service root after a late 401', async () => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const origin = await service(async (_req, res) => {
    await gate
    json(res, 401, { msg: 'expired' })
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('old')
  let expired = 0
  sdk.setSessionExpiredHandler(() => {
    expired++
  })
  const pending = sdk.instance({ url: '/api/auth/me' })
  sdk.setBaseUrl(`${origin}/other`)
  sdk.setAccessToken('new')
  release()
  await expect(pending).rejects.toMatchObject({ status: 401 })
  expect(expired).toBe(0)
})

it('preserves the HTTP error when notification and session handlers throw', async () => {
  const origin = await service((_req, res) => json(res, 401, { msg: 'expired' }))
  let token: string | null = 'current'
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    readToken: () => ({ kind: 'known', value: token }),
    clearToken: (expected) => {
      if (token !== expected) return false
      token = null
      return true
    },
    notify: () => {
      throw Error('notification failure')
    },
  })
  sdk.setSessionExpiredHandler(() => {
    throw Error('handler failure')
  })
  await expect(sdk.instance({ url: '/api/auth/me' })).rejects.toMatchObject({
    code: 'HTTP_ERROR',
    status: 401,
    message: 'expired',
  })
  expect(token).toBeNull()
})

it('rejects redirects and classifies cancellation without exposing transport details', async () => {
  const origin = await service((_req, res) => {
    res.writeHead(302, { location: 'https://outside.example/steal' })
    res.end()
  })
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  sdk.setAccessToken('private')
  await expect(sdk.instance({ url: '/api/health' })).rejects.toMatchObject({
    kind: 'http',
    status: 302,
  })
  const controller = new AbortController()
  controller.abort()
  await expect(
    sdk.instance({ url: '/api/health', signal: controller.signal }),
  ).rejects.toMatchObject({ kind: 'cancelled', code: 'CANCELLED' })
})

it('classifies a real request deadline as TIMEOUT', async () => {
  const origin = await service((_req, _res) => {})
  const sdk = createRuntime({ environment: 'node' })
  sdk.setBaseUrl(origin)
  await expect(sdk.instance({ url: '/api/health', timeout: 20 })).rejects.toMatchObject({
    kind: 'timeout',
    code: 'TIMEOUT',
  })
})

it('does not notify or navigate if persisted token removal cannot be confirmed', async () => {
  const origin = await service((_req, res) => json(res, 401, { msg: 'expired' }))
  let token: string | null = 'old',
    notified = 0,
    navigated = 0
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    readToken: () => ({ kind: 'known', value: token }),
    clearToken: () => {
      token = 'new'
      return true
    },
    notify: () => {
      notified++
    },
    navigate: () => {
      navigated++
    },
  })
  await expect(sdk.instance({ url: '/api/auth/me' })).rejects.toMatchObject({ status: 401 })
  expect(token).toBe('new')
  expect(notified).toBe(0)
  expect(navigated).toBe(0)
})

it.each(['false', 'true', 'void', 'throw'] as const)(
  'handles explicit-root 401 with %s session handler before any alert',
  async (outcome) => {
    const origin = await service((_req, res) => json(res, 401, { msg: 'expired' }))
    const events: string[] = []
    const sdk = createRuntime({
      environment: 'browser',
      origin,
      notify: () => {
        events.push('notify')
      },
      navigate: () => {
        events.push('navigate')
      },
    })
    sdk.setBaseUrl(`${origin}/backend`)
    sdk.setAccessToken('persisted-token')
    sdk.setSessionExpiredHandler(() => {
      events.push('handler')
      if (outcome === 'throw') throw Error('cleanup failed')
      if (outcome === 'false') return false
      if (outcome === 'true') return true
    })
    await expect(sdk.instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 401,
    })
    expect(events).toEqual(
      outcome === 'true' || outcome === 'void' ? ['handler', 'notify'] : ['handler'],
    )
  },
)

it('notifies once for concurrent protected 401s only after a successful handler', async () => {
  const origin = await service((_req, res) => json(res, 401, { msg: 'expired' }))
  const events: string[] = []
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    notify: () => {
      events.push('notify')
    },
  })
  sdk.setBaseUrl(`${origin}/backend`)
  sdk.setAccessToken('persisted-token')
  sdk.setSessionExpiredHandler(() => {
    events.push('handler')
    return true
  })
  const responses = await Promise.allSettled([
    sdk.instance({ url: '/api/auth/me', alert: true }),
    sdk.instance({ url: '/api/auth/me', alert: true }),
  ])
  expect(
    responses.every((result) => result.status === 'rejected' && result.reason.status === 401),
  ).toBe(true)
  expect(events).toEqual(['handler', 'notify'])
})

it('keeps Promise handlers nonblocking while deferring alert until confirmation', async () => {
  const origin = await service((_req, res) => json(res, 401, { msg: 'expired' }))
  let confirm!: (value: boolean | void) => void
  const confirmation = new Promise<boolean | void>((resolve) => {
    confirm = resolve
  })
  const events: string[] = []
  const sdk = createRuntime({
    environment: 'browser',
    origin,
    notify: () => {
      events.push('notify')
    },
  })
  sdk.setBaseUrl(`${origin}/backend`)
  sdk.setAccessToken('persisted-token')
  sdk.setSessionExpiredHandler(() => {
    events.push('handler')
    return confirmation
  })
  await expect(sdk.instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
    status: 401,
  })
  expect(events).toEqual(['handler'])
  confirm(undefined)
  await confirmation
  await Promise.resolve()
  expect(events).toEqual(['handler', 'notify'])
})

it('suppresses alert after an asynchronous veto or rejection without replacing the 401', async () => {
  for (const outcome of [false, 'reject'] as const) {
    const origin = await service((_req, res) => json(res, 401, { msg: 'expired' }))
    const events: string[] = []
    const sdk = createRuntime({
      environment: 'browser',
      origin,
      notify: () => {
        events.push('notify')
      },
    })
    sdk.setBaseUrl(`${origin}/backend`)
    sdk.setAccessToken('persisted-token')
    sdk.setSessionExpiredHandler(() =>
      outcome === false ? Promise.resolve(false) : Promise.reject(Error('cleanup failed')),
    )
    await expect(sdk.instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 401,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual([])
  }
})
