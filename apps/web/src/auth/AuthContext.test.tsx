// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExAxiosError, setAccessToken } from '@workspace/sdk'
import {
  AUTH_TOKEN_KEY,
  SSO_SUCCESS_KEY,
  readToken,
  syncSessionToken,
  writeToken,
} from '@web/src/auth/storage'
import { bindSettingsToken, settingsConfig } from '@web/src/settings/settingsConfig'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  setAccessToken: vi.fn(),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get, POST: post }
    return Promise.resolve(
      handlers[(config.method ?? 'GET') as keyof typeof handlers](config),
    ).then((data) => ({ msg: 'ok', data }))
  },
}))

import { AuthProvider, useAuth } from '@web/src/auth/AuthContext'

function CurrentState() {
  const auth = useAuth()
  return (
    <>
      <p>{auth.state.status}</p>
      <button onClick={auth.logout}>退出登录</button>
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  get.mockReset()
  post.mockReset()
  window.localStorage.clear()
  window.sessionStorage.clear()
  syncSessionToken()
  bindSettingsToken(null)
})

describe('explicit logout', () => {
  it.each([
    new ExAxiosError('http', 'BAD_REQUEST', 'The request could not be processed.', { status: 415 }),
    new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 }),
    new ExAxiosError('timeout', 'TIMEOUT', 'Timed out'),
    new Error('offline'),
  ])('clears browser authentication when revocation fails: $message', async (error) => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    window.sessionStorage.setItem(SSO_SUCCESS_KEY, 'cached-sso-result')
    get.mockResolvedValue({ username: 'Member', avatar: null })
    post.mockRejectedValue(error)
    render(
      <AuthProvider>
        <CurrentState />
      </AuthProvider>,
    )
    await screen.findByText('authenticated')

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))

    await waitFor(() => expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull())
    expect(window.sessionStorage.getItem(SSO_SUCCESS_KEY)).toBeNull()
    expect(screen.getByText('anonymous')).toBeTruthy()
    expect(post).toHaveBeenCalledWith({
      url: '/api/auth/logout',
      method: 'POST',
      headers: { Authorization: 'Bearer current-token' },
      alert: false,
    })
  })

  it.each(['success', 'failure'] as const)(
    'exits before a pending request settles and ignores its late %s after a new login',
    async (result) => {
      writeToken(window.localStorage, 'old-token')
      bindSettingsToken('old-token')
      settingsConfig.profile.snapshot = {
        id: 1,
        platform_role: 'user',
        last_login_time: null,
        email: 'private@example.com',
        username: 'Member',
        qq: null,

        avatar: null,
      }
      settingsConfig.profile.status = 'ready'
      get.mockResolvedValue({ username: 'Member', avatar: null })
      let resolve!: (value: unknown) => void, reject!: (error: unknown) => void
      post.mockImplementation(
        () =>
          new Promise((done, fail) => {
            resolve = done
            reject = fail
          }),
      )
      render(
        <AuthProvider>
          <CurrentState />
        </AuthProvider>,
      )
      await screen.findByText('authenticated')
      fireEvent.click(screen.getByRole('button', { name: '退出登录' }))

      expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
      expect(setAccessToken).toHaveBeenLastCalledWith(null)
      expect(settingsConfig.profile.snapshot).toBeNull()
      expect(screen.getByText('anonymous')).toBeTruthy()
      act(() => writeToken(window.localStorage, 'new-token'))
      await screen.findByText('authenticated')
      await act(async () => {
        if (result === 'success') resolve({ status: 'signed-out' })
        else reject(new Error('offline'))
      })
      expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
      expect(screen.getByText('authenticated')).toBeTruthy()
    },
  )

  it('does not let an in-flight profile request restore identity after logout', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    let resolve!: (value: unknown) => void
    get.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    post.mockResolvedValue({ status: 'signed-out' })
    render(
      <AuthProvider>
        <CurrentState />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    await act(async () => resolve({ username: 'Old profile', avatar: null }))
    expect(screen.getByText('anonymous')).toBeTruthy()
  })

  it('cleans SSO state and becomes anonymous even without a persisted token', async () => {
    window.sessionStorage.setItem(SSO_SUCCESS_KEY, 'cached-sso-result')
    render(
      <AuthProvider>
        <CurrentState />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(window.sessionStorage.getItem(SSO_SUCCESS_KEY)).toBeNull()
    expect(screen.getByText('anonymous')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('clears local storage even when reading it and clearing session storage throw', () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    const original = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === window.localStorage) throw new Error('blocked read')
      return original.call(this, key)
    })
    const remove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (this === window.sessionStorage) throw new Error('blocked session storage')
      remove.call(this, key)
    })
    render(
      <AuthProvider>
        <CurrentState />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(original.call(window.localStorage, AUTH_TOKEN_KEY)).toBeNull()
    expect(screen.getByText('anonymous')).toBeTruthy()
  })
})

describe('auth session restore', () => {
  it('ignores an invalid response for an old token after a replacement token is stored', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    let reject: ((error: unknown) => void) | undefined
    get.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    render(
      <AuthProvider>
        <CurrentState />
      </AuthProvider>,
    )
    await waitFor(() => expect(reject).toBeDefined())
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'new-token')
    reject?.(new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 }))
    await waitFor(() => expect(screen.getByText('loading')).toBeTruthy())
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
  })

  it('does not restore a profile for an old token after a replacement token is stored', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    let finish: ((value: unknown) => void) | undefined
    get.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(
      <AuthProvider>
        <CurrentState />
      </AuthProvider>,
    )
    await waitFor(() => expect(finish).toBeDefined())
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'new-token')
    finish?.({ username: 'Old user', avatar: null })
    await waitFor(() => expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token'))
    expect(screen.getByText('loading')).toBeTruthy()
  })
})

it('does not restore UI from a retained token after explicit logout fails to delete persistence', async () => {
  writeToken(window.localStorage, 'retained-token')
  get.mockResolvedValue({ username: 'Member', avatar: null })
  post.mockRejectedValue(new Error('offline'))
  render(
    <AuthProvider>
      <CurrentState />
    </AuthProvider>,
  )
  await screen.findByText('authenticated')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
  expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('retained-token')
  expect(readToken(window.localStorage)).toBeNull()
  act(() => {
    syncSessionToken()
  })
  await screen.findByText('anonymous')
  expect(get).toHaveBeenCalledTimes(1)
  remove.mockRestore()
  act(() => writeToken(window.localStorage, 'retained-token'))
  await screen.findByText('authenticated')
})
