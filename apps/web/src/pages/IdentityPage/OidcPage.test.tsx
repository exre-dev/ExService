// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExAxiosError } from '@workspace/sdk'
import { AUTH_TOKEN_KEY } from '@web/src/auth/storage'

const post = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { POST: post }
    return handlers[(config.method ?? 'GET') as keyof typeof handlers](config)
  },
}))
vi.mock('@web/src/auth/AuthFlow', () => ({ AuthFlow: () => <p>Website password form</p> }))
vi.mock('@web/src/pages/AuthPage/AuthBackdrop', () => ({ AuthBackdrop: () => null }))
vi.mock('@web/src/pages/IdentityPage/SignedOutPage', () => ({
  SignedOutPage: () => <p>Signed-out check</p>,
}))

import { OidcPage } from '@web/src/pages/IdentityPage/OidcPage'
import { SignedOutPage } from '@web/src/pages/IdentityPage/SignedOutPage'

function show(phase: 'login' | 'consent' | 'logout', query: string, strict = false) {
  const routes = (
    <MemoryRouter initialEntries={[`/identity/${phase}${query}`]}>
      <Routes>
        <Route path={`/identity/${phase}`} element={<OidcPage phase={phase} />} />
        <Route path="/identity/signed-out" element={<SignedOutPage />} />
      </Routes>
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{routes}</StrictMode> : routes)
}

afterEach(() => {
  cleanup()
  post.mockReset()
  window.localStorage.clear()
})

describe('Website OIDC browser flow', () => {
  it.each([1428, 8192])(
    'accepts one non-empty login challenge of length %i without truncation',
    async (length) => {
      const challenge = 'x'.repeat(length)
      post.mockRejectedValue(
        new ExAxiosError('http', 'SERVICE_UNAVAILABLE', 'Unavailable', { status: 503 }),
      )
      show('login', `?login_challenge=${challenge}`)
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith({
          url: '/auth/oidc/inspect',
          method: 'POST',
          data: { phase: 'login', challenge },
          alert: false,
        }),
      )
    },
  )

  it('rejects a login challenge beyond 8192 characters before any API request', () => {
    show('login', `?login_challenge=${'x'.repeat(8193)}`)
    expect(post).not.toHaveBeenCalled()
  })

  it.each([
    ['login', '?login_challenge='],
    ['login', '?login_challenge=one&login_challenge=two'],
    ['consent', '?login_challenge=one'],
    ['consent', '?consent_challenge=a%20b'],
    ['logout', '?logout_challenge=%20'],
  ] as const)('rejects malformed %s entrance %s before any API request', (phase, query) => {
    show(phase, query)
    expect(screen.getByRole('alert').textContent).toMatch(/入口无效/)
    expect(post).not.toHaveBeenCalled()
  })

  it('inspects a login challenge, then accepts it with only the current Bearer', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/auth/oidc/inspect'
        ? Promise.resolve({ clientName: '示例应用', scopes: ['openid', 'profile'] })
        : Promise.reject(
            new ExAxiosError('http', 'SERVICE_UNAVAILABLE', 'Unavailable', { status: 503 }),
          ),
    )
    show('login', '?login_challenge=valid-challenge')
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith({
        url: '/auth/oidc/login/accept',
        method: 'POST',
        data: { challenge: 'valid-challenge' },
        headers: { Authorization: 'Bearer current-token' },
        alert: false,
      }),
    )
    expect(post).toHaveBeenCalledWith({
      url: '/auth/oidc/inspect',
      method: 'POST',
      data: { phase: 'login', challenge: 'valid-challenge' },
      alert: false,
    })
    expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
  })

  it('does not duplicate challenge requests under React StrictMode', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/auth/oidc/inspect'
        ? Promise.resolve({ clientName: '示例应用', scopes: ['openid'] })
        : Promise.reject(
            new ExAxiosError('http', 'SERVICE_UNAVAILABLE', 'Unavailable', { status: 503 }),
          ),
    )
    show('login', '?login_challenge=valid-challenge', true)
    expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
    expect(post).toHaveBeenCalledTimes(2)
  })

  it('does not accept a stale consent response after the browser token changes', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    let finishAccept: ((value: unknown) => void) | undefined
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/auth/oidc/inspect'
        ? Promise.resolve({ clientName: '示例应用', scopes: ['openid'] })
        : new Promise((resolve) => {
            finishAccept = resolve
          }),
    )
    show('consent', '?consent_challenge=valid-challenge')
    await waitFor(() => expect(finishAccept).toBeDefined())
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'new-token')
    finishAccept?.({ redirectUrl: 'http://identity.exwebsite.test:8090/' })
    expect(await screen.findByText(/重新从应用发起登录/)).toBeTruthy()
    expect(post).toHaveBeenCalledTimes(2)
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
  })

  it('keeps consent tied to its existing session when the Bearer is invalid', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'expired-token')
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/auth/oidc/inspect'
        ? Promise.resolve({ clientName: '示例应用', scopes: ['openid'] })
        : Promise.reject(
            new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 }),
          ),
    )
    show('consent', '?consent_challenge=valid-challenge')
    expect(await screen.findByText(/重新从应用发起登录/)).toBeTruthy()
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(post).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenCalledWith({
      url: '/auth/oidc/consent/accept',
      method: 'POST',
      data: { challenge: 'valid-challenge' },
      headers: { Authorization: 'Bearer expired-token' },
      alert: false,
    })
  })

  it('treats a 401 after protocol logout as signed out without accepting again', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    post.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 }),
    )
    show('logout', '?logout_challenge=valid-challenge')
    expect(await screen.findByText('Signed-out check')).toBeTruthy()
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('old-token')
    expect(post).toHaveBeenCalledTimes(1)
  })
})
