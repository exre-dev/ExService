// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@exre/exui'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WebsiteThemePreferenceReconciliation } from './WebsiteThemePreferenceReconciliation'

function Surface() {
  const { theme } = useTheme()
  return (
    <>
      <WebsiteThemePreferenceReconciliation />
      <output>{theme}</output>
    </>
  )
}
beforeEach(() => {
  localStorage.clear()
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => cleanup())

it('uses latest storage after delayed provider events, clear, and restoration without redundant writes', () => {
  localStorage.setItem('theme', 'dark')
  render(
    <ThemeProvider>
      <Surface />
    </ThemeProvider>,
  )
  const write = vi.spyOn(Storage.prototype, 'setItem')
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'theme', newValue: 'light', storageArea: localStorage }),
    ),
  )
  expect(screen.getByText('dark')).toBeTruthy()
  expect(localStorage.getItem('theme')).toBe('dark')
  write.mockClear()
  act(() => window.dispatchEvent(new Event('pageshow')))
  expect(write).not.toHaveBeenCalled()
  localStorage.clear()
  act(() =>
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage })),
  )
  expect(screen.getByText('system')).toBeTruthy()
  localStorage.setItem('theme', 'light')
  act(() => window.dispatchEvent(new Event('pageshow')))
  expect(screen.getByText('light')).toBeTruthy()
  write.mockRestore()
})
