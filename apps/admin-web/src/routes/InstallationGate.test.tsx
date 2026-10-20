// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import InstallationGate from './InstallationGate'
vi.mock('@admin/src/pages/Installation', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>完成安装</button>
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function response(installed: boolean) {
  return new Response(JSON.stringify({ msg: 'ok', data: { installed, ready: true, checks: [] } }))
}
function Location() {
  return (
    <>
      <span>{useLocation().pathname}</span>
      <Outlet />
    </>
  )
}
function mount(path = '/server/1/members') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Location />}>
          <Route element={<InstallationGate />}>
            <Route path="*" element={<p>应用内容</p>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}
it('blocks protected content and redirects an uninstalled deep link', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(false)),
  )
  mount()
  expect(screen.queryByText('应用内容')).toBeNull()
  await screen.findByText('/install')
  expect(screen.queryByText('应用内容')).toBeNull()
})
it('renders installed deep links without rewriting their route', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(true)),
  )
  mount()
  await screen.findByText('应用内容')
  expect(screen.getByText('/server/1/members')).toBeTruthy()
})
it('keeps initialization errors recoverable by retry', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(new Error('secret detail'))
      .mockImplementation(async () => response(true)),
  )
  mount()
  await screen.findByText('无法连接初始化服务')
  expect(screen.queryByText('secret detail')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重 试' }))
  await screen.findByText('应用内容')
})
it('rechecks status after completion and clears stale auth', async () => {
  localStorage.setItem('exre_token', 'stale')
  const { useAuth } = await import('@admin/src/auth/store')
  useAuth.setState({ token: 'stale' })
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(async () => response(false))
      .mockImplementation(async () => response(true)),
  )
  mount('/install')
  fireEvent.click(await screen.findByRole('button', { name: '完成安装' }))
  await screen.findByText('应用内容')
  await waitFor(() => expect(useAuth.getState().token).toBeNull())
})
