// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { settingsConfig } from '@web/src/settings/settingsConfig'

const theme = vi.hoisted(() => ({ current: 'light' }))
vi.mock('@exre/exui', () => ({ useTheme: () => ({ theme: theme.current }) }))

import { SettingsThemeProjection } from '@web/src/settings/SettingsThemeProjection'

afterEach(() => {
  cleanup()
  theme.current = 'light'
  settingsConfig.general.theme = 'system'
})

describe('settings theme projection', () => {
  it('follows ExUI theme updates while no settings panel is mounted', async () => {
    const view = render(<SettingsThemeProjection />)
    await waitFor(() => expect(settingsConfig.general.theme).toBe('light'))
    theme.current = 'dark'
    view.rerender(<SettingsThemeProjection />)
    await waitFor(() => expect(settingsConfig.general.theme).toBe('dark'))
  })
})
