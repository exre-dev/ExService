/**
 * Docs 领域的固定错误码。
 *
 * 错误对象只携带 `code/statusCode/publicMessage`，由 `apps/server/src/errors.ts`
 * 的既有出口按结构化判定生成 envelope；统一出口是唯一记录日志的地方，
 * Docs handler 不再自行记一次。
 */
export type DocsErrorCode =
  | 'DOCS_INVALID_CONTENT'
  | 'DOCS_UNSUPPORTED_CONTENT'
  | 'DOCS_UNSAFE_CONTENT'
  | 'DOCS_NOT_FOUND'
  | 'DOCS_VERSION_CONFLICT'
  | 'DOCS_TREE_CHANGED'
  | 'DOCS_INVALID_MOVE'
  | 'DOCS_SPACE_NOT_EMPTY'
  | 'DOCS_ALREADY_TRASHED'
  | 'DOCS_RESTORE_ROOT_REQUIRED'
  | 'DOCS_LIMIT_EXCEEDED'
  | 'DOCS_UNSUPPORTED_MEDIA_TYPE'
  | 'DOCS_BUSY'
  | 'DOCS_FEATURE_NOT_IMPLEMENTED'

interface DocsErrorDetails {
  readonly statusCode: number
  readonly message: string
}

const DOCS_ERROR_DETAILS: Record<DocsErrorCode, DocsErrorDetails> = {
  DOCS_INVALID_CONTENT: { statusCode: 400, message: 'The document content is invalid.' },
  DOCS_UNSUPPORTED_CONTENT: {
    statusCode: 400,
    message: 'The document contains unsupported content.',
  },
  DOCS_UNSAFE_CONTENT: { statusCode: 400, message: 'The document contains an unsafe value.' },
  DOCS_NOT_FOUND: { statusCode: 404, message: 'The requested Docs resource was not found.' },
  DOCS_VERSION_CONFLICT: {
    statusCode: 409,
    message: 'The Docs resource has changed. Read it again before retrying.',
  },
  DOCS_TREE_CHANGED: {
    statusCode: 409,
    message: 'The document tree has changed. Restart pagination.',
  },
  DOCS_INVALID_MOVE: { statusCode: 409, message: 'The document cannot be moved to that location.' },
  DOCS_SPACE_NOT_EMPTY: {
    statusCode: 409,
    message: 'The space still contains documents or templates.',
  },
  DOCS_ALREADY_TRASHED: { statusCode: 409, message: 'The document is already in trash.' },
  DOCS_RESTORE_ROOT_REQUIRED: {
    statusCode: 409,
    message: 'Restore the root document of the deletion batch.',
  },
  DOCS_LIMIT_EXCEEDED: {
    statusCode: 413,
    message: 'The Docs request exceeds the supported limit.',
  },
  DOCS_UNSUPPORTED_MEDIA_TYPE: {
    statusCode: 415,
    message: 'The Docs request media type is not supported.',
  },
  DOCS_BUSY: { statusCode: 503, message: 'Docs is busy. Retry after reading the current state.' },
  DOCS_FEATURE_NOT_IMPLEMENTED: {
    statusCode: 501,
    message: 'This Docs feature is not implemented.',
  },
}

export class DocsError extends Error {
  readonly code: DocsErrorCode
  readonly statusCode: number
  readonly publicMessage: string
  readonly retryAfterSeconds?: number

  constructor(code: DocsErrorCode, options: { retryAfterSeconds?: number } = {}) {
    const details = DOCS_ERROR_DETAILS[code]
    super(code)
    this.name = 'DocsError'
    this.code = code
    this.statusCode = details.statusCode
    this.publicMessage = details.message
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

/** 锁/语句期限与数据库并发中止都是回滚后的固定 503，由统一出口生成 `Retry-After`。 */
export function docsBusy(): DocsError {
  return new DocsError('DOCS_BUSY', { retryAfterSeconds: 1 })
}

/** B 类预留 operation 的统一未实现响应。 */
export function docsNotImplemented(): DocsError {
  return new DocsError('DOCS_FEATURE_NOT_IMPLEMENTED')
}

/**
 * 结构合法但作用域不符的游标等请求级错误。
 *
 * 既有统一出口按结构化判定识别 `code/statusCode/publicMessage`，
 * 因此这里不需要把新错误类型 import 进 `errors.ts`。
 */
export function docsBadRequest(): Error {
  return Object.assign(new Error('BAD_REQUEST'), {
    code: 'BAD_REQUEST' as const,
    statusCode: 400,
    publicMessage: 'The request could not be processed.',
  })
}

/** 数据不变量损坏：公开读取不能返回可能不完整的结果，统一按未知内部错误处理。 */
export function docsCorrupted(): Error {
  return Object.assign(new Error('INTERNAL_ERROR'), {
    code: 'INTERNAL_ERROR' as const,
    statusCode: 500,
    publicMessage: 'An unexpected error occurred.',
  })
}
