// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const auth = vi.hoisted(() => ({
  status: 'authenticated' as 'authenticated' | 'anonymous' | 'loading',
}))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({
    state: { status: auth.status },
    modalMode: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    retrySession: vi.fn(),
    logout: vi.fn(),
  }),
}))
vi.mock('@workspace/components', () => ({
  SiteHeader: ({ auth: callbacks }: { auth: { onSettings: () => void } }) => (
    <button onClick={callbacks.onSettings}>设置菜单</button>
  ),
  AuthModal: () => null,
  NotificationBell: () => null,
  NotificationHistoryModal: () => null,
}))
vi.mock('@web/src/settings/SettingsExperience', () => ({
  SettingsModal: ({ initialCategory }: { initialCategory: string }) => (
    <div data-testid="settings-modal">{initialCategory}</div>
  ),
}))
vi.mock('react-router', () => ({ Outlet: () => null, useNavigate: () => vi.fn() }))
vi.mock('@web/src/auth/AuthFlow', () => ({ AuthFlow: () => null }))

import { RootLayout } from '@web/src/routes/RootLayout'

afterEach(() => {
  cleanup()
  auth.status = 'authenticated'
})

describe('RootLayout', () => {
  it('does not reopen settings for a new account after the old session becomes anonymous', async () => {
    const view = render(<RootLayout />)
    await userEvent.click(screen.getByRole('button', { name: '设置菜单' }))
    expect(screen.getByTestId('settings-modal').textContent).toBe('general')

    auth.status = 'anonymous'
    view.rerender(<RootLayout />)
    expect(screen.queryByTestId('settings-modal')).toBeNull()

    auth.status = 'loading'
    view.rerender(<RootLayout />)
    expect(screen.queryByTestId('settings-modal')).toBeNull()
  })
})
