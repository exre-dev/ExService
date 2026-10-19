import { describe, expect, it } from 'vitest'
import {
  AUTH_TOKEN_KEY,
  SSO_SUCCESS_KEY,
  readRecentSsoSuccess,
  removeMatchingToken,
} from '@web/src/auth/storage'

class MemoryStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
}

describe('auth storage', () => {
  it('does not let a stale request clear a newer token', () => {
    const storage = new MemoryStorage()
    storage.setItem(AUTH_TOKEN_KEY, 'new-token')

    removeMatchingToken(storage, 'old-token')

    expect(storage.getItem(AUTH_TOKEN_KEY)).toBe('new-token')
  })

  it('rejects an expired SSO success display record', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      SSO_SUCCESS_KEY,
      JSON.stringify({
        ssoRequestId: 'a'.repeat(43),
        confirmedAt: 1_000,
      }),
    )

    expect(readRecentSsoSuccess(storage, 301_001)).toBeNull()
    expect(storage.getItem(SSO_SUCCESS_KEY)).toBeNull()
  })
})
