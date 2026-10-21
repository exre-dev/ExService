// @vitest-environment jsdom
import { createServer, type Server } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
// jsdom resolves Node exports. Inject the private browser environment to test the
// application wiring; real conditional Browser exports are covered independently.
vi.mock('@workspace/sdk', async () => {
  const { createRuntime } = await import('../../../../packages/sdk/src/runtime')
  const create = (origin: string) =>
    createRuntime({
      environment: 'browser',
      origin,
      readToken: () => {
        try {
          return {
            kind: 'known',
            value: window.localStorage.getItem(
              `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
            ),
          }
        } catch {
          return { kind: 'unavailable' }
        }
      },
      clearToken: (expected) => {
        if (
          window.localStorage.getItem(
            `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
          ) !== expected
        )
          return false
        window.localStorage.removeItem(
          `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
        )
        return true
      },
    })
  let runtime = create(window.location.origin)
  return {
    instance: new Proxy(runtime.instance, {
      apply: (_target, receiver, args) => Reflect.apply(runtime.instance, receiver, args),
    }),
    setBaseUrl: (url: string) => {
      runtime = create(new URL(url).origin)
      runtime.setBaseUrl(url)
    },
    setAccessToken: (token: string | null) => runtime.setAccessToken(token),
    setSessionExpiredHandler: (handler: Parameters<typeof runtime.setSessionExpiredHandler>[0]) =>
      runtime.setSessionExpiredHandler(handler),
  }
})
let disposeIntegration: (() => void) | undefined

let server: Server | undefined
afterEach(async () => {
  disposeIntegration?.()
  disposeIntegration = undefined
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  window.localStorage.clear()
  if (server) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = undefined
  }
})

it.each(['/support', '/support/errors/guide?via=direct#step', '/support/unknown'])(
  'retains an expired Support deep link while clearing and notifying the real session: %s',
  async (path) => {
    server = createServer((_request, response) => {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          msg: 'expired',
        }),
      )
    })
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('expected fixture TCP address')
    vi.stubEnv('VITE_API_BASE_URL', `http://127.0.0.1:${address.port}`)
    window.history.replaceState({}, '', path)
    window.localStorage.setItem(
      `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
      'current-token',
    )
    const location = window.location
    const replace = vi.fn()
    // jsdom cannot navigate; expose navigation as an observable browser boundary.
    vi.stubGlobal('window', {
      localStorage: window.localStorage,
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
      location: {
        origin: `http://127.0.0.1:${address.port}`,
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        replace,
      },
    })
    vi.resetModules()
    const { installSdkIntegration } = await import('@web/src/api/client')
    const { instance } = await import('@workspace/sdk')
    disposeIntegration = installSdkIntegration()
    const { subscribeSessionChanges, readToken } = await import('@web/src/auth/storage')
    const observed: Array<string | null> = []
    const unsubscribe = subscribeSessionChanges(() => observed.push(readToken(window.localStorage)))
    try {
      await expect(
        instance({ url: '/api/auth/me', method: 'GET', alert: false }),
      ).rejects.toMatchObject({ code: 'HTTP_ERROR' })
      expect(
        window.localStorage.getItem(
          `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
        ),
      ).toBeNull()
      expect(observed).toEqual([null])
      expect(replace).not.toHaveBeenCalled()
      expect(location.pathname + location.search + location.hash).toBe(path)
    } finally {
      unsubscribe()
    }
  },
)

it('keeps the existing expiry redirect for similarly prefixed non-Support routes', async () => {
  server = createServer((_request, response) => {
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        msg: 'expired',
      }),
    )
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected fixture TCP address')
  vi.stubEnv('VITE_API_BASE_URL', `http://127.0.0.1:${address.port}`)
  window.history.replaceState({}, '', '/support-other')
  window.localStorage.setItem(
    `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
    'current-token',
  )
  const replace = vi.fn()
  vi.stubGlobal('window', {
    localStorage: window.localStorage,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    location: {
      origin: `http://127.0.0.1:${address.port}`,
      pathname: '/support-other',
      search: '',
      replace,
    },
  })
  vi.resetModules()
  const { installSdkIntegration } = await import('@web/src/api/client')
  const { instance } = await import('@workspace/sdk')
  disposeIntegration = installSdkIntegration()
  await expect(
    instance({ url: '/api/auth/me', method: 'GET', alert: false }),
  ).rejects.toMatchObject({
    code: 'HTTP_ERROR',
  })
  expect(replace).toHaveBeenCalledWith('/login')
})

it('keeps a newer cross-tab session when an old Web API request expires before its storage event', async () => {
  let arrived!: () => void, release!: () => void
  const reached = new Promise<void>((resolve) => {
    arrived = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const authorization: string[] = []
  server = createServer(async (request, response) => {
    authorization.push(request.headers.authorization ?? '')
    response.setHeader('content-type', 'application/json')
    if (authorization.length === 1) {
      arrived()
      await gate
      response.statusCode = 401
      response.end(
        JSON.stringify({
          msg: 'expired',
        }),
      )
    } else response.end(JSON.stringify({ msg: 'ok', data: { status: 'ok' } }))
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected fixture TCP address')
  vi.stubEnv('VITE_API_BASE_URL', `http://127.0.0.1:${address.port}`)
  window.history.replaceState({}, '', '/login')
  window.localStorage.setItem(
    `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
    'old-token',
  )
  vi.stubGlobal('window', {
    localStorage: window.localStorage,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    location: {
      origin: `http://127.0.0.1:${address.port}`,
      pathname: '/login',
      search: '',
      replace: vi.fn(),
    },
  })
  vi.resetModules()
  const { installSdkIntegration } = await import('@web/src/api/client')
  const { instance } = await import('@workspace/sdk')
  disposeIntegration = installSdkIntegration()
  const pending = instance({ url: '/api/auth/me', method: 'GET', alert: false })
  await reached
  window.localStorage.setItem(
    `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
    'new-token',
  )
  release()
  await expect(pending).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  expect(
    window.localStorage.getItem(
      `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
    ),
  ).toBe('new-token')
  await expect(instance({ url: '/api/auth/me', method: 'GET', alert: false })).resolves.toEqual({
    msg: 'ok',
    data: { status: 'ok' },
  })
  expect(authorization).toEqual(['Bearer old-token', 'Bearer new-token'])
})

it('clears a matching persisted session and notifies the bound Web session', async () => {
  const authorization: string[] = []
  server = createServer((request, response) => {
    authorization.push(request.headers.authorization ?? '')
    response.writeHead(401, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        msg: 'expired',
      }),
    )
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected fixture TCP address')
  vi.stubEnv('VITE_API_BASE_URL', `http://127.0.0.1:${address.port}`)
  window.history.replaceState({}, '', '/login?ssoRequestId=keep-this-container')
  window.localStorage.setItem(
    `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
    'current-token',
  )
  vi.stubGlobal('window', {
    localStorage: window.localStorage,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    location: {
      origin: `http://127.0.0.1:${address.port}`,
      pathname: '/login',
      search: '?ssoRequestId=keep-this-container',
      replace: vi.fn(),
    },
  })
  vi.resetModules()
  const { installSdkIntegration } = await import('@web/src/api/client')
  const { instance } = await import('@workspace/sdk')
  disposeIntegration = installSdkIntegration()
  const { subscribeSessionChanges, readToken } = await import('@web/src/auth/storage')
  const observed: Array<string | null> = []
  const unsubscribe = subscribeSessionChanges(() => observed.push(readToken(window.localStorage)))
  try {
    await expect(
      instance({ url: '/api/auth/me', method: 'GET', alert: false }),
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
    })
    expect(authorization).toEqual(['Bearer current-token'])
    expect(
      window.localStorage.getItem(
        `exwebsite.php.auth.v1:${encodeURIComponent(import.meta.env.VITE_API_BASE_URL || window.location.origin)}`,
      ),
    ).toBeNull()
    expect(observed).toEqual([null])
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('?ssoRequestId=keep-this-container')
  } finally {
    unsubscribe()
  }
})
