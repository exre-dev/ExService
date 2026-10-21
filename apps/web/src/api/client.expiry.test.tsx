// @vitest-environment jsdom
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { instance } from '@workspace/sdk'
import { installSdkIntegration } from './client'
import {
  clearBrowserSession,
  readRawToken,
  readToken,
  subscribeSessionChanges,
  syncSessionToken,
  writeToken,
} from '../auth/storage'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { bindSettingsToken, settingsConfig } from '../settings/settingsConfig'
import { bindNotificationsToken, notificationsConfig } from '../notifications/notificationsConfig'

const fixture = vi.hoisted(() => ({ reset: () => {}, notify: vi.fn() }))
vi.mock('@workspace/sdk', async () => {
  const { createRuntime } = await import('../../../../packages/sdk/src/runtime')
  const { ExAxiosError } = await import('../../../../packages/sdk/src/http/errors')
  const create = () =>
    createRuntime({
      notify: fixture.notify,
      environment: 'browser',
      origin: window.location.origin,
      readToken: () => ({
        kind: 'known',
        value: window.localStorage.getItem(
          `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin)}`,
        ),
      }),
      clearToken: (expected) => {
        if (
          window.localStorage.getItem(
            `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin)}`,
          ) !== expected
        )
          return false
        window.localStorage.removeItem(
          `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin)}`,
        )
        return true
      },
    })
  let runtime = create()
  fixture.reset = () => {
    runtime = create()
  }
  return {
    ExAxiosError,
    instance: new Proxy(runtime.instance, {
      apply: (_target, receiver, args) => Reflect.apply(runtime.instance, receiver, args),
    }),
    setBaseUrl: (url: string) => runtime.setBaseUrl(url),
    setAccessToken: (token: string | null) => runtime.setAccessToken(token),
    setSessionExpiredHandler: (handler: Parameters<typeof runtime.setSessionExpiredHandler>[0]) =>
      runtime.setSessionExpiredHandler(handler),
  }
})
vi.mock('../pages/AuthPage/AuthBackdrop', () => ({ AuthBackdrop: () => null }))

let server: Server, dispose: (() => void) | undefined
let respond: (request: IncomingMessage, response: ServerResponse) => void
let storageUnavailable = false
const replace = vi.fn()
const requests: Array<{ url: string; authorization: string | undefined }> = []
const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}
const expired = (response: ServerResponse) =>
  json(response, 401, {
    msg: 'expired',
  })

beforeEach(async () => {
  storageUnavailable = false
  requests.length = 0
  replace.mockReset()
  fixture.notify.mockReset()
  respond = (_request, response) => expired(response)
  server = createServer((request, response) => {
    requests.push({ url: request.url!, authorization: request.headers.authorization })
    respond(request, response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected fixture TCP address')
  const original = window
  const location = {
    origin: `http://127.0.0.1:${address.port}`,
    pathname: '/account/profile',
    search: '',
    replace,
  }
  vi.stubGlobal(
    'window',
    new Proxy(original, {
      get(target, key) {
        if (key === 'location') return location
        if (key === 'localStorage' && storageUnavailable)
          throw new DOMException('Access denied', 'SecurityError')
        const value: unknown = Reflect.get(target, key)
        return (key === 'addEventListener' ||
          key === 'removeEventListener' ||
          key === 'getComputedStyle') &&
          typeof value === 'function'
          ? value.bind(target)
          : value
      },
    }),
  )
  vi.stubEnv('VITE_API_BASE_URL', `${location.origin}/backend`)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // Dialog observes viewport changes; jsdom does not implement matchMedia.
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: false,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => document.body,
  })
  fixture.reset()
  dispose = installSdkIntegration()
})
afterEach(async () => {
  storageUnavailable = false
  cleanup()
  dispose?.()
  vi.restoreAllMocks()
  clearBrowserSession()
  window.localStorage.clear()
  syncSessionToken()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

it('reconciles a successful persistent write and real explicit-source expiry before navigation', async () => {
  writeToken(window.localStorage, 'same-document-login')
  const observed: Array<string | null> = []
  const stop = subscribeSessionChanges(() => observed.push(readToken(window.localStorage)))
  try {
    await expect(instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
      code: 'HTTP_ERROR',
    })
    expect(requests[0]?.authorization).toBe('Bearer same-document-login')
    expect(readRawToken(window.localStorage)).toBeNull()
    expect(readToken(window.localStorage)).toBeNull()
    expect(observed).toEqual([null])
    expect(replace).toHaveBeenCalledExactlyOnceWith('/login')
    expect(fixture.notify).toHaveBeenCalledExactlyOnceWith('expired')
  } finally {
    stop()
  }
})

it('suppresses a matching expired write when deletion fails and permits a successful same-token login afterward', async () => {
  writeToken(window.localStorage, 'same-token')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  await expect(instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
    code: 'HTTP_ERROR',
  })
  expect(readRawToken(window.localStorage)).toBe('same-token')
  expect(readToken(window.localStorage)).toBeNull()
  expect(syncSessionToken()).toBeNull()
  expect(replace).not.toHaveBeenCalled()
  expect(fixture.notify).not.toHaveBeenCalled()
  remove.mockRestore()
  respond = (_request, response) => json(response, 200, { status: 'ok' })
  writeToken(window.localStorage, 'same-token')
  expect(readToken(window.localStorage)).toBe('same-token')
  await instance({ url: '/api/health', alert: false })
  expect(requests.at(-1)?.authorization).toBe('Bearer same-token')
})

it('preserves a new raw token arriving while the prior explicit-source request is pending', async () => {
  let release!: () => void, arrived!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const reached = new Promise<void>((resolve) => {
    arrived = resolve
  })
  respond = (_request, response) => {
    arrived()
    void gate.then(() => expired(response))
  }
  writeToken(window.localStorage, 'old-login')
  const pending = instance({ url: '/api/auth/me', alert: true })
  await reached
  window.localStorage.setItem(
    `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin + '/backend')}`,
    'new-cross-tab-token',
  )
  release()
  await expect(pending).rejects.toMatchObject({ code: 'HTTP_ERROR' })
  expect(readRawToken(window.localStorage)).toBe('new-cross-tab-token')
  expect(readToken(window.localStorage)).toBe('new-cross-tab-token')
  expect(replace).not.toHaveBeenCalled()
  expect(fixture.notify).not.toHaveBeenCalled()
})

it.each(['no-op', 'replacement'] as const)(
  'requires a second empty read after persistent delete: %s',
  async (mode) => {
    writeToken(window.localStorage, 'expired-token')
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      if (mode === 'replacement')
        window.localStorage.setItem(
          `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin + '/backend')}`,
          'replacement-token',
        )
    })
    await expect(instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
      status: 401,
    })
    expect(fixture.notify).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(readRawToken(window.localStorage)).toBe(
      mode === 'replacement' ? 'replacement-token' : 'expired-token',
    )
  },
)

function CurrentState() {
  return <p data-testid="auth-status">{useAuth().state.status}</p>
}
it.each(['throws', 'no-op'] as const)(
  'invalidates established private UI and caches when unrelated protected expiry deletion %s',
  async (mode) => {
    const account = {
      id: 42,
      username: 'Private account',
      avatar: null,
      email: 'private@example.test',
      qq: null,
      platform_role: 'user',
      last_login_time: null,
    }
    respond = (request, response) => {
      if (request.url?.endsWith('/api/auth/me')) json(response, 200, { msg: 'ok', data: account })
      else expired(response)
    }
    function PrivateContent() {
      const auth = useAuth()
      return (
        <>
          <p data-testid="auth-status">{auth.state.status}</p>
          {auth.state.status === 'authenticated' && (
            <p data-testid="private-content">Account {auth.userId}</p>
          )}
        </>
      )
    }
    writeToken(window.localStorage, 'established-token')
    render(
      <AuthProvider>
        <PrivateContent />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authenticated'))
    expect(screen.getByTestId('private-content').textContent).toBe('Account 42')
    bindSettingsToken('established-token')
    settingsConfig.profile.snapshot = account
    bindNotificationsToken('established-token')
    notificationsConfig.summary.unreadCount = 7
    notificationsConfig.summary.status = 'ready'
    const observed: Array<string | null> = []
    const stop = subscribeSessionChanges(() => observed.push(readToken(window.localStorage)))
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      if (mode === 'throws') throw new Error('denied')
    })
    try {
      await act(async () => {
        await expect(
          instance({ url: '/api/notifications/summary', alert: true }),
        ).rejects.toMatchObject({ status: 401 })
      })
      expect(readRawToken(window.localStorage)).toBe('established-token')
      expect(readToken(window.localStorage)).toBeNull()
      expect(observed).toEqual([null])
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous')
      expect(screen.queryByTestId('private-content')).toBeNull()
      expect(settingsConfig.profile.snapshot).toBeNull()
      expect(notificationsConfig.summary.unreadCount).toBe(0)
      expect(notificationsConfig.summary.status).toBe('idle')
      expect(fixture.notify).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      await expect(
        instance({ url: '/api/notifications/summary', alert: false }),
      ).rejects.toMatchObject({ status: 401 })
      expect(requests.at(-1)?.authorization).toBeUndefined()
      expect(requests.filter((request) => request.url.endsWith('/api/auth/me'))).toHaveLength(1)
      expect(fixture.notify).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
    } finally {
      stop()
    }
  },
)

it('invalidates established private UI and caches when the selected token becomes unreadable during expiry', async () => {
  const account = {
    id: 42,
    username: 'Private account',
    avatar: null,
    email: 'private@example.test',
    qq: null,
    platform_role: 'user',
    last_login_time: null,
  }
  respond = (request, response) => {
    if (request.url?.endsWith('/api/auth/me')) json(response, 200, { msg: 'ok', data: account })
    else expired(response)
  }
  function PrivateContent() {
    const auth = useAuth()
    return (
      <>
        <p data-testid="auth-status">{auth.state.status}</p>
        <p data-testid="auth-user-id">{auth.userId ?? 'none'}</p>
        {auth.state.status === 'authenticated' && (
          <p data-testid="private-content">Account {auth.userId}</p>
        )}
      </>
    )
  }
  const persistent = window.localStorage
  const selectedKey = `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin + '/backend')}`
  writeToken(persistent, 'established-token')
  // A mounted private consumer can subscribe before its parent AuthProvider.
  const stopPrivateSubscriber = subscribeSessionChanges(() => {
    readToken(window.localStorage)
  })
  render(
    <AuthProvider>
      <PrivateContent />
    </AuthProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authenticated'))
  bindSettingsToken('established-token')
  settingsConfig.profile.snapshot = account
  bindNotificationsToken('established-token')
  notificationsConfig.summary.unreadCount = 7
  notificationsConfig.summary.status = 'ready'

  const observed: Array<string | null | undefined> = []
  const stop = subscribeSessionChanges(() => {
    try {
      observed.push(readToken(window.localStorage))
    } catch {
      observed.push(undefined)
    }
  })
  const originalGet = Storage.prototype.getItem
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
    this: Storage,
    key,
  ) {
    if (this === persistent && key === selectedKey) throw new Error('unreadable token')
    return originalGet.call(this, key)
  })
  try {
    await act(async () => {
      await expect(
        instance({ url: '/api/notifications/summary', alert: true }),
      ).rejects.toMatchObject({
        status: 401,
      })
    })
    expect(requests.at(-1)?.authorization).toBe('Bearer established-token')
    expect(observed).toEqual([undefined])
    expect(screen.getByTestId('auth-status').textContent).toBe('unavailable')
    expect(screen.getByTestId('auth-user-id').textContent).toBe('none')
    expect(screen.queryByTestId('private-content')).toBeNull()
    expect(settingsConfig.profile.snapshot).toBeNull()
    expect(notificationsConfig.summary.unreadCount).toBe(0)
    expect(notificationsConfig.summary.status).toBe('idle')
    expect(fixture.notify).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    await expect(
      instance({ url: '/api/notifications/summary', alert: false }),
    ).rejects.toMatchObject({
      status: 401,
    })
    expect(requests.at(-1)?.authorization).toBeUndefined()
  } finally {
    read.mockRestore()
    stop()
    stopPrivateSubscriber()
  }
  expect(readRawToken(persistent)).toBe('established-token')
  expect(readToken(persistent)).toBeNull()
  expect(requests.filter((request) => request.url.endsWith('/api/auth/me'))).toHaveLength(1)
  act(() => {
    expect(syncSessionToken()).toBeNull()
  })
  expect(screen.getByTestId('auth-status').textContent).toBe('anonymous')
  act(() => writeToken(persistent, 'new-login'))
  await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('authenticated'))
  expect(screen.getByTestId('private-content').textContent).toBe('Account 42')
  expect(
    requests.filter((request) => request.url.endsWith('/api/auth/me')).at(-1)?.authorization,
  ).toBe('Bearer new-login')
  expect(fixture.notify).not.toHaveBeenCalled()
  expect(replace).not.toHaveBeenCalled()
})

it('keeps the actual AuthProvider anonymous after post-write expiry without restoring the retained token', async () => {
  render(
    <AuthProvider>
      <CurrentState />
    </AuthProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('anonymous'))
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  act(() => writeToken(window.localStorage, 'provider-login'))
  await waitFor(() => expect(requests).toHaveLength(1))
  await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('anonymous'))
  expect(readToken(window.localStorage)).toBeNull()
  act(() => {
    syncSessionToken()
  })
  expect(screen.getByTestId('auth-status').textContent).toBe('anonymous')
  expect(requests).toHaveLength(1)
  remove.mockRestore()
})

it.each(['owned-login', 'replacement-login'])(
  'retains precise owned expiry suppression across a denied storage getter, then recovers %s',
  async (recoveredToken) => {
    const persistent = window.localStorage
    writeToken(persistent, 'owned-login')
    const observed: Array<string | null | undefined> = []
    const stop = subscribeSessionChanges(() => {
      try {
        observed.push(readToken(window.localStorage))
      } catch {
        observed.push(undefined)
      }
    })
    try {
      storageUnavailable = true
      await expect(instance({ url: '/api/auth/me', alert: true })).rejects.toMatchObject({
        code: 'HTTP_ERROR',
      })
      persistent.setItem(
        `exwebsite.php.auth.v1:${encodeURIComponent(window.location.origin + '/backend')}`,
        recoveredToken,
      )
      storageUnavailable = false
      expect(requests[0]?.authorization).toBe('Bearer owned-login')
      expect(readRawToken(persistent)).toBe(recoveredToken)
      expect(readToken(persistent)).toBe(recoveredToken === 'owned-login' ? null : recoveredToken)
      expect(observed).toEqual([undefined])
      expect(fixture.notify).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
    } finally {
      storageUnavailable = false
      stop()
    }
  },
)
