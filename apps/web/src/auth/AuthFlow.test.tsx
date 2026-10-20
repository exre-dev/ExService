// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ExAxiosError } from '@workspace/sdk'
import type { components } from '@workspace/sdk/types'

const post = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { POST: post }
    return Promise.resolve(
      handlers[(config.method ?? 'GET') as keyof typeof handlers](config),
    ).then((data) => ({ msg: 'ok', data }))
  },
}))
vi.mock('@web/src/pages/AuthPage/AuthBackdrop', () => ({ AuthBackdrop: () => null }))

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver)
Object.defineProperty(document, 'elementFromPoint', {
  configurable: true,
  value: () => document.body,
})

import { AuthFlow } from '@web/src/auth/AuthFlow'
import { AuthPage } from '@web/src/pages/AuthPage'
import {
  AUTH_TOKEN_KEY,
  clearBrowserSession,
  readToken,
  syncSessionToken,
} from '@web/src/auth/storage'

afterEach(() => {
  cleanup()
  post.mockReset()
  window.localStorage.clear()
  syncSessionToken()
})

describe('AuthFlow captcha stage', () => {
  it('finishes a completed PHP SSO inspection without confirming again or replacing the Website token', async () => {
    const original = window
    const replace = vi.fn()
    vi.stubGlobal(
      'window',
      new Proxy(original, {
        get(target, key) {
          if (key === 'location') return { ...target.location, replace }
          return Reflect.get(target, key)
        },
      }),
    )
    try {
      const ssoRequestId = 's'.repeat(43)
      localStorage.setItem(AUTH_TOKEN_KEY, 'website-token')
      const inspection: components['schemas']['SsoInspectResponse']['data'] = {
        ssoRequestId,
        status: 'completed',
        serverTime: Date.now(),
        expiresAt: Date.now() + 60000,
      }
      post.mockResolvedValue(inspection)
      render(
        <MemoryRouter>
          <AuthFlow presentation="page" ssoRequestId={ssoRequestId} />
        </MemoryRouter>,
      )
      await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith('/sso/success'))
      expect(post).toHaveBeenCalledTimes(1)
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('website-token')
      expect(sessionStorage.getItem('exwebsite.auth.sso-success')).toBeNull()
    } finally {
      vi.stubGlobal('window', original)
    }
  })
  it('removes the legal footer from the actual login page after continuing', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(
        'By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.',
      ),
    ).toBeTruthy()

    await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(screen.getByRole('heading', { name: '输入验证码' })).toBeTruthy()
    expect(
      screen.queryByText(
        'By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.',
      ),
    ).toBeNull()
  })

  it('submits ordinary login only after the placeholder step, without a captcha credential', async () => {
    const user = userEvent.setup()
    post.mockRejectedValue(
      new ExAxiosError('http', 'INVALID_CREDENTIALS', 'Invalid credentials', { status: 401 }),
    )
    render(
      <MemoryRouter>
        <AuthFlow
          initialMode="login"
          presentation="page"
          footer={<p>By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.</p>}
        />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(
        'By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.',
      ),
    ).toBeTruthy()

    await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '登录' })).toBeTruthy()
    expect(
      screen.queryByText(
        'By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.',
      ),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(post).toHaveBeenCalledWith({
      url: '/api/auth/login',
      method: 'POST',
      data: { email: 'member@example.com', password: 'password-one' },
      alert: false,
    })
    expect(await screen.findByText('Invalid credentials')).toBeTruthy()

    expect(screen.queryByRole('button', { name: '返回修改资料' })).toBeNull()
  })

  it('uses the same captcha step before SSO password login', async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    const ssoRequestId = 's'.repeat(43)
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/auth/sso/inspect'
        ? Promise.resolve({ ssoRequestId, status: 'pending' })
        : Promise.reject(
            new ExAxiosError('http', 'INVALID_CREDENTIALS', 'Invalid credentials', { status: 401 }),
          ),
    )
    render(
      <MemoryRouter>
        <AuthFlow initialMode="login" presentation="page" ssoRequestId={ssoRequestId} />
      </MemoryRouter>,
    )

    await screen.findByRole('button', { name: '继续' })
    await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/auth/sso/login', method: 'POST' }),
    )
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(post).toHaveBeenCalledWith({
      url: '/api/auth/sso/login',
      method: 'POST',
      data: { ssoRequestId, email: 'member@example.com', password: 'password-one' },
      alert: false,
    })
  })

  it.each(['server rejection', 'network failure'])(
    'keeps the existing session when account-switch logout has a %s',
    async (failure) => {
      const user = userEvent.setup()
      window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
      post.mockImplementation(({ url: path }: { url: string }) =>
        path === '/api/auth/login'
          ? Promise.resolve({ token: 'new-token' })
          : failure === 'network failure'
            ? Promise.reject(new Error('offline'))
            : Promise.reject(
                new ExAxiosError('http', 'SERVICE_UNAVAILABLE', 'Could not revoke', {
                  status: 503,
                }),
              ),
      )
      render(
        <MemoryRouter>
          <AuthFlow presentation="page" />
        </MemoryRouter>,
      )
      await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
      await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
      await user.click(screen.getByRole('button', { name: '继续' }))
      await user.click(screen.getByRole('button', { name: '登录' }))
      expect(post).toHaveBeenCalledWith({
        url: '/api/auth/logout',
        method: 'POST',
        headers: { Authorization: 'Bearer old-token' },
        alert: false,
      })
      expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('old-token')
      expect(await screen.findByText(/旧账号退出失败/)).toBeTruthy()
    },
  )

  it('stores a new account token only after the old session has been revoked', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    let completeLogout: ((value: unknown) => void) | undefined
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/auth/login'
        ? Promise.resolve({ token: 'new-token' })
        : new Promise((resolve) => {
            completeLogout = resolve
          }),
    )
    render(
      <MemoryRouter>
        <AuthFlow presentation="page" />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
    await user.click(screen.getByRole('button', { name: '继续' }))
    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(completeLogout).toBeDefined())
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('old-token')
    completeLogout?.({ status: 'ok' })
    await waitFor(() => expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token'))
  })

  it('keeps a successful Website login in its OIDC challenge flow', async () => {
    const user = userEvent.setup()
    const onSessionCreated = vi.fn()
    post.mockResolvedValue({ token: 'new-token' })
    render(
      <MemoryRouter>
        <AuthFlow presentation="page" onSessionCreated={onSessionCreated} />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
    await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
    await user.click(screen.getByRole('button', { name: '继续' }))
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(onSessionCreated).toHaveBeenCalledWith('new-token')
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
  })

  it.each([false, true])(
    'accepts a new login after the old session expires (transport cleared it: %s)',
    async (cleared) => {
      const user = userEvent.setup()
      const onSessionCreated = vi.fn()
      window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
      post.mockImplementation(async ({ url: path }: { url: string }) => {
        if (path === '/api/auth/login') return { token: 'new-token' }
        if (cleared) window.localStorage.removeItem(AUTH_TOKEN_KEY)
        throw new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 })
      })
      render(
        <MemoryRouter>
          <AuthFlow presentation="page" onSessionCreated={onSessionCreated} />
        </MemoryRouter>,
      )
      await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
      await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
      await user.click(screen.getByRole('button', { name: '继续' }))
      await user.click(screen.getByRole('button', { name: '登录' }))
      expect(onSessionCreated).toHaveBeenCalledWith('new-token')
      expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
    },
  )

  it.each([false, true])(
    'preserves a replacement session arriving while the old account is revoked (suppressed UI: %s)',
    async (suppressed) => {
      const user = userEvent.setup()
      const onSessionCreated = vi.fn()
      window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
      if (suppressed) {
        const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
          throw new Error('denied')
        })
        clearBrowserSession()
        remove.mockRestore()
        expect(readToken(window.localStorage)).toBeNull()
      }
      post.mockImplementation(async ({ url: path }: { url: string }) => {
        if (path === '/api/auth/login') return { token: 'new-token' }
        window.localStorage.setItem(AUTH_TOKEN_KEY, 'replacement-token')
        return { status: 'ok' }
      })
      render(
        <MemoryRouter>
          <AuthFlow presentation="page" onSessionCreated={onSessionCreated} />
        </MemoryRouter>,
      )
      await user.type(screen.getByLabelText('邮箱'), 'member@example.com')
      await user.type(screen.getByLabelText('密码', { exact: true }), 'password-one')
      await user.click(screen.getByRole('button', { name: '继续' }))
      await user.click(screen.getByRole('button', { name: '登录' }))
      expect(await screen.findByText(/登录状态已在其他页面更改/)).toBeTruthy()
      expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('replacement-token')
      expect(onSessionCreated).not.toHaveBeenCalled()
    },
  )
})
