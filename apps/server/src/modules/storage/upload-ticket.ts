import { createHmac, timingSafeEqual } from 'node:crypto'
import { StorageError } from '@server/src/modules/storage/errors.js'

/** 与 Contract 的 StorageUploadTicket.maxLength 一致。 */
export const UPLOAD_TICKET_MAX_LENGTH = 4096
export const UPLOAD_TICKET_VERSION = 1
/** 凭据有效期上限，与 STS DurationSeconds 对齐。 */
export const UPLOAD_TICKET_MAX_TTL_SECONDS = 30 * 60

export interface UploadTicketPayload {
  v: typeof UPLOAD_TICKET_VERSION
  userId: string
  bucket: string
  region: string
  key: string
  size: number
  contentType: string
  /** Unix 秒。 */
  iat: number
  /** Unix 秒。 */
  exp: number
}

export interface VerifyUploadTicketInput {
  ticket: string
  hmacKey: Buffer
  userId: string
  bucket: string
  region: string
  /** 当前配置上限；凭据中的申报大小也要重新受它约束。 */
  maxBytes: number
  /** Unix 秒，由调用方注入以便测试。 */
  nowSeconds: number
}

const PAYLOAD_KEYS = [
  'v',
  'userId',
  'bucket',
  'region',
  'key',
  'size',
  'contentType',
  'iat',
  'exp',
] as const
const BASE64URL = /^[A-Za-z0-9_-]+$/
const MAX_FIELD_LENGTH = 512

/** `base64url(payload-json).base64url(hmac-sha256(payload-part))`；算法固定，客户端不可选择。 */
export function signUploadTicket(payload: UploadTicketPayload, hmacKey: Buffer): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', hmacKey).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function safeNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/**
 * 验证顺序：长度与结构 → 固定 HMAC 算法 → 签名 → 版本与有效时间 → 当前用户
 * → key 与当前 bucket/region → 当前大小上限。
 *
 * 任一环节失败都用同一个 400 分类，不区分“格式错”与“签名错”。
 */
export function verifyUploadTicket(input: VerifyUploadTicketInput): UploadTicketPayload {
  const { ticket, hmacKey, userId, bucket, region, maxBytes, nowSeconds } = input

  if (
    typeof ticket !== 'string' ||
    ticket.length === 0 ||
    ticket.length > UPLOAD_TICKET_MAX_LENGTH
  ) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  const separator = ticket.indexOf('.')
  if (
    separator <= 0 ||
    separator === ticket.length - 1 ||
    ticket.indexOf('.', separator + 1) !== -1
  ) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  const encoded = ticket.slice(0, separator)
  const signature = ticket.slice(separator + 1)
  if (!BASE64URL.test(encoded) || !BASE64URL.test(signature)) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }

  // 签名数据为编码后的原始 payload part。
  const expected = createHmac('sha256', hmacKey).update(encoded).digest()
  const provided = Buffer.from(signature, 'base64url')
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  const candidate = parsed as Record<string, unknown>
  const keys = Object.keys(candidate)
  if (keys.length !== PAYLOAD_KEYS.length || PAYLOAD_KEYS.some((key) => !(key in candidate))) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }

  const iat = safeNonNegativeInteger(candidate.iat)
  const exp = safeNonNegativeInteger(candidate.exp)
  if (candidate.v !== UPLOAD_TICKET_VERSION || iat === undefined || exp === undefined) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  if (exp <= iat || exp - iat > UPLOAD_TICKET_MAX_TTL_SECONDS)
    throw new StorageError('STORAGE_INVALID_INPUT')
  if (nowSeconds < iat || nowSeconds >= exp) throw new StorageError('STORAGE_INVALID_INPUT')

  const size = safeNonNegativeInteger(candidate.size)
  if (size === undefined || size > maxBytes) throw new StorageError('STORAGE_INVALID_INPUT')

  for (const field of ['userId', 'bucket', 'region', 'key', 'contentType'] as const) {
    const value = candidate[field]
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD_LENGTH) {
      throw new StorageError('STORAGE_INVALID_INPUT')
    }
  }

  const payload = candidate as unknown as UploadTicketPayload
  if (payload.userId !== userId) throw new StorageError('STORAGE_TICKET_FORBIDDEN')
  // 只信任当前配置的 bucket/region；凭据中的值仅用于比对。
  if (payload.bucket !== bucket || payload.region !== region)
    throw new StorageError('STORAGE_INVALID_INPUT')
  return payload
}
