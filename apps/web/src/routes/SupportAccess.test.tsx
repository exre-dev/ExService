// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router'
import { lazy, Suspense } from 'react'

const auth = vi.hoisted(() => ({ status: 'loading', retrySession: vi.fn() }))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({ state: { status: auth.status }, retrySession: auth.retrySession }),
}))
import { SupportAccess } from './SupportAccess'
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  auth.status = 'loading'
})

it('never mounts protected content in loading, anonymous or unavailable states, and preserves the deep link', () => {
  const load = vi.fn(async () => ({ default: () => <iframe title="Protected view" /> }))
  const Page = lazy(load)
  const requestLogin = vi.fn()
  function Layout() {
    return (
      <>
        <span>{useLocation().pathname}</span>
        <Outlet context={{ requestLogin }} />
      </>
    )
  }
  const tree = (
    <MemoryRouter initialEntries={['/support/errors/example']}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/support/*"
            element={
              <SupportAccess>
                <Suspense>
                  <Page />
                </Suspense>
              </SupportAccess>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  const view = render(tree)
  expect(screen.getByRole('status').textContent).toContain('正在确认登录状态')
  auth.status = 'anonymous'
  view.rerender(
    <MemoryRouter initialEntries={['/support/errors/example']}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/support/*"
            element={
              <SupportAccess>
                <Suspense>
                  <Page />
                </Suspense>
              </SupportAccess>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  const button = screen.getByRole('button', { name: '登录' })
  fireEvent.click(button)
  expect(requestLogin).toHaveBeenCalledWith(button)
  expect(screen.getByText('/support/errors/example')).toBeTruthy()
  auth.status = 'unavailable'
  view.rerender(
    <MemoryRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/support/*"
            element={
              <SupportAccess>
                <Suspense>
                  <Page />
                </Suspense>
              </SupportAccess>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: '重试登录状态' }))
  expect(auth.retrySession).toHaveBeenCalledOnce()
  expect(load).not.toHaveBeenCalled()
})

it('mounts only after confirmation and unmounts immediately when authentication changes', () => {
  auth.status = 'authenticated'
  const mount = vi.fn()
  function Page() {
    mount()
    return <iframe title="Protected view" />
  }
  const view = render(
    <MemoryRouter>
      <SupportAccess>
        <Page />
      </SupportAccess>
    </MemoryRouter>,
  )
  expect(screen.getByTitle('Protected view')).toBeTruthy()
  auth.status = 'loading'
  view.rerender(
    <MemoryRouter>
      <SupportAccess>
        <Page />
      </SupportAccess>
    </MemoryRouter>,
  )
  expect(screen.queryByTitle('Protected view')).toBeNull()
  auth.status = 'anonymous'
  view.rerender(
    <MemoryRouter>
      <SupportAccess>
        <Page />
      </SupportAccess>
    </MemoryRouter>,
  )
  expect(mount).toHaveBeenCalledOnce()
})
