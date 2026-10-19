// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SSO_SUCCESS_KEY } from '@web/src/auth/storage'

vi.mock('@exre/exui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@exre/exui')>()),
  useTheme: () => ({ theme: 'dark' }),
}))

vi.mock('@paper-design/shaders-react', () => ({
  MeshGradient: () => <div data-testid="auth-backdrop" />,
}))

import { SsoSuccess } from '@web/src/pages/AuthPage/SsoSuccess'

vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SsoSuccess', () => {
  it('shows the shared visual treatment and attempts to close after five seconds', () => {
    vi.useFakeTimers()
    window.sessionStorage.setItem(
      SSO_SUCCESS_KEY,
      JSON.stringify({
        ssoRequestId: 'a'.repeat(43),
        confirmedAt: Date.now(),
      }),
    )
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})

    const { container } = render(<SsoSuccess />)
    expect(screen.getByTestId('auth-backdrop')).toBeTruthy()
    expect(container.querySelectorAll('.ex-glass').length).toBeGreaterThan(0)
    expect(screen.getByText('登录成功')).toBeTruthy()
    expect(screen.getByText('正在返回应用')).toBeTruthy()

    act(() => vi.advanceTimersByTime(4999))
    expect(close).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(close).toHaveBeenCalledOnce()
    expect(screen.getByText('请手动关闭此页面并返回应用')).toBeTruthy()
  })

  it('does not claim success or close without a confirmation record', () => {
    vi.useFakeTimers()
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})

    const { container } = render(<SsoSuccess />)
    expect(screen.queryByText('登录成功')).toBeNull()
    expect(screen.getByRole('heading', { name: '发生错误' })).toBeTruthy()
    expect(screen.getByText('请从发起应用重新进入登录。')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/')
    expect(container.querySelectorAll('.ex-glass')).toHaveLength(2)
    expect(screen.getByRole('alert').closest('.ex-glass')).toBeTruthy()
    act(() => vi.advanceTimersByTime(5000))
    expect(close).not.toHaveBeenCalled()
  })
})
