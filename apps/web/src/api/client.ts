import { setBaseUrl, setSessionExpiredHandler } from '@workspace/sdk'
import {
  expirePersistedSession,
  readToken,
  selectSessionScope,
  sessionScopeRevision,
  startSessionSync,
  subscribeSessionChanges,
  syncSessionToken,
} from '@web/src/auth/storage'
import { bindSettingsToken } from '@web/src/settings/settingsConfig'
import { bindNotificationsToken } from '@web/src/notifications/notificationsConfig'

let disposeActive: (() => void) | undefined

function syncSessionCaches(): void {
  let token: string | null = null
  try {
    token = readToken(window.localStorage)
  } catch {
    /* unavailable persistence cannot own cached user data */
  }
  bindSettingsToken(token)
  bindNotificationsToken(token)
}

/** Installs application navigation/session wiring before any request or React render. */
export function installSdkIntegration(): () => void {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`
  // Validation must precede changing the application's selected persistence scope.
  setBaseUrl(baseUrl)
  disposeActive?.()
  selectSessionScope(baseUrl)
  // Retained caches must change owners even while their UI consumers are unmounted.
  syncSessionCaches()
  const stopCacheSync = subscribeSessionChanges(syncSessionCaches)
  const scope = sessionScopeRevision()
  const stopSync = startSessionSync()
  let active = true
  setSessionExpiredHandler(() => {
    if (!active || scope !== sessionScopeRevision()) return
    expirePersistedSession()
    if (syncSessionToken() !== null) return
    if (window.location.pathname === '/support' || window.location.pathname.startsWith('/support/'))
      return
    if (window.location.pathname.startsWith('/identity/')) return
    if (
      window.location.pathname === '/login' &&
      new URLSearchParams(window.location.search).has('ssoRequestId')
    )
      return
    if (window.location.pathname !== '/login') window.location.replace('/login')
  })
  const dispose = () => {
    if (!active) return
    active = false
    stopCacheSync()
    stopSync()
    if (disposeActive === dispose) {
      setSessionExpiredHandler(null)
      disposeActive = undefined
    }
  }
  disposeActive = dispose
  return dispose
}
