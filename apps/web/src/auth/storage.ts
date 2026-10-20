import { setAccessToken } from '@workspace/sdk'

const browserOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
export const AUTH_TOKEN_KEY = `exwebsite.php.auth.v1:${encodeURIComponent(browserOrigin)}`
export const SSO_SUCCESS_KEY = `exwebsite.php.sso-success.v1:${encodeURIComponent(browserOrigin)}`
const ssoSuccessKey = () => `exwebsite.php.sso-success.v1:${encodeURIComponent(serviceRoot)}`
export const feedbackStorageKey = (userId: number, area: string) =>
  `exwebsite.php.feedback.v1:${encodeURIComponent(serviceRoot)}:${userId}:${area}`

/** Remove only retired Website credentials/pointers; never inspect or migrate their values. */
export function clearLegacySessionStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[name]
      const keys: string[] = []
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index)
        if (
          key &&
          (key === 'exwebsite.auth.token' ||
            key.startsWith('exwebsite.auth.token:') ||
            key === 'exwebsite.auth.sso-success' ||
            [
              'exwebsite.feedback.v1.request',
              'exwebsite.feedback.v1.bug',
              'exwebsite.feedback.v2',
              'exwebsite.feedback.community.v1',
            ].includes(key))
        )
          keys.push(key)
      }
      for (const key of keys) {
        try {
          storage.removeItem(key)
        } catch {
          /* cleanup is best effort */
        }
      }
    } catch {
      /* unavailable storage is never a legacy credential source */
    }
  }
}
interface ScopeState {
  suppressed?: { baseline: string | null | undefined }
  // A reader may release suppression before the storage synchronization runs.
  needsSdkRestore?: boolean
  persistedLogin?: { storage: Pick<Storage, 'setItem'>; token: string }
}
// Suppression belongs to the root even while another root is selected.
const scopes = new Map<string, ScopeState>()
let selected = { key: AUTH_TOKEN_KEY, custom: false }
let serviceRoot = browserOrigin
/** Resolve PHP-owned resources against the selected service, including deployment prefixes. */
export function serviceResourceUrl(value: string | null): string | null {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) return null
  return `${serviceRoot}/${value.replace(/^\/+/, '')}`
}
let revision = 0
const scopeState = () => {
  let state = scopes.get(selected.key)
  if (!state) {
    state = {}
    scopes.set(selected.key, state)
  }
  return state
}
export const sessionScopeRevision = (): number => revision

/** Called only after the SDK has accepted the root; use its URL normalization. */
export function selectSessionScope(baseUrl: string): void {
  const normalized = new URL(baseUrl, window.location.origin).href.replace(/\/+$/, '')
  const custom = normalized !== new URL(window.location.origin).origin
  const key = `exwebsite.php.auth.v1:${encodeURIComponent(normalized)}`
  serviceRoot = normalized
  if (key !== selected.key) {
    selected = { key, custom }
    revision++
  }
  syncSessionToken()
}
const subscribers = new Set<() => void>()

export function subscribeSessionChanges(listener: () => void): () => void {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

function changed(): void {
  for (const listener of subscribers) {
    try {
      listener()
    } catch {
      // An unreadable store in one consumer must not block other session owners.
    }
  }
}

export function startSessionSync(): () => void {
  // Both bootstrap and AuthProvider own a lease, but there is one DOM listener.
  if (!stopStorageListener) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== selected.key) return
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return
      } catch {
        return
      }
      syncSessionToken()
    }
    const owner = window
    owner.addEventListener('storage', onStorage)
    stopStorageListener = () => owner.removeEventListener('storage', onStorage)
  }
  syncLeases++
  let released = false
  return () => {
    if (!released) {
      released = true
      releaseSessionSync()
    }
  }
}
let syncLeases = 0
let stopStorageListener: (() => void) | undefined
function releaseSessionSync(): void {
  if (--syncLeases === 0) {
    stopStorageListener?.()
    stopStorageListener = undefined
  }
}

export function syncSessionToken(): string | null | undefined {
  try {
    const persistent = window.localStorage
    const token = readToken(persistent)
    const state = scopeState()
    if (selected.custom || state.needsSdkRestore) {
      setAccessToken(token)
      state.persistedLogin = token === null ? undefined : { storage: persistent, token }
      state.needsSdkRestore = undefined
    } else if (state.suppressed) {
      setAccessToken(null)
    }
    changed()
    return token
  } catch {
    // Returning to the default root resets SDK overrides. Restore logout suppression
    // even when its retained persistent value cannot currently be inspected.
    if (!selected.custom && scopeState().suppressed) setAccessToken(null)
    changed()
    return undefined
  }
}

/** Raw persistence is used only for account-switch comparisons, never UI restoration. */
export function readRawToken(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(selected.key)
}

export function readToken(storage: Pick<Storage, 'getItem'>): string | null {
  const raw = readRawToken(storage)
  const state = scopeState()
  const suppressed = state.suppressed
  if (suppressed && storage === window.localStorage) {
    if (suppressed.baseline === undefined) suppressed.baseline = raw
    if (suppressed.baseline === raw) return null
    state.suppressed = undefined
    state.needsSdkRestore = true
  }
  return raw
}

export function writeToken(storage: Pick<Storage, 'setItem'>, token: string): void {
  storage.setItem(selected.key, token)
  setAccessToken(token)
  scopeState().persistedLogin = { storage, token }
  scopeState().suppressed = undefined
  scopeState().needsSdkRestore = undefined
  changed()
}

export function removeMatchingToken(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  token: string,
): void {
  if (readRawToken(storage) === token) {
    storage.removeItem(selected.key)
    scopeState().persistedLogin = undefined
    if (selected.custom) setAccessToken(null)
    changed()
  }
}

/** Reconcile credentials installed by login or custom-root restoration. */
export function expirePersistedSession(): boolean {
  const state = scopeState()
  const owned = state.persistedLogin
  state.persistedLogin = undefined
  if (!owned) {
    try {
      return readRawToken(window.localStorage) === null
    } catch {
      return false
    }
  }
  let browserStorage: Storage
  try {
    browserStorage = window.localStorage
    if (owned.storage !== browserStorage) return false
    if (readRawToken(browserStorage) !== owned.token) {
      syncSessionToken()
      return false
    }
  } catch {
    // Only this owned value is suppressed when persistence becomes readable again.
    state.suppressed = { baseline: owned.token }
    return false
  }
  state.suppressed = { baseline: owned.token }
  try {
    browserStorage.removeItem(selected.key)
    const remaining = readRawToken(browserStorage)
    if (remaining !== null && remaining !== owned.token) syncSessionToken()
    return remaining === null
  } catch {
    /* keep the effective session anonymous */
    return false
  }
}

/** Explicit logout clears browser state before any remote revocation can finish. */
export function clearBrowserSession(): void {
  const state = scopeState()
  state.persistedLogin = undefined
  state.needsSdkRestore = undefined
  let baseline: string | null | undefined
  try {
    baseline = readRawToken(window.localStorage)
  } catch {
    /* adopt the first readable baseline */
  }
  state.suppressed = { baseline }
  try {
    window.localStorage.removeItem(selected.key)
  } catch {
    /* still clear in-memory authentication */
  }
  try {
    window.sessionStorage.removeItem(ssoSuccessKey())
  } catch {
    /* independent of token cleanup */
  }
  setAccessToken(null)
  changed()
}

export function writeSsoSuccess(
  storage: Pick<Storage, 'setItem'>,
  record: { ssoRequestId: string; confirmedAt: number },
): void {
  storage.setItem(ssoSuccessKey(), JSON.stringify(record))
}

export function readRecentSsoSuccess(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  now: number,
): { ssoRequestId: string; confirmedAt: number } | null {
  const raw = storage.getItem(ssoSuccessKey())
  if (raw === null) {
    return null
  }
  try {
    const value = JSON.parse(raw) as { ssoRequestId?: unknown; confirmedAt?: unknown }
    if (
      typeof value.ssoRequestId !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(value.ssoRequestId) ||
      typeof value.confirmedAt !== 'number' ||
      !Number.isSafeInteger(value.confirmedAt) ||
      now - value.confirmedAt < 0 ||
      now - value.confirmedAt > 5 * 60 * 1000
    ) {
      storage.removeItem(ssoSuccessKey())
      return null
    }
    return { ssoRequestId: value.ssoRequestId, confirmedAt: value.confirmedAt }
  } catch {
    storage.removeItem(ssoSuccessKey())
    return null
  }
}
