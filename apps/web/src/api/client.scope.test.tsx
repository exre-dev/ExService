// @vitest-environment jsdom
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { Blob as NativeBlob, File as NativeFile } from 'node:buffer'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { components } from '@workspace/sdk/types'

// Select the real Browser entry in jsdom, whose default package condition is Node.
function selectBrowserEntry() {
  vi.doMock('@workspace/sdk', async () => import('../../../../packages/sdk/src/browser'))
}
vi.mock('../pages/AuthPage/AuthBackdrop', () => ({ AuthBackdrop: () => null }))

let server: Server
let dispose: (() => void) | undefined
let root: string
let respond: (request: IncomingMessage, response: ServerResponse) => void
let storageUnavailable = false
const requests: Array<{ url: string; authorization: string | undefined }> = []
const replace = vi.fn()
const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}
const expired = (response: ServerResponse) =>
  json(response, 401, {
    error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'scope-fixture' },
  })

async function install(base = '/custom-api') {
  vi.stubEnv('VITE_API_BASE_URL', base)
  const { installSdkIntegration } = await import('./client')
  dispose = installSdkIntegration()
  return import('../auth/storage')
}
async function request() {
  return (await import('@workspace/sdk')).instance({ url: '/auth/me', alert: false })
}
async function reload(base = '/custom-api') {
  cleanup()
  dispose?.()
  vi.resetModules()
  selectBrowserEntry()
  return install(base)
}
beforeEach(async () => {
  vi.resetModules()
  selectBrowserEntry()
  requests.length = 0
  replace.mockReset()
  storageUnavailable = false
  window.localStorage.clear()
  window.sessionStorage.clear()
  respond = (_request, response) =>
    json(response, 200, { nickname: 'Scoped account', avatarUrl: null })
  server = createServer((request, response) => {
    requests.push({ url: request.url!, authorization: request.headers.authorization })
    respond(request, response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP fixture')
  root = `http://127.0.0.1:${address.port}`
  const location = {
    origin: root,
    href: `${root}/account/profile`,
    pathname: '/account/profile',
    search: '',
    replace,
  }
  vi.stubGlobal('location', location)
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
  const original = window
  vi.stubGlobal(
    'window',
    new Proxy(original, {
      get(target, key) {
        if (key === 'location') return location
        if (key === 'localStorage' && storageUnavailable)
          throw new DOMException('denied', 'SecurityError')
        const value: unknown = Reflect.get(target, key)
        return (key === 'addEventListener' ||
          key === 'removeEventListener' ||
          key === 'dispatchEvent') &&
          typeof value === 'function'
          ? value.bind(target)
          : value
      },
    }),
  )
})
afterEach(async () => {
  storageUnavailable = false
  cleanup()
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

it('restores a persisted custom login into the real Browser SDK before AuthProvider renders after reload', async () => {
  const storage = await install()
  window.localStorage.setItem(storage.AUTH_TOKEN_KEY, 'default-account')
  storage.writeToken(window.localStorage, 'custom-account')
  await reload(`${root}/custom-api///`)
  const { AuthProvider, useAuth } = await import('../auth/AuthContext')
  function State() {
    return <p data-testid="state">{useAuth().state.status}</p>
  }
  render(
    <AuthProvider>
      <State />
    </AuthProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('authenticated'))
  expect(requests).toEqual([{ url: '/custom-api/auth/me', authorization: 'Bearer custom-account' }])
  expect(window.localStorage.getItem(storage.AUTH_TOKEN_KEY)).toBe('default-account')
})

function keyFor(token: string): string {
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)!
    if (window.localStorage.getItem(key) === token) return key
  }
  throw new Error('Expected persisted fixture token')
}
function storageEvent(key: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea: window.localStorage }))
}

it('isolates origins and paths, normalizes equivalent roots, and returns to automatic default reads', async () => {
  const storage = await install()
  window.localStorage.setItem(storage.AUTH_TOKEN_KEY, 'default-token')
  await request()
  expect(requests.at(-1)?.authorization).toBeUndefined()
  storage.writeToken(window.localStorage, 'custom-A')
  const keyA = keyFor('custom-A')
  const oldDispose = dispose!
  await install('/custom-B')
  expect(storage.readRawToken(window.localStorage)).toBeNull()
  await request()
  expect(requests.at(-1)?.authorization).toBeUndefined()
  storage.writeToken(window.localStorage, 'custom-B')
  await install(`http://localhost:${new URL(root).port}/custom-api`)
  expect(storage.readRawToken(window.localStorage)).toBeNull()
  storage.writeToken(window.localStorage, 'other-origin')
  await install(`${root}/custom-api///`)
  expect(storage.readToken(window.localStorage)).toBe('custom-A')
  expect(keyFor('custom-A')).toBe(keyA)
  oldDispose() // An obsolete HMR disposer cannot remove the active handler/listener.
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer custom-A')
  await install('')
  await request()
  expect(requests.at(-1)).toEqual({ url: '/api/auth/me', authorization: 'Bearer default-token' })
  window.localStorage.setItem(storage.AUTH_TOKEN_KEY, 'automatic-replacement')
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer automatic-replacement')
  expect(window.localStorage.getItem(keyA)).toBe('custom-A')
})

it('validates a new root before changing scope or credentials', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'custom-A')
  await expect(install('https://user:password@example.test/api')).rejects.toMatchObject({
    code: 'CONFIG_ERROR',
  })
  expect(storage.readToken(window.localStorage)).toBe('custom-A')
  await request()
  expect(requests.at(-1)).toEqual({ url: '/custom-api/auth/me', authorization: 'Bearer custom-A' })
})

it('synchronizes cross-tab replacement, removal and clear before requests while ignoring unrelated events', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'old-custom')
  const key = keyFor('old-custom')
  const changed = vi.fn()
  const unsubscribe = storage.subscribeSessionChanges(changed)
  window.localStorage.setItem(key, 'new-custom')
  storageEvent(storage.AUTH_TOKEN_KEY)
  await request()
  expect(changed).not.toHaveBeenCalled()
  expect(requests.at(-1)?.authorization).toBe('Bearer old-custom')
  storageEvent(key)
  await request()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(requests.at(-1)?.authorization).toBe('Bearer new-custom')
  window.localStorage.removeItem(key)
  storageEvent(key)
  await request()
  expect(requests.at(-1)?.authorization).toBeUndefined()
  storage.writeToken(window.localStorage, 'clear-custom')
  window.localStorage.clear()
  storageEvent(null)
  await request()
  expect(requests.at(-1)?.authorization).toBeUndefined()
  unsubscribe()
})

it('expires restored custom credentials without deleting default or another root', async () => {
  let storage = await install('/custom-B')
  storage.writeToken(window.localStorage, 'custom-B')
  const keyB = keyFor('custom-B')
  storage = await install()
  window.localStorage.setItem(storage.AUTH_TOKEN_KEY, 'default-token')
  storage.writeToken(window.localStorage, 'expired-custom')
  const keyA = keyFor('expired-custom')
  storage = await reload()
  respond = (_request, response) => expired(response)
  await expect(request()).rejects.toMatchObject({ code: 'SESSION_INVALID' })
  expect(requests.at(-1)?.authorization).toBe('Bearer expired-custom')
  expect(storage.readToken(window.localStorage)).toBeNull()
  expect(window.localStorage.getItem(keyA)).toBeNull()
  expect(window.localStorage.getItem(keyB)).toBe('custom-B')
  expect(window.localStorage.getItem(storage.AUTH_TOKEN_KEY)).toBe('default-token')
  expect(replace).toHaveBeenCalledWith('/login')
})

it.each(['logout', 'expiry'] as const)(
  'keeps failed %s deletion suppressed across A/B/A switches and allows same-token relogin',
  async (action) => {
    let storage = await install()
    storage.writeToken(window.localStorage, 'same-token')
    const key = keyFor('same-token')
    storage = await reload()
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    if (action === 'logout') storage.clearBrowserSession()
    else {
      respond = (_request, response) => expired(response)
      await expect(request()).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    }
    expect(storage.readRawToken(window.localStorage)).toBe('same-token')
    expect(storage.readToken(window.localStorage)).toBeNull()
    await install('/custom-B')
    storage.writeToken(window.localStorage, 'B-token')
    await install()
    expect(storage.readToken(window.localStorage)).toBeNull()
    respond = (_request, response) => json(response, 200, { status: 'ok' })
    await request()
    expect(requests.at(-1)?.authorization).toBeUndefined()
    expect(window.localStorage.getItem(key)).toBe('same-token')
    remove.mockRestore()
    storage.writeToken(window.localStorage, 'same-token')
    await request()
    expect(requests.at(-1)?.authorization).toBe('Bearer same-token')
  },
)

it.each(['getItem', 'accessor'] as const)(
  'does not borrow default credentials when scoped storage %s fails on startup',
  async (failure) => {
    const persistent = window.localStorage
    persistent.setItem('exwebsite.auth.token', 'default-token')
    let read: ReturnType<typeof vi.spyOn> | undefined
    if (failure === 'accessor') storageUnavailable = true
    else
      read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied')
      })
    const storage = await install()
    expect(storage.syncSessionToken()).toBeUndefined()
    await request()
    expect(requests.at(-1)?.authorization).toBeUndefined()
    read?.mockRestore()
    storageUnavailable = false
    expect(storage.readToken(persistent)).toBeNull()
    expect(persistent.getItem('exwebsite.auth.token')).toBe('default-token')
  },
)

it('leaves the installed credential unchanged when scoped persistence rejects a login write', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'current-custom')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied')
  })
  expect(() => storage.writeToken(window.localStorage, 'failed-login')).toThrow('denied')
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer current-custom')
  expect(storage.readToken(window.localStorage)).toBe('current-custom')
})

it('preserves a replacement raw token when restored custom expiry arrives before its storage event', async () => {
  let storage = await install()
  storage.writeToken(window.localStorage, 'old-custom')
  const key = keyFor('old-custom')
  storage = await reload()
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
  const pending = request()
  await reached
  window.localStorage.setItem(key, 'replacement-custom')
  release()
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_INVALID' })
  expect(storage.readToken(window.localStorage)).toBe('replacement-custom')
  expect(replace).not.toHaveBeenCalled()
  respond = (_request, response) => json(response, 200, { status: 'ok' })
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer replacement-custom')
})

it('does not let an old root response expire an equal-token new root or a stale disposer remove its handler', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'shared-string')
  const disposeA = dispose!
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
  const pending = request()
  await reached
  await install('/custom-B')
  storage.writeToken(window.localStorage, 'shared-string')
  disposeA()
  release()
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_INVALID' })
  expect(storage.readToken(window.localStorage)).toBe('shared-string')
  expect(replace).not.toHaveBeenCalled()
  respond = (_request, response) => expired(response)
  await expect(request()).rejects.toMatchObject({ code: 'SESSION_INVALID' })
  expect(storage.readToken(window.localStorage)).toBeNull()
  expect(replace).toHaveBeenCalledWith('/login')
})

it.each(['login', 'logout'] as const)(
  'discards late AuthFlow %s results after switching roots with equal raw state',
  async (phase) => {
    const storage = await install()
    if (phase === 'logout') storage.writeToken(window.localStorage, 'old-account')
    let release!: () => void, arrived!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reached = new Promise<void>((resolve) => {
      arrived = resolve
    })
    respond = (request, response) => {
      if (request.url?.endsWith(`/auth/${phase}`)) {
        arrived()
        void gate.then(() =>
          json(
            response,
            200,
            phase === 'login' ? { token: 'new-account', expiresAt: Date.now() + 10000 } : {},
          ),
        )
      } else json(response, 200, { token: 'new-account', expiresAt: Date.now() + 10000 })
    }
    const { AuthFlow } = await import('../auth/AuthFlow')
    render(
      <MemoryRouter>
        <AuthFlow presentation="page" />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('邮箱'), 'fixture@example.test')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'fixture-password')
    await user.click(screen.getByRole('button', { name: '继续' }))
    await user.click(screen.getByRole('button', { name: '登录' }))
    await reached
    await install('/custom-B')
    if (phase === 'logout') storage.writeToken(window.localStorage, 'old-account')
    release()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '登录' }).hasAttribute('disabled')).toBe(false),
    )
    expect(storage.readRawToken(window.localStorage)).toBe(
      phase === 'logout' ? 'old-account' : null,
    )
    expect(replace).not.toHaveBeenCalled()
    expect(requests.filter((request) => request.url.startsWith('/custom-B/'))).toEqual([])
  },
)

it.each(['inspect', 'accept'] as const)(
  'discards late OIDC %s results after a same-token root switch',
  async (phase) => {
    const storage = await install()
    storage.writeToken(window.localStorage, 'same-account')
    let release!: () => void, arrived!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const reached = new Promise<void>((resolve) => {
      arrived = resolve
    })
    respond = (request, response) => {
      const body = request.url?.endsWith('/inspect')
        ? { clientName: 'Fixture', scopes: ['openid'] }
        : { redirectUrl: `${root}/hydra-complete` }
      if ((phase === 'inspect') === request.url?.endsWith('/inspect')) {
        arrived()
        void gate.then(() => json(response, 200, body))
      } else json(response, 200, body)
    }
    const { OidcPage } = await import('../pages/IdentityPage/OidcPage')
    render(
      <MemoryRouter initialEntries={['/identity/login?login_challenge=fixture']}>
        <OidcPage phase="login" />
      </MemoryRouter>,
    )
    await reached
    await install('/custom-B')
    storage.writeToken(window.localStorage, 'same-account')
    await act(async () => {
      release()
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(replace).not.toHaveBeenCalled()
    expect(storage.readRawToken(window.localStorage)).toBe('same-account')
    expect(requests.filter((request) => request.url.startsWith('/custom-B/'))).toEqual([])
  },
)

it.each(['getItem', 'accessor'] as const)(
  'keeps restored expiry ownership when the storage %s becomes unavailable',
  async (failure) => {
    let storage = await install()
    storage.writeToken(window.localStorage, 'restored-token')
    const key = keyFor('restored-token')
    storage = await reload()
    const persistent = window.localStorage
    respond = (_request, response) => expired(response)
    let read: ReturnType<typeof vi.spyOn> | undefined
    if (failure === 'accessor') storageUnavailable = true
    else
      read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied')
      })
    await expect(request()).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(requests.at(-1)?.authorization).toBe('Bearer restored-token')
    expect(replace).not.toHaveBeenCalled()
    read?.mockRestore()
    storageUnavailable = false
    expect(storage.readRawToken(persistent)).toBe('restored-token')
    expect(storage.readToken(persistent)).toBeNull()
    expect(storage.syncSessionToken()).toBeNull()
    persistent.setItem(key, 'new-account')
    storageEvent(key)
    respond = (_request, response) => json(response, 200, { status: 'ok' })
    await request()
    expect(requests.at(-1)?.authorization).toBe('Bearer new-account')
  },
)

it('releases exactly its own storage subscription leases during disposal and reinstallation', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'custom-token')
  const key = keyFor('custom-token')
  const release = storage.startSessionSync()
  const changed = vi.fn()
  const stop = storage.subscribeSessionChanges(changed)
  release()
  release()
  window.localStorage.setItem(key, 'next-token')
  storageEvent(key)
  expect(changed).toHaveBeenCalledTimes(1)
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer next-token')
  dispose?.()
  window.localStorage.setItem(key, 'after-disposal')
  storageEvent(key)
  expect(changed).toHaveBeenCalledTimes(1)
  await install()
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer after-disposal')
  stop()
})

it('does not let a captured AuthProvider invalidation clear an equal-token replacement scope', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'same-account')
  const { AuthProvider, useAuth } = await import('../auth/AuthContext')
  let invalidate: ((token: string) => void) | undefined
  function State() {
    invalidate ??= useAuth().invalidateSession
    return null
  }
  render(
    <AuthProvider>
      <State />
    </AuthProvider>,
  )
  await act(async () => {
    await install('/custom-B')
    storage.writeToken(window.localStorage, 'same-account')
  })
  act(() => invalidate!('same-account'))
  expect(storage.readRawToken(window.localStorage)).toBe('same-account')
})

it('does not send a retained login draft to a root selected after the captcha step began', async () => {
  await install()
  const { AuthFlow } = await import('../auth/AuthFlow')
  render(
    <MemoryRouter>
      <AuthFlow presentation="page" />
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('邮箱'), 'fixture@example.test')
  await user.type(screen.getByLabelText('密码', { exact: true }), 'fixture-password')
  await user.click(screen.getByRole('button', { name: '继续' }))
  await install('/custom-B')
  await user.click(screen.getByRole('button', { name: '登录' }))
  expect(requests).toEqual([])
})

it('drops an invitation automatic chain before sending its code to a replacement root', async () => {
  await install()
  window.location.search = '?email=fixture@example.test&code=001234'
  window.location.href = `${root}/register${window.location.search}`
  let release!: () => void, arrived!: () => void
  const reached = new Promise<void>((resolve) => {
    arrived = resolve
  })
  respond = (request, response) => {
    if (request.url === '/custom-api/auth/invitations/check') {
      release = () =>
        json(response, 200, {
          status: 'eligible',
          email: 'fixture@example.test',
          serverTime: 1,
          resendAvailableAt: 1,
        })
      arrived()
    } else
      json(response, 200, {
        status: 'verified',
        email: 'fixture@example.test',
        nickname: 'Fixture',
        completionToken: 't'.repeat(43),
      })
  }
  const { InvitationRegistrationFlow } = await import('../invitations/InvitationRegistrationFlow')
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="page" />
    </MemoryRouter>,
  )
  await reached
  // The fixture location is separate from jsdom history; reflect the code cleanup.
  window.location.search = '?email=fixture@example.test'
  window.location.href = `${root}/register${window.location.search}`
  await act(async () => {
    await install('/custom-B')
    release()
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  expect(requests.map((request) => request.url)).toEqual(['/custom-api/auth/invitations/check'])
  expect(screen.queryByLabelText('密码')).toBeNull()
  expect(screen.getByLabelText('邮箱')).toBeTruthy()
})

it('clears invitation credentials and the password form on a root switch but preserves equivalent roots', async () => {
  await install()
  respond = (request, response) =>
    json(
      response,
      200,
      request.url?.endsWith('/check')
        ? { status: 'eligible', email: 'fixture@example.test', serverTime: 1, resendAvailableAt: 1 }
        : {
            status: 'verified',
            email: 'fixture@example.test',
            nickname: 'Fixture',
            completionToken: 't'.repeat(43),
          },
    )
  const { InvitationRegistrationFlow } = await import('../invitations/InvitationRegistrationFlow')
  render(
    <MemoryRouter>
      <InvitationRegistrationFlow presentation="modal" initialEmail="fixture@example.test" />
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '继续' }))
  await user.type(await screen.findByLabelText('6 位验证码'), '001234')
  const password = (await screen.findByLabelText('密码')) as HTMLInputElement
  await user.type(password, 'fixture-password')
  await act(async () => {
    await install(`${root}/custom-api///`)
  })
  expect(screen.getByLabelText('密码')).toBe(password)
  expect(password.value).toBe('fixture-password')
  await act(async () => {
    await install('/custom-B')
  })
  expect(screen.queryByLabelText('密码')).toBeNull()
  expect(screen.queryByLabelText('6 位验证码')).toBeNull()
  expect(screen.getByLabelText('邮箱')).toBeTruthy()
  expect(requests.map((request) => request.url)).toEqual([
    '/custom-api/auth/invitations/check',
    '/custom-api/auth/invitations/verify',
  ])
  await user.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByLabelText('6 位验证码')).toBeTruthy()
  expect(requests.at(-1)?.url).toBe('/custom-B/auth/invitations/check')
})

it('clears retained profile and notification caches on installation without mounted consumers', async () => {
  const storage = await install()
  storage.writeToken(window.localStorage, 'same-token')
  const settings = await import('../settings/settingsConfig')
  const notifications = await import('../notifications/notificationsConfig')
  settings.bindSettingsToken('same-token')
  notifications.bindNotificationsToken('same-token')
  settings.settingsConfig.profile.snapshot = {
    id: 'fixture',
    email: 'fixture@example.test',
    nickname: 'Old root',
    qq: null,
    fivemId: null,
    avatarUrl: null,
  }
  notifications.notificationsConfig.summary.unreadCount = 42
  notifications.notificationsConfig.summary.status = 'ready'
  const pending = settings.beginSettingsRequest('same-token')!
  const generation = notifications.captureNotificationRead()
  window.localStorage.setItem(
    `${storage.AUTH_TOKEN_KEY}:${encodeURIComponent(`${root}/custom-B`)}`,
    'same-token',
  )
  await install('/custom-B')
  expect(settings.settingsConfig.profile.snapshot).toBeNull()
  expect(notifications.notificationsConfig.summary.unreadCount).toBe(0)
  expect(settings.settingsRequestCurrent('same-token', pending)).toBe(false)
  expect(notifications.isCurrentNotificationGeneration(generation)).toBe(false)
  await install('/custom-api')
  expect(settings.settingsConfig.profile.snapshot).toBeNull()
  expect(settings.settingsRequestCurrent('same-token', pending)).toBe(false)
})

it('keeps default failed-logout suppression when returning from a custom root while persistence is unreadable', async () => {
  const storage = await install('')
  storage.writeToken(window.localStorage, 'retained-default')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  storage.clearBrowserSession()
  remove.mockRestore()
  await install('/custom-B')
  // Both access paths must be unavailable: the real Browser SDK uses global localStorage.
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied')
  })
  await install('')
  read.mockRestore()
  await request()
  expect(requests.at(-1)?.authorization).toBeUndefined()
  expect(storage.readToken(window.localStorage)).toBeNull()
  storage.writeToken(window.localStorage, 'retained-default')
  await request()
  expect(requests.at(-1)?.authorization).toBe('Bearer retained-default')
})

const feedbackOptions: components['schemas']['FeedbackOptions'] = {
  available: true,
  reason: null,
  fields: [],
  actions: [],
  kinds: [
    { kind: 'suggestion', available: true, reason: null },
    { kind: 'complaint', available: true, reason: null },
  ],
  limits: {
    titleCodePoints: 200,
    userContentBytes: 65536,
    fileBytes: 20971520,
    files: 5,
    totalFileBytes: 104857600,
    largeFileInfoBytes: 16384,
  },
}

async function mountFeedback() {
  const { ThemeProvider, ExMessageContext } = await import('@exre/exui')
  const { FeedbackProvider, useFeedback } =
    await import('../pages/Support/feedback/FeedbackProvider')
  await import('../pages/Support/feedback/FeedbackModal')
  function Entry() {
    const { openFeedback } = useFeedback()
    return (
      <button onClick={(event) => openFeedback('community', event.currentTarget)}>
        投诉和建议
      </button>
    )
  }
  render(
    <ThemeProvider defaultTheme="light">
      <ExMessageContext />
      <MemoryRouter>
        <FeedbackProvider>
          <Entry />
        </FeedbackProvider>
      </MemoryRouter>
    </ThemeProvider>,
  )
  const entry = screen.getByRole('button', { name: '投诉和建议' })
  fireEvent.click(entry)
  fireEvent.click((await screen.findByText('反馈和建议')).closest('button')!)
  fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'A 的私密建议' } })
  fireEvent.paste(screen.getByLabelText('内容'), {
    clipboardData: {
      files: [],
      getData: (type: string) => (type === 'text/plain' ? 'A 的私密正文' : ''),
    },
  })
  return entry
}

it.each(['prepare', 'upload'] as const)(
  'stops a same-token feedback submission after %s without sending its next stage to a replacement root',
  async (stage) => {
    const storage = await install()
    storage.writeToken(window.localStorage, 'same-feedback-token')
    // Use the complete native binary APIs: jsdom File lacks arrayBuffer(), which
    // would otherwise stop the flow before the HTTP boundary under test.
    const nativeForm = await new Response(new URLSearchParams()).formData()
    vi.stubGlobal('FormData', nativeForm.constructor)
    vi.stubGlobal('Blob', NativeBlob)
    vi.stubGlobal('File', NativeFile)
    let release: (() => void) | undefined
    let prepared: components['schemas']['FeedbackSnapshot'] | undefined
    const attachmentBodies: string[] = []
    respond = (request, response) => {
      if (request.url?.includes('/options?')) {
        json(response, 200, feedbackOptions)
        return
      }
      void (async () => {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks).toString()
        if (request.url === '/custom-api/support/feedback/submissions') {
          const input = JSON.parse(body) as components['schemas']['FeedbackPrepare']
          prepared = {
            id: '11111111-1111-4111-8111-111111111111',
            submissionKey: input.submissionKey,
            revision: 0,
            form: input.form,
            createdAt: 1,
            receiveExpiresAt: 86400001,
            status: 'receiving',
            nextAction: 'upload',
            taskId: null,
            taskUrl: null,
            failure: null,
            attachments: input.attachments.map((attachment, ordinal) => ({
              ...attachment,
              ordinal,
              status: 'expected',
              remoteAttachmentId: null,
            })),
          }
          if (stage === 'prepare') release = () => json(response, 200, prepared)
          else json(response, 200, prepared)
        } else if (request.url?.includes('/attachments/')) {
          attachmentBodies.push(body)
          prepared = {
            ...prepared!,
            revision: 1,
            status: 'ready',
            nextAction: 'continue',
            attachments: prepared!.attachments.map((attachment) => ({
              ...attachment,
              status: 'received',
            })),
          }
          if (stage === 'upload') release = () => json(response, 200, prepared)
          else json(response, 200, prepared)
        } else {
          json(response, 200, {
            ...prepared!,
            revision: 2,
            status: 'completed',
            nextAction: 'done',
          })
        }
      })()
    }
    await mountFeedback()
    fireEvent.change(screen.getByLabelText(/^附件/), {
      target: {
        files: [new NativeFile(['A-private-attachment'], 'private.txt', { type: 'text/plain' })],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => expect(release).toBeTypeOf('function'))
    window.localStorage.setItem(
      `${storage.AUTH_TOKEN_KEY}:${encodeURIComponent(`${root}/custom-B`)}`,
      'same-feedback-token',
    )
    await act(async () => {
      await install('/custom-B')
      release!()
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(requests.filter((request) => request.url.startsWith('/custom-B/'))).toEqual([])
    if (stage === 'prepare') expect(attachmentBodies).toEqual([])
    else {
      expect(attachmentBodies).toHaveLength(1)
      expect(attachmentBodies[0]).toContain('A-private-attachment')
      expect(
        requests.some(
          (request) =>
            request.url.startsWith('/custom-api/support/feedback/submissions/') &&
            request.url.includes('/attachments/'),
        ),
      ).toBe(true)
    }
    expect(screen.queryByText('反馈已提交')).toBeNull()
  },
)

it.each([false, true])(
  'preserves equivalent-root feedback drafts and clears same-token root changes (reopen in same update: %s)',
  async (reopenImmediately) => {
    const storage = await install()
    storage.writeToken(window.localStorage, 'same-feedback-token')
    respond = (_request, response) => json(response, 200, feedbackOptions)
    const entry = await mountFeedback()
    const title = screen.getByLabelText('标题') as HTMLInputElement
    await act(async () => {
      await install(`${root}/custom-api///`)
    })
    expect(screen.getByLabelText('标题')).toBe(title)
    expect(title.value).toBe('A 的私密建议')
    window.localStorage.setItem(
      `${storage.AUTH_TOKEN_KEY}:${encodeURIComponent(`${root}/custom-B`)}`,
      'same-feedback-token',
    )
    await act(async () => {
      await install('/custom-B')
      if (reopenImmediately) fireEvent.click(entry)
    })
    if (!reopenImmediately) {
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '投诉和建议' }))
    }
    fireEvent.click((await screen.findByText('反馈和建议')).closest('button')!)
    expect((screen.getByLabelText('标题') as HTMLInputElement).value).toBe('')
    expect(screen.getByLabelText('内容').textContent).not.toContain('A 的私密正文')
    expect(requests.map((request) => request.url)).toEqual([
      '/custom-api/support/feedback/options?area=community',
      '/custom-B/support/feedback/options?area=community',
    ])
  },
)

it.each([false, true])(
  'restores a replacement default token after unreadable scope return and owns its expiry (read first: %s)',
  async (readFirst) => {
    const storage = await install('')
    storage.writeToken(window.localStorage, 'retained-default')
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    storage.clearBrowserSession()
    remove.mockRestore()
    await install('/custom-B')
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await install('')
    read.mockRestore()
    window.localStorage.setItem(storage.AUTH_TOKEN_KEY, 'replacement-default')
    if (readFirst) expect(storage.readToken(window.localStorage)).toBe('replacement-default')
    storageEvent(storage.AUTH_TOKEN_KEY)
    expect(storage.readToken(window.localStorage)).toBe('replacement-default')
    await request()
    expect(requests.at(-1)?.authorization).toBe('Bearer replacement-default')
    respond = (_request, response) => expired(response)
    await expect(request()).rejects.toMatchObject({ code: 'SESSION_INVALID' })
    expect(storage.readRawToken(window.localStorage)).toBeNull()
    expect(storage.readToken(window.localStorage)).toBeNull()
  },
)
