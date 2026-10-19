/**
 * 通知模块的固定错误码。
 *
 * 对外只暴露 code 与固定文案：`apps/server/src/errors.ts` 会将带
 * `code/statusCode/publicMessage` 的错误转成 Contract 的 ErrorEnvelope，
 * 其余异常的 `message` 一律不回显。
 */
export type NotificationErrorCode =
  | 'CONTENT_UNSAFE'
  | 'CONTENT_TOO_LARGE'
  | 'NOTIFICATION_NOT_FOUND'
  | 'NOTIFICATION_STATE_CONFLICT'
  | 'NOTIFICATION_TOKEN_INVALID'
  | 'NOTIFICATION_TOKEN_EXPIRED'
  | 'NOTIFICATION_REQUEST_CONFLICT'
  | 'NOTIFICATION_BATCH_NOT_FOUND'
  | 'NOTIFICATION_PREFERENCES_CONFLICT'
  | 'NOTIFICATION_AUDIENCE_INVALID'
  | 'NOTIFICATION_EVENT_CONFLICT'
  | 'NOTIFICATION_PUBLISH_FORBIDDEN'
  | 'NOTIFICATION_UNSUPPORTED'
  | 'NOTIFICATION_QUERY_INVALID'
  | 'NOTIFICATION_BUSY'

const DETAILS: Record<NotificationErrorCode, { statusCode: number; message: string }> = {
  CONTENT_UNSAFE: { statusCode: 400, message: '通知正文包含不受支持或不安全的内容。' },
  CONTENT_TOO_LARGE: { statusCode: 413, message: '通知内容超出允许的长度。' },
  NOTIFICATION_NOT_FOUND: { statusCode: 404, message: '通知不存在或已不可见。' },
  NOTIFICATION_STATE_CONFLICT: { statusCode: 409, message: '通知状态已变化，请刷新后重试。' },
  NOTIFICATION_TOKEN_INVALID: { statusCode: 400, message: '操作令牌无效，请重新发起。' },
  NOTIFICATION_TOKEN_EXPIRED: { statusCode: 410, message: '操作令牌已过期，请重新发起。' },
  NOTIFICATION_REQUEST_CONFLICT: {
    statusCode: 409,
    message: '相同请求标识携带了不同内容，请确认后重试。',
  },
  NOTIFICATION_BATCH_NOT_FOUND: { statusCode: 404, message: '清理记录不存在。' },
  NOTIFICATION_PREFERENCES_CONFLICT: {
    statusCode: 409,
    message: '通知偏好已变化，请重新读取后再保存。',
  },
  NOTIFICATION_AUDIENCE_INVALID: { statusCode: 400, message: '通知受众无效。' },
  NOTIFICATION_EVENT_CONFLICT: { statusCode: 409, message: '相同事件标识携带了不同内容。' },
  NOTIFICATION_PUBLISH_FORBIDDEN: { statusCode: 403, message: '当前身份不能发布该通知。' },
  NOTIFICATION_UNSUPPORTED: { statusCode: 400, message: '该通知能力尚未接入。' },
  NOTIFICATION_QUERY_INVALID: { statusCode: 400, message: '查询参数不合法。' },
  NOTIFICATION_BUSY: { statusCode: 503, message: '服务繁忙，请稍后重试。' },
}

export class NotificationError extends Error {
  readonly statusCode: number
  readonly publicMessage: string

  constructor(readonly code: NotificationErrorCode) {
    super(code)
    this.name = 'NotificationError'
    this.statusCode = DETAILS[code].statusCode
    this.publicMessage = DETAILS[code].message
  }
}
