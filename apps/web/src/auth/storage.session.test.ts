// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import {
  AUTH_TOKEN_KEY,
  SSO_SUCCESS_KEY,
  clearBrowserSession,
  expirePersistedSession,
  readRawToken,
  readToken,
  syncSessionToken,
  writeToken,
} from './storage'
import { setAccessToken } from '@workspace/sdk'
import {
  clearLegacySessionStorage,
  feedbackStorageKey,
  selectSessionScope,
  serviceResourceUrl,
  readRecentSsoSuccess,
  writeSsoSuccess,
} from './storage'
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  setAccessToken: vi.fn(),
}))
afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  syncSessionToken()
  vi.mocked(setAccessToken).mockClear()
})

it('removes only known legacy credentials and pointers without reading or migrating their values', () => {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of [
      'exwebsite.auth.token',
      'exwebsite.auth.token:old-root',
      'exwebsite.auth.sso-success',
      'exwebsite.feedback.v2',
      'exwebsite.feedback.community.v1',
    ])
      storage.setItem(key, 'old-private-value')
    storage.setItem('theme', 'dark')
    storage.setItem(AUTH_TOKEN_KEY, 'php-token')
    storage.setItem('exre_oauth_token', 'independent-php-oauth')
  }
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const clear = vi.spyOn(Storage.prototype, 'clear')
  clearLegacySessionStorage()
  clearLegacySessionStorage()
  expect(read).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
  for (const storage of [localStorage, sessionStorage]) {
    expect(storage.getItem('exwebsite.auth.token')).toBeNull()
    expect(storage.getItem('theme')).toBe('dark')
    expect(storage.getItem(AUTH_TOKEN_KEY)).toBe('php-token')
    expect(storage.getItem('exre_oauth_token')).toBe('independent-php-oauth')
  }
})

it('isolates SSO pointers, feedback user IDs and resource URLs by normalized service root', () => {
  try {
    selectSessionScope('https://service.example/backend/')
    writeSsoSuccess(sessionStorage, { ssoRequestId: 'a'.repeat(43), confirmedAt: 1000 })
    const first = feedbackStorageKey(42, 'community')
    expect(first).not.toBe(feedbackStorageKey(43, 'community'))
    expect(first).not.toBe(feedbackStorageKey(42, 'development'))
    expect(serviceResourceUrl('/avatar/image.webp')).toBe(
      'https://service.example/backend/avatar/image.webp',
    )
    expect(serviceResourceUrl('https://cdn.example/image.webp')).toBe(
      'https://cdn.example/image.webp',
    )
    expect(serviceResourceUrl('javascript:alert(1)')).toBeNull()
    selectSessionScope('https://service.example/other')
    expect(readRecentSsoSuccess(sessionStorage, 1001)).toBeNull()
    expect(feedbackStorageKey(42, 'community')).not.toBe(first)
    selectSessionScope('https://service.example/backend')
    expect(readRecentSsoSuccess(sessionStorage, 1001)?.ssoRequestId).toBe('a'.repeat(43))
  } finally {
    selectSessionScope('/')
  }
})

it.each(['throws', 'no-op', 'replacement'] as const)(
  'does not authorize expiry notification when persistent deletion %s',
  (mode) => {
    writeToken(window.localStorage, 'expired-token')
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      if (mode === 'throws') throw new Error('denied')
      if (mode === 'replacement') window.localStorage.setItem(AUTH_TOKEN_KEY, 'replacement-token')
    })
    expect(expirePersistedSession()).toBe(false)
    expect(readRawToken(window.localStorage)).toBe(
      mode === 'replacement' ? 'replacement-token' : 'expired-token',
    )
  },
)

it('authorizes expiry only after verified persistent removal', () => {
  writeToken(window.localStorage, 'expired-token')
  expect(expirePersistedSession()).toBe(true)
  expect(readRawToken(window.localStorage)).toBeNull()
})

it('suppresses a token whose deletion failed, then restores the same token only after successful login persistence', () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'same-token')
  window.sessionStorage.setItem(SSO_SUCCESS_KEY, 'old-record')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
    this: Storage,
    key: string,
  ) {
    if (this === window.localStorage) throw new Error('denied')
    Storage.prototype.clear.call(this)
  })
  clearBrowserSession()
  expect(readRawToken(window.localStorage)).toBe('same-token')
  expect(readToken(window.localStorage)).toBeNull()
  expect(syncSessionToken()).toBeNull()
  expect(window.sessionStorage.getItem(SSO_SUCCESS_KEY)).toBeNull()
  expect(setAccessToken).toHaveBeenLastCalledWith(null)
  remove.mockRestore()
  writeToken(window.localStorage, 'same-token')
  expect(readToken(window.localStorage)).toBe('same-token')
  expect(setAccessToken).toHaveBeenLastCalledWith('same-token')
})

it('does not hide a new cross-tab token with the UI suppression of a failed logout', () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  clearBrowserSession()
  remove.mockRestore()
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'new-token')
  expect(readRawToken(window.localStorage)).toBe('new-token')
  expect(syncSessionToken()).toBe('new-token')
  expect(readToken(window.localStorage)).toBe('new-token')
})

it('keeps suppression across unreadable storage and does not set credentials when login persistence fails', () => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, 'old-token')
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new Error('denied')
  })
  clearBrowserSession()
  remove.mockRestore()
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('unavailable')
  })
  expect(syncSessionToken()).toBeUndefined()
  read.mockRestore()
  expect(readToken(window.localStorage)).toBeNull()
  vi.mocked(setAccessToken).mockClear()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied')
  })
  expect(() => writeToken(window.localStorage, 'old-token')).toThrow('denied')
  expect(setAccessToken).not.toHaveBeenCalled()
  expect(readToken(window.localStorage)).toBeNull()
})
