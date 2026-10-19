export type FeedbackErrorCode =
  | 'FEEDBACK_INVALID_INPUT'
  | 'FEEDBACK_UPLOAD_TIMEOUT'
  | 'FEEDBACK_PAYLOAD_CONFLICT'
  | 'FEEDBACK_STATE_CONFLICT'
  | 'FEEDBACK_TOO_LARGE'
  | 'FEEDBACK_UNSUPPORTED_MEDIA'
  | 'FEEDBACK_RATE_LIMITED'
  | 'FEEDBACK_BUSY'
  | 'FEEDBACK_UNAVAILABLE'
  | 'NOT_FOUND'
const statuses: Record<FeedbackErrorCode, number> = {
  FEEDBACK_INVALID_INPUT: 400,
  FEEDBACK_UPLOAD_TIMEOUT: 408,
  FEEDBACK_PAYLOAD_CONFLICT: 409,
  FEEDBACK_STATE_CONFLICT: 409,
  FEEDBACK_TOO_LARGE: 413,
  FEEDBACK_UNSUPPORTED_MEDIA: 415,
  FEEDBACK_RATE_LIMITED: 429,
  FEEDBACK_BUSY: 429,
  FEEDBACK_UNAVAILABLE: 503,
  NOT_FOUND: 404,
}
export class FeedbackError extends Error {
  readonly statusCode: number
  readonly publicMessage = 'Feedback request could not be processed.'
  constructor(
    readonly code: FeedbackErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super('Feedback request rejected')
    this.statusCode = statuses[code]
  }
}
