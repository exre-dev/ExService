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

const STATUS_CODE: Record<number, StorageSdkErrorCode> = {
  400: 'INVALID_INPUT',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'INVALID_INPUT',
  429: 'BUSY',
  503: 'UNAVAILABLE',
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

/**
 * 仅按传输分类和真实 HTTP 状态转换，不从 PHP 的中文 msg 猜测业务码。
 */
export function toStorageSdkError(input: { status?: number; cause?: unknown }): StorageSdkError {
  const { status, cause } = input
  if (cause instanceof StorageSdkError) return cause
  if (cause instanceof ExAxiosError) {
    const code =
      cause.code === 'TIMEOUT' || cause.code === 'CANCELLED'
        ? 'TIMEOUT'
        : cause.code === 'NETWORK_ERROR'
          ? 'NETWORK'
          : cause.status === undefined
            ? 'UNKNOWN'
            : (STATUS_CODE[cause.status] ?? 'UNKNOWN')
    return new StorageSdkError(code, { status: cause.status, requestId: cause.requestId })
  }
  if (cause !== undefined) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      return new StorageSdkError('TIMEOUT', { status })
    }
    return new StorageSdkError('NETWORK', { status })
  }
  return new StorageSdkError(
    status === undefined ? 'UNKNOWN' : (STATUS_CODE[status] ?? 'UNKNOWN'),
    { status },
  )
}
