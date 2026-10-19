import { describe, expect, it } from 'vitest'
import {
  deriveNotificationTokenKey,
  signCursor,
  signToken,
  verifyCursor,
  verifyToken,
} from './tokens.js'
import { NotificationError } from './errors.js'

const codeHmacKey = Buffer.alloc(32, 7)
const key = deriveNotificationTokenKey(undefined, codeHmacKey)
const now = 1_800_000_000_000

describe('notification token key', () => {
  it('derives a distinct key from the auth code HMAC key', () => {
    expect(key).toHaveLength(32)
    expect(key.equals(codeHmacKey)).toBe(false)
    expect(deriveNotificationTokenKey(undefined, codeHmacKey).equals(key)).toBe(true)
  })

  it('accepts an explicit 32-byte hex key and rejects other formats', () => {
    const explicit = 'ab'.repeat(32)
    expect(deriveNotificationTokenKey(explicit, codeHmacKey).toString('hex')).toBe(explicit)
    expect(() => deriveNotificationTokenKey('nope', codeHmacKey)).toThrow()
    expect(() => deriveNotificationTokenKey('zz'.repeat(32), codeHmacKey)).toThrow()
  })
})

describe('signed tokens', () => {
  it('round-trips claims bound to the purpose and user', () => {
    const token = signToken(key, 'read_through', 'user-1', now, 600_000, { s: 42 })
    expect(verifyToken(key, token, 'read_through', 'user-1', now)).toEqual({ s: 42 })
  })

  it('refuses a token reused for another purpose', () => {
    const token = signToken(key, 'read_through', 'user-1', now, 600_000, { s: 42 })
    expect(() => verifyToken(key, token, 'clear_snapshot', 'user-1', now)).toThrowError(
      NotificationError,
    )
  })

  it('refuses a token presented by another user', () => {
    const token = signToken(key, 'read_through', 'user-1', now, 600_000, { s: 42 })
    expect(() => verifyToken(key, token, 'read_through', 'user-2', now)).toThrowError(
      NotificationError,
    )
  })

  it('refuses a token after its expiry', () => {
    const token = signToken(key, 'read_through', 'user-1', now, 600_000, { s: 42 })
    expect(() => verifyToken(key, token, 'read_through', 'user-1', now + 600_001)).toThrowError(
      /NOTIFICATION_TOKEN_EXPIRED/,
    )
  })

  it('refuses a tampered payload and a truncated token', () => {
    const token = signToken(key, 'read_through', 'user-1', now, 600_000, { s: 42 })
    const [body, signature] = token.split('.')
    expect(() =>
      verifyToken(key, `${body}.${signature}x`, 'read_through', 'user-1', now),
    ).toThrowError(/NOTIFICATION_TOKEN_INVALID/)
    expect(() => verifyToken(key, body!, 'read_through', 'user-1', now)).toThrowError(
      /NOTIFICATION_TOKEN_INVALID/,
    )
    expect(() => verifyToken(key, `${body}.`, 'read_through', 'user-1', now)).toThrowError(
      /NOTIFICATION_TOKEN_INVALID/,
    )
  })

  it('refuses a token signed with another key', () => {
    const token = signToken(Buffer.alloc(32, 9), 'read_through', 'user-1', now, 600_000, { s: 42 })
    expect(() => verifyToken(key, token, 'read_through', 'user-1', now)).toThrowError(
      /NOTIFICATION_TOKEN_INVALID/,
    )
  })

  it('drops claims that are not strings, numbers or string arrays', () => {
    const claims = { s: 1, name: 'x', list: ['a', 'b'], nested: { a: 1 } }
    const token = signToken(
      key,
      'clear_snapshot',
      'user-1',
      now,
      600_000,
      claims as unknown as Record<string, string | number | string[]>,
    )
    expect(verifyToken(key, token, 'clear_snapshot', 'user-1', now)).toEqual({
      s: 1,
      name: 'x',
      list: ['a', 'b'],
    })
  })

  it('round-trips a signed cursor', () => {
    const cursor = signCursor(key, 'user-1', now, { v: 'history', s: '', c: '', up: 9, a: 3 })
    expect(verifyCursor(key, cursor, 'user-1', now)).toEqual({
      v: 'history',
      s: '',
      c: '',
      up: 9,
      a: 3,
    })
  })
})
