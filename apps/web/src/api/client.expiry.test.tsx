// @vitest-environment jsdom
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { instance } from '@workspace/sdk'
import type { CheckedConfig, RequestConfig } from '../../../../packages/sdk/src/request-types'
import { installSdkIntegration } from './client'
import {
  AUTH_TOKEN_KEY,
  clearBrowserSession,
  readRawToken,
  readToken,
  subscribeSessionChanges,
  syncSessionToken,
  writeToken,
} from '../auth/storage'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { OidcPage } from '../pages/IdentityPage/OidcPage'

const fixture = vi.hoisted(() => ({ reset: () => {} }))
vi.mock('@workspace/sdk', async () => {
  const { createRuntime } = await import('../../../../packages/sdk/src/runtime')
  const { ExAxiosError } = await import('../../../../packages/sdk/src/http/errors')
  const create = () =>
    createRuntime(
      {
        environment: 'browser',
        origin: window.location.origin,
        readToken: () => ({
          kind: 'known',
          value: window.localStorage.getItem('exwebsite.auth.token'),
        }),
        clearToken: (expected) => {
          if (window.localStorage.getItem('exwebsite.auth.token') !== expected) return false
          window.localStorage.removeItem('exwebsite.auth.token')
          return true
        },
      },
      async () => {
        throw new Error('COS is outside this fixture')
      },
    )
  let runtime = create()
  fixture.reset = () => {
    runtime = create()
  }
  return {
    ExAxiosError,
    // Preserve the request generic instead of instantiating the full Contract union.
    instance: <const C extends RequestConfig>(config: C & CheckedConfig<C>) =>
      runtime.instance<C>(config),
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
    error: { code: 'SESSION_INVALID', message: 'expired', requestId: 'fixture-expiry' },
  })

beforeEach(async () => {
  storageUnavailable = false
  requests.length = 0
  replace.mockReset()
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
  vi.stubEnv('VITE_API_BASE_URL', '')
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
    await expect(instance({ url: '/auth/me', alert: false })).rejects.toMatchObject({
      code: 'SESSION_INVALID',
    })
    expect(requests[0]?.authorization).toBe('Bearer same-document-login')
    expect(readRawToken(window.localStorage)).toBeNull()
    expect(readToken(window.localStorage)).toBeNull()
    expect(observed).toEqual([null])
    expect(replace).toHaveBeenCalledWith('/login')
  } finally {
    stop()
  }
})

it('suppresses a matching expired write when deletion fails and permits a successful same-token login afterward', async () => {
  writeToken(window.localStorage, 'same-token')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  await expect(instance({ url: '/auth/me', alert: false })).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
  expect(readRawToken(window.localStorage)).toBe('same-token')
  expect(readToken(window.localStorage)).toBeNull()
  expect(syncSessionToken()).toBeNull()
  expect(replace).toHaveBeenCalledWith('/login')
  remove.mockRestore()
  respond = (_request, response) => json(response, 200, { status: 'ok' })
  writeToken(window.localStorage, 'same-token')
  expect(readToken(window.localStorage)).toBe('same-token')
  await instance({ url: '/health', alert: false })
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
  const pending = instance({ url: '/auth/me', alert: false })
  await reached
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'new-cross-tab-token')
  release()
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_INVALID' })
  expect(readRawToken(window.localStorage)).toBe('new-cross-tab-token')
  expect(readToken(window.localStorage)).toBe('new-cross-tab-token')
  expect(replace).not.toHaveBeenCalled()
})

function CurrentState() {
  return <p data-testid="auth-status">{useAuth().state.status}</p>
}
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

it('returns the actual OIDC same-document login to its form when accept expires and persistent deletion fails', async () => {
  window.location.pathname = '/identity/login'
  respond = (request, response) => {
    if (request.url === '/api/auth/oidc/inspect')
      json(response, 200, { clientName: 'Fixture', scopes: ['openid'] })
    else if (request.url === '/api/auth/login')
      json(response, 200, { token: 'oidc-same-document-login', expiresAt: Date.now() + 10000 })
    else if (request.url === '/api/auth/me')
      json(response, 200, { nickname: 'Fixture', avatarUrl: null })
    else expired(response)
  }
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/identity/login?login_challenge=fixture']}>
      <AuthProvider>
        <CurrentState />
        <OidcPage phase="login" />
      </AuthProvider>
    </MemoryRouter>,
  )
  await user.type(await screen.findByLabelText('\u90ae\u7bb1'), 'fixture@example.test')
  await user.type(screen.getByLabelText('\u5bc6\u7801', { exact: true }), 'fixture-password')
  await user.click(screen.getByRole('button', { name: '\u7ee7\u7eed' }))
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  await user.click(screen.getByRole('button', { name: '\u767b\u5f55' }))
  await waitFor(() =>
    expect(requests.some((request) => request.url === '/api/auth/oidc/login/accept')).toBe(true),
  )
  await waitFor(() => expect(readToken(window.localStorage)).toBeNull())
  await waitFor(() => expect(screen.getByTestId('auth-status').textContent).toBe('anonymous'))
  expect(await screen.findByLabelText('\u90ae\u7bb1')).toBeTruthy()
  expect(
    requests.find((request) => request.url === '/api/auth/oidc/login/accept')?.authorization,
  ).toBe('Bearer oidc-same-document-login')
  expect(replace).not.toHaveBeenCalled()
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
      await expect(instance({ url: '/auth/me', alert: false })).rejects.toMatchObject({
        code: 'SESSION_INVALID',
      })
      persistent.setItem(AUTH_TOKEN_KEY, recoveredToken)
      storageUnavailable = false
      expect(requests[0]?.authorization).toBe('Bearer owned-login')
      expect(readRawToken(persistent)).toBe(recoveredToken)
      expect(readToken(persistent)).toBe(recoveredToken === 'owned-login' ? null : recoveredToken)
      expect(observed).toEqual([undefined])
      expect(replace).not.toHaveBeenCalled()
    } finally {
      storageUnavailable = false
      stop()
    }
  },
)
