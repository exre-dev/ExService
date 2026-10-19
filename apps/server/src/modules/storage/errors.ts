/**
 * 存储模块的固定错误分类。
 *
 * 这里只产生安全分类与固定文案：云 SDK 的原始异常、SQL、路径和票据内容一律不回显。
 * 实际 HTTP 输出仍由 `apps/server/src/errors.ts` 的同一个 envelope 完成，本文件不建立第二套 envelope。
 */
export type StorageErrorCode =
  | 'STORAGE_INVALID_INPUT'
  | 'STORAGE_TICKET_FORBIDDEN'
  | 'STORAGE_NOT_FOUND'
  | 'STORAGE_CONFLICT'
  | 'STORAGE_TOO_LARGE'
  | 'STORAGE_UNSUPPORTED_MEDIA_TYPE'
  | 'STORAGE_TIMEOUT'
  | 'STORAGE_UPSTREAM_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_BUSY'
  | 'INTERNAL_ERROR'

const STORAGE_ERROR_DETAILS: Record<StorageErrorCode, { statusCode: number; message: string }> = {
  STORAGE_INVALID_INPUT: {
    statusCode: 400,
    message: '存储请求的 key、字段、内容类型或上传凭据不合法。',
  },
  STORAGE_TICKET_FORBIDDEN: { statusCode: 403, message: '上传凭据不属于当前用户。' },
  STORAGE_NOT_FOUND: { statusCode: 404, message: '对象不存在。' },
  STORAGE_CONFLICT: {
    statusCode: 409,
    message: '存储路径与已有文件冲突，或确认大小与申报大小不一致。',
  },
  STORAGE_TOO_LARGE: { statusCode: 413, message: '内容超过允许的大小。' },
  STORAGE_UNSUPPORTED_MEDIA_TYPE: { statusCode: 415, message: '不支持该请求或内容类型。' },
  STORAGE_TIMEOUT: { statusCode: 408, message: '上传或读取超时，请重试。' },
  STORAGE_UPSTREAM_FAILED: { statusCode: 502, message: '依赖的云服务暂时不可用。' },
  STORAGE_UNAVAILABLE: { statusCode: 503, message: '请求的存储介质未启用。' },
  STORAGE_BUSY: { statusCode: 503, message: '上传服务繁忙，请稍后重试。' },
  INTERNAL_ERROR: { statusCode: 500, message: 'An unexpected error occurred.' },
}

/**
 * 统一 envelope 通过结构识别的错误。字段与统一错误处理的契约一致，
 * 因此 `errors.ts` 不需要 import 存储模块就能输出它的 code 与状态。
 */
export class StorageError extends Error {
  readonly code: StorageErrorCode
  readonly statusCode: number
  readonly publicMessage: string
  readonly retryAfterSeconds?: number

  constructor(code: StorageErrorCode, options: { retryAfterSeconds?: number } = {}) {
    const details = STORAGE_ERROR_DETAILS[code]
    super(code)
    this.name = 'StorageError'
    this.code = code
    this.statusCode = details.statusCode
    this.publicMessage = details.message
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

/** 容量耗尽是唯一带 Retry-After 的存储错误。 */
export function storageBusy(): StorageError {
  return new StorageError('STORAGE_BUSY', { retryAfterSeconds: 5 })
}

/**
 * 把本地 I/O、云 SDK 与超时异常收敛成安全分类。
 * 原始 error 只用于分支判断，不进入对外消息。
 */
export function toStorageError(
  error: unknown,
  fallback: StorageErrorCode = 'INTERNAL_ERROR',
): StorageError {
  if (error instanceof StorageError) return error
  return new StorageError(fallback)
}
