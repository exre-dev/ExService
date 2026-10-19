import { useEffect } from 'react'
import { useTheme } from '@exre/exui'

/** Reconciles delayed storage events and page restoration through ExUI's public API. */
export function WebsiteThemePreferenceReconciliation() {
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    const reconcile = () => {
      const value = localStorage.getItem('theme')
      const current = value === 'light' || value === 'dark' ? value : 'system'
      if (theme !== current) setTheme(current)
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === 'theme' || event.key === null))
        reconcile()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconcile()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('pageshow', reconcile)
    document.addEventListener('visibilitychange', handleVisibility)
    reconcile()
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('pageshow', reconcile)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [theme, setTheme])
  return null
}
