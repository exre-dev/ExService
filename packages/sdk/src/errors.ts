export type StorageSdkErrorCode =
  | 'CONFIG_CHANGED'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'TIMEOUT'
  | 'UPSTREAM_FAILED'
  | 'UNAVAILABLE'
  | 'BUSY'
  | 'NETWORK'
  | 'UNKNOWN'
import { ExAxiosError } from './http/errors.js'

const SERVER_CODE_TO_SDK_CODE: Record<string, StorageSdkErrorCode> = {
  STORAGE_INVALID_INPUT: 'INVALID_INPUT',
  STORAGE_TICKET_FORBIDDEN: 'FORBIDDEN',
  STORAGE_NOT_FOUND: 'NOT_FOUND',
  STORAGE_CONFLICT: 'CONFLICT',
  STORAGE_TOO_LARGE: 'TOO_LARGE',
  STORAGE_UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  STORAGE_TIMEOUT: 'TIMEOUT',
  STORAGE_UPSTREAM_FAILED: 'UPSTREAM_FAILED',
  STORAGE_UNAVAILABLE: 'UNAVAILABLE',
  STORAGE_BUSY: 'BUSY',
  SESSION_INVALID: 'UNAUTHORIZED',
  BAD_REQUEST: 'INVALID_INPUT',
  INTERNAL_ERROR: 'UNKNOWN',
  NOT_FOUND: 'NOT_FOUND',
}

/**
 * SDK 对外抛出的稳定错误。
 *
 * `message` 使用固定文案，避免服务端或云异常中的凭证、票据与签名 URL 外泄。
 */
export class StorageSdkError extends Error {
  readonly code: StorageSdkErrorCode
  readonly status?: number
  readonly requestId?: string

  constructor(
    code: StorageSdkErrorCode,
    options: { status?: number; requestId?: string; detail?: string } = {},
  ) {
    super(
      options.detail === undefined
        ? `storage upload failed: ${code}`
        : `storage upload failed: ${code} (${options.detail})`,
    )
    this.name = 'StorageSdkError'
    this.code = code
    this.status = options.status
    this.requestId = options.requestId
  }
}

export function serverCodeToSdkCode(code: unknown): StorageSdkErrorCode {
  return typeof code === 'string' && code in SERVER_CODE_TO_SDK_CODE
    ? SERVER_CODE_TO_SDK_CODE[code]!
    : 'UNKNOWN'
}

/**
 * 把服务端 envelope、HTTP 状态与网络异常统一成 StorageSdkError。
 * 云 SDK 的原始异常不直接作为展示文案。
 */
export function toStorageSdkError(input: {
  error?: unknown
  status?: number
  cause?: unknown
}): StorageSdkError {
  const { error, status, cause } = input
  if (cause instanceof StorageSdkError) return cause
  if (cause instanceof ExAxiosError) {
    const code =
      cause.code === 'SESSION_INVALID'
        ? 'UNAUTHORIZED'
        : cause.code === 'TIMEOUT' || cause.code === 'CANCELLED'
          ? 'TIMEOUT'
          : cause.code === 'NETWORK_ERROR'
            ? 'NETWORK'
            : serverCodeToSdkCode(cause.code)
    return new StorageSdkError(code, { status: cause.status, requestId: cause.requestId })
  }
  const envelope =
    typeof error === 'object' && error !== null
      ? (error as { error?: { code?: unknown; message?: unknown; requestId?: unknown } }).error
      : undefined
  const code = serverCodeToSdkCode(envelope?.code)
  const requestId = typeof envelope?.requestId === 'string' ? envelope.requestId : undefined
  if (code !== 'UNKNOWN') {
    return new StorageSdkError(code, { status, requestId })
  }
  if (cause !== undefined) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      return new StorageSdkError('TIMEOUT', { status })
    }
    return new StorageSdkError('NETWORK', { status })
  }
  return new StorageSdkError('UNKNOWN', { status, requestId })
}
