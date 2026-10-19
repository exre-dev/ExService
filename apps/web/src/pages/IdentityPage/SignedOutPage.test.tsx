// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ExAxiosError } from '@workspace/sdk'
import { AUTH_TOKEN_KEY, writeToken } from '@web/src/auth/storage'

const get = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get }
    return handlers[(config.method ?? 'GET') as keyof typeof handlers](config)
  },
}))

import { SignedOutPage } from '@web/src/pages/IdentityPage/SignedOutPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  get.mockReset()
  window.localStorage.clear()
})

describe('signed-out landing', () => {
  it('presents a visible loading icon, title and content then retries the failed check', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    let reject!: (error: Error) => void
    get
      .mockImplementationOnce(
        () =>
          new Promise((_done, failure) => {
            reject = failure
          }),
      )
      .mockResolvedValue({})
    render(
      <MemoryRouter>
        <SignedOutPage />
      </MemoryRouter>,
    )
    const checking = screen.getByRole('status')
    expect(within(checking).getByRole('heading', { name: '正在确认登录状态' })).toBeTruthy()
    expect(checking.querySelector('svg')).toBeTruthy()
    expect(checking.getAttribute('aria-busy')).toBe('true')
    reject(new Error('private upstream detail'))
    const unavailable = await screen.findByRole('alert')
    expect(within(unavailable).getByRole('heading', { name: '暂时无法确认登录状态' })).toBeTruthy()
    expect(unavailable.querySelector('svg')).toBeTruthy()
    expect(unavailable.textContent).not.toContain('private upstream detail')
    fireEvent.click(within(unavailable).getByRole('button', { name: '重试' }))
    await screen.findByText('当前浏览器有有效的网站登录会话。')
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('clears the same token only after the server confirms it is invalid', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'expired-token')
    get.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 }),
    )
    render(
      <MemoryRouter>
        <SignedOutPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/当前浏览器已退出/)).toBeTruthy()
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('removes only the token confirmed invalid by the profile operation', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
    get.mockImplementation(async () => {
      window.localStorage.setItem(AUTH_TOKEN_KEY, 'new-token')
      throw new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 })
    })
    render(
      <MemoryRouter>
        <SignedOutPage />
      </MemoryRouter>,
    )
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith({
        url: '/auth/me',
        method: 'GET',
        headers: { Authorization: 'Bearer old-token' },
        alert: false,
      }),
    )
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
  })

  it('keeps the current token on network failure and offers retry', async () => {
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'current-token')
    get.mockRejectedValue(new Error('network down'))
    render(
      <MemoryRouter>
        <SignedOutPage />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: '重试' })).toBeTruthy()
    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('current-token')
  })
})

it('ignores retired Docs hints and offers only the home return after confirming signed out', async () => {
  render(
    <MemoryRouter initialEntries={['/identity/signed-out?docsReturnTo=%2Fdocs%2Fdoc%2Fold']}>
      <SignedOutPage />
    </MemoryRouter>,
  )
  expect(await screen.findByText('当前浏览器已退出登录。')).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: '退出登录确认' })).toBeTruthy()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('link', { name: '返回网站首页' }).getAttribute('href')).toBe('/')
})
it('reports unavailable storage without making a profile request', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage unavailable')
  })
  render(
    <MemoryRouter>
      <SignedOutPage />
    </MemoryRouter>,
  )
  await screen.findByRole('alert')
  expect(get).not.toHaveBeenCalled()
})
it('subscribes to newer sessions and ignores an older invalid response', async () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'old')
  let reject!: (error: Error) => void
  get
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, failure) => {
          reject = failure
        }),
    )
    .mockResolvedValue({})
  render(
    <MemoryRouter>
      <SignedOutPage />
    </MemoryRouter>,
  )
  writeToken(window.localStorage, 'new')
  await screen.findByText('当前浏览器有有效的网站登录会话。')
  reject(new ExAxiosError('http', 'SESSION_INVALID', 'Invalid session', { status: 401 }))
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new')
  expect(screen.getByText('当前浏览器有有效的网站登录会话。')).toBeTruthy()
})
