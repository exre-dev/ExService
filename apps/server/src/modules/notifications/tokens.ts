import { createHmac, timingSafeEqual } from 'node:crypto'
import { NotificationError } from './errors.js'
import { CURSOR_TTL_MS } from './catalog.js'

/**
 * 签名的游标与操作令牌。
 *
 * 三类令牌各有自己的 purpose：分页游标、全部已读 read-through、清理预览快照。
 * purpose 参与签名，因此它们不能互换；token 还绑定 userId 与到期时间，
 * 跨身份或跨用途复用都会在验签时失败。
 *
 * 密钥来源：优先 `SERVER_NOTIFICATION_TOKEN_KEY`（32 字节十六进制）；
 * 未配置时由 `AUTH_CODE_HMAC_KEY` 经 HKDF-SHA256 派生一个独立子密钥，
 * info 串做域分离，避免与验证码/身份秘密复用同一密钥材料。
 * 不在日志、正文或响应里出现密钥。
 */

const KEY_INFO = 'exre.notification-token.v1'

export type TokenPurpose = 'cursor' | 'read_through' | 'clear_snapshot'

interface Payload {
  p: TokenPurpose
  u: string
  e: number
  [key: string]: string | number | string[]
}

export function deriveNotificationTokenKey(
  explicit: string | undefined,
  codeHmacKey: Buffer,
): Buffer {
  if (explicit !== undefined && explicit !== '') {
    if (!/^[0-9a-fA-F]{64}$/.test(explicit)) {
      throw new Error('SERVER_NOTIFICATION_TOKEN_KEY 必须是 32 个随机字节的 64 位十六进制编码。')
    }
    return Buffer.from(explicit, 'hex')
  }
  // HKDF-SHA256 (RFC 5869): extract then expand, both over the raw key bytes.
  const prk = createHmac('sha256', Buffer.alloc(0)).update(codeHmacKey).digest()
  const info = Buffer.concat([Buffer.from(KEY_INFO, 'utf8'), Buffer.from([1])])
  return createHmac('sha256', prk).update(info).digest()
}

export function signToken(
  key: Buffer,
  purpose: TokenPurpose,
  userId: string,
  now: number,
  expiresInMs: number,
  claims: Record<string, string | number | string[]> = {},
): string {
  // 保留字段放在最后：调用方传入的同名 claim 不能覆盖 purpose/userId/expiry。
  const payload: Payload = { ...claims, p: purpose, u: userId, e: now + expiresInMs }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', key).update(`${purpose}.${body}`).digest('base64url')
  return `${body}.${signature}`
}

export function verifyToken(
  key: Buffer,
  token: string,
  purpose: TokenPurpose,
  userId: string,
  now: number,
): Record<string, string | number | string[]> {
  const separator = token.indexOf('.')
  if (separator <= 0 || separator === token.length - 1)
    throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  const body = token.slice(0, separator)
  const provided = Buffer.from(token.slice(separator + 1), 'base64url')
  const expected = createHmac('sha256', key).update(`${purpose}.${body}`).digest()
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  }
  if (typeof payload !== 'object' || payload === null)
    throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  const claims = payload as Record<string, unknown>
  if (claims.p !== purpose) throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  if (claims.u !== userId) throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  if (typeof claims.e !== 'number' || !Number.isSafeInteger(claims.e)) {
    throw new NotificationError('NOTIFICATION_TOKEN_INVALID')
  }
  if (now > claims.e) throw new NotificationError('NOTIFICATION_TOKEN_EXPIRED')

  const result: Record<string, string | number | string[]> = {}
  for (const [name, value] of Object.entries(claims)) {
    if (name === 'p' || name === 'u' || name === 'e') continue
    if (typeof value === 'number' || typeof value === 'string') {
      result[name] = value
    } else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      result[name] = value as string[]
    }
  }
  return result
}

export function signCursor(
  key: Buffer,
  userId: string,
  now: number,
  claims: Record<string, string | number | string[]>,
): string {
  return signToken(key, 'cursor', userId, now, CURSOR_TTL_MS, claims)
}

export function verifyCursor(key: Buffer, token: string, userId: string, now: number) {
  return verifyToken(key, token, 'cursor', userId, now)
}
