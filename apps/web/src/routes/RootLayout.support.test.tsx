// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router'
import type { ReactNode } from 'react'
import type { SiteOutletContext } from './RootLayout'

const auth = vi.hoisted(() => ({
  modalMode: null as 'login' | null,
  showPrompt: true,
  openModal: vi.fn(),
}))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({
    state: { status: 'anonymous' },
    modalMode: auth.modalMode,
    openModal: auth.openModal,
    closeModal: vi.fn(),
    retrySession: vi.fn(),
    logout: vi.fn(),
  }),
}))
vi.mock('@workspace/components', () => ({
  SiteHeader: ({
    auth: props,
    mobileMenuButtonRef,
  }: {
    auth: { onLogin(): void; loginButtonRef: React.Ref<HTMLButtonElement> }
    mobileMenuButtonRef: React.Ref<HTMLSpanElement>
  }) => (
    <>
      <button ref={props.loginButtonRef} onClick={props.onLogin}>
        顶栏登录
      </button>
      <span ref={mobileMenuButtonRef}>
        <button>移动账号</button>
      </span>
    </>
  ),
  AuthModal: ({
    children,
    onCloseAutoFocus,
  }: {
    children: ReactNode
    onCloseAutoFocus(event: { preventDefault(): void }): void
  }) => (
    <div>
      {children}
      <button onClick={() => onCloseAutoFocus({ preventDefault: vi.fn() })}>
        模拟关闭焦点事件
      </button>
    </div>
  ),
}))
vi.mock('@web/src/notifications/NotificationsExperience', () => ({
  NotificationsProvider: ({ children }: { children: ReactNode }) => children,
  NotificationBellSlot: () => null,
  NotificationHistoryModalSlot: () => null,
}))
vi.mock('@web/src/settings/SettingsExperience', () => ({ SettingsModal: () => null }))
vi.mock('@web/src/invitations/InvitationRegistrationFlow', () => ({
  InvitationRegistrationFlow: () => null,
}))
vi.mock('@web/src/auth/AuthFlow', () => ({
  AuthFlow: ({ initialEmail }: { initialEmail: string }) => (
    <span data-testid="email">{initialEmail}</span>
  ),
}))
import { RootLayout } from './RootLayout'

function Prompt() {
  const { requestLogin } = useOutletContext<SiteOutletContext>()
  return auth.showPrompt ? (
    <button onClick={(event) => requestLogin(event.currentTarget)}>支持页登录</button>
  ) : null
}
function tree() {
  return (
    <MemoryRouter initialEntries={['/support/errors/example']}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/support/*" element={<Prompt />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  auth.modalMode = null
  auth.showPrompt = true
})
it('uses the existing login modal and returns focus to the page trigger on close', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const view = render(tree())
  const trigger = screen.getByRole('button', { name: '支持页登录' })
  fireEvent.click(trigger)
  expect(auth.openModal).toHaveBeenCalledWith('login')
  auth.modalMode = 'login'
  view.rerender(tree())
  expect(screen.getByTestId('email').textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '模拟关闭焦点事件' }))
  expect(document.activeElement).toBe(trigger)
})
it('clears the page trigger when the header starts a new login', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const view = render(tree())
  fireEvent.click(screen.getByRole('button', { name: '支持页登录' }))
  fireEvent.click(screen.getByRole('button', { name: '顶栏登录' }))
  auth.modalMode = 'login'
  view.rerender(tree())
  fireEvent.click(screen.getByRole('button', { name: '模拟关闭焦点事件' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '顶栏登录' }))
})
it('falls back to the mobile account trigger when the page trigger is disconnected', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const view = render(tree())
  const trigger = screen.getByRole('button', { name: '支持页登录' })
  fireEvent.click(trigger)
  auth.modalMode = 'login'
  view.rerender(tree())
  auth.showPrompt = false
  view.rerender(tree())
  fireEvent.click(screen.getByRole('button', { name: '模拟关闭焦点事件' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '移动账号' }))
})
