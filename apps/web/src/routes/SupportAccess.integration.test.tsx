// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { AUTH_TOKEN_KEY } from '../auth/storage'
import { SupportAccess } from './SupportAccess'
import { PageAsyncBoundary } from './PageAsyncBoundary'
import { SupportRoutes } from '../pages/Support/SupportRoutes'
import type { ContentImageData } from '../content/support/types'
import type { ContentModule } from '../content/store'

const api = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }))
const content = vi.hoisted(() => ({
  load: vi.fn(),
  registry: {
    errors: [
      {
        id: 'errors/example.mdx',
        url: '/support/errors/example',
        slug: 'example',
        title: 'Fixture article',
        description: 'Fixture description',
        quickAnswer: 'Fixture answer',
        category: 'setup',
        order: 0,
      },
    ],
    featured: ['example'],
    contacts: [],
    categories: [{ id: 'setup', label: 'Setup', order: 0 }],
    clickup: {
      game: { title: 'Fixture panel', embedUrl: 'https://fixture.invalid/view' },
      community: {
        title: 'Fixture community panel',
        embedUrl: 'https://fixture.invalid/community',
      },
      requestBucket: {
        title: 'Fixture request bucket',
        embedUrl: 'https://fixture.invalid/requests',
      },
    },
  },
}))
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) =>
    config.method === 'POST' ? api.POST(config) : api.GET(config),
}))
vi.mock('../content/support/registry', async () => {
  const { createContentStore } = await import('../content/store')
  return {
    supportRegistry: content.registry,
    supportImage: (image: ContentImageData) => image,
    supportStore: createContentStore({ 'errors/example.mdx': content.load }),
  }
})
function Layout() {
  const auth = useAuth()
  return (
    <>
      <button onClick={auth.logout}>退出登录</button>
      <Outlet context={{ requestLogin: vi.fn() }} />
    </>
  )
}
function tree() {
  return (
    <MemoryRouter initialEntries={['/support/errors/example']}>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/support/*"
              element={
                <SupportAccess>
                  <iframe title="支持面板" />
                </SupportAccess>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}
const originalScroll = Element.prototype.scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  api.GET.mockReset()
  api.POST.mockReset()
  content.load.mockReset()
  window.localStorage.clear()
  vi.restoreAllMocks()
  if (originalScroll) Element.prototype.scrollIntoView = originalScroll
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})
it('delays the session loading status without mounting protected content', async () => {
  vi.useFakeTimers()
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'fixture-token')
  let finish!: (value: unknown) => void
  api.GET.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  render(tree())
  expect(screen.getByRole('status').textContent).toBe('')
  expect(screen.queryByRole('heading', { level: 1, name: '支持中心' })).toBeNull()
  expect(screen.queryByTitle('支持面板')).toBeNull()
  act(() => vi.advanceTimersByTime(149))
  expect(screen.getByRole('status').textContent).toBe('')
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('status', { name: '正在确认登录状态…' })).toBeTruthy()
  expect(screen.queryByTitle('支持面板')).toBeNull()
  await act(async () => finish({ nickname: 'Tester', avatarUrl: null }))
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByTitle('支持面板')).toBeTruthy()
})

it('requires the real session restore result, then unloads protected content on cross-tab logout', async () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'fixture-token')
  let finish!: (value: unknown) => void
  api.GET.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  render(tree())
  expect(screen.queryByTitle('支持面板')).toBeNull()
  expect(api.GET).toHaveBeenCalledWith({ url: '/auth/me', method: 'GET', alert: false })
  await act(async () => finish({ nickname: 'Tester', avatarUrl: null }))
  expect(screen.getByTitle('支持面板')).toBeTruthy()
  act(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: AUTH_TOKEN_KEY,
        oldValue: 'fixture-token',
        newValue: null,
        storageArea: window.localStorage,
      }),
    )
  })
  await screen.findByText('登录后可访问支持中心')
  expect(screen.queryByTitle('支持面板')).toBeNull()
})
it('keeps a failed restore protected and retries through the real provider', async () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'fixture-token')
  api.GET.mockRejectedValueOnce(new Error('private transport details')).mockResolvedValueOnce({
    nickname: 'Tester',
    avatarUrl: null,
  })
  render(tree())
  await screen.findByRole('button', { name: '重试登录状态' })
  expect(screen.queryByTitle('支持面板')).toBeNull()
  expect(screen.queryByText('private transport details')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重试登录状态' }))
  await waitFor(() => expect(screen.getByTitle('支持面板')).toBeTruthy())
  api.POST.mockRejectedValue(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
  expect(screen.queryByTitle('支持面板')).toBeNull()
})
it('ignores a session response that arrives after logout', async () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'fixture-token')
  let finish!: (value: unknown) => void
  api.GET.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  api.POST.mockResolvedValue({ status: 'signed-out' })
  render(tree())
  fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
  await act(async () => finish({ nickname: 'Old user', avatarUrl: null }))
  expect(screen.queryByTitle('支持面板')).toBeNull()
  expect(screen.getByText('登录后可访问支持中心')).toBeTruthy()
})

it('cannot remount a Support loader that resolves after real logout', async () => {
  let finish!: (module: { default: typeof SupportRoutes }) => void
  const loadPage = vi.fn(() => {
    return new Promise<{ default: typeof SupportRoutes }>((resolve) => {
      finish = resolve
    })
  })
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'fixture-token')
  api.GET.mockResolvedValue({ nickname: 'Tester', avatarUrl: null })
  api.POST.mockResolvedValue({ status: 'signed-out' })
  render(
    <MemoryRouter initialEntries={['/support']}>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/support/*"
              element={
                <SupportAccess>
                  <PageAsyncBoundary loader={loadPage} loadingTitle="Loading page fixture">
                    {(module) => <module.default />}
                  </PageAsyncBoundary>
                </SupportAccess>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByText('Loading page fixture')
  expect(loadPage).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
  await screen.findByText('登录后可访问支持中心')
  await act(async () => finish({ default: SupportRoutes }))
  expect(screen.queryByTitle('Fixture panel')).toBeNull()
  expect(screen.queryByText('一起解决。')).toBeNull()
  expect(screen.getByText('登录后可访问支持中心')).toBeTruthy()
})

it('discards real useContent results after cross-tab logout during an article load', async () => {
  let finish!: (module: ContentModule) => void
  content.load.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'fixture-token')
  api.GET.mockResolvedValue({ nickname: 'Tester', avatarUrl: null })
  render(
    <MemoryRouter initialEntries={['/support/errors/example']}>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/support/*"
              element={
                <SupportAccess>
                  <SupportRoutes />
                </SupportAccess>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByText('正在加载内容…')
  expect(content.load).toHaveBeenCalledOnce()
  act(() => {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: AUTH_TOKEN_KEY,
        newValue: null,
        storageArea: window.localStorage,
      }),
    )
  })
  await screen.findByText('登录后可访问支持中心')
  await act(async () =>
    finish({
      default: () => (
        <>
          <h2 id="late">Late protected heading</h2>
          <p>Late protected body</p>
          <iframe title="Late protected iframe" />
        </>
      ),
    }),
  )
  expect(screen.queryByText('Late protected body')).toBeNull()
  expect(screen.queryByTitle('Late protected iframe')).toBeNull()
  expect(screen.queryByRole('navigation', { name: '正文目录' })).toBeNull()
})
