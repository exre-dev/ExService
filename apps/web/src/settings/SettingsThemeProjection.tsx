import { useEffect } from 'react'
import { useTheme } from '@exre/exui'
import type { SettingsTheme } from '@workspace/components'
import { settingsConfig } from '@web/src/settings/settingsConfig'

/** Keeps the in-memory settings projection current even while the panel is closed. */
export function SettingsThemeProjection() {
  const { theme } = useTheme()
  useEffect(() => {
    settingsConfig.general.theme = theme as SettingsTheme
  }, [theme])
  return null
}
