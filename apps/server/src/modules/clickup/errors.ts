export type ClickUpFailureKind =
  'unavailable' | 'invalid_input' | 'rejected' | 'rate_limited' | 'unknown'
export type ClickUpFailureCode =
  | 'CLICKUP_UNAVAILABLE'
  | 'CLICKUP_INVALID_INPUT'
  | 'UPSTREAM_REJECTED'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_CONFIGURATION'
  | 'UPSTREAM_UNKNOWN'
const messages: Record<ClickUpFailureKind, string> = {
  unavailable: 'ClickUp 服务不可用。',
  invalid_input: 'ClickUp 参数无效。',
  rejected: 'ClickUp 明确拒绝操作。',
  rate_limited: 'ClickUp 请求额度不足。',
  unknown: 'ClickUp 操作结果未知。',
}
export class ClickUpError extends Error {
  constructor(
    readonly kind: ClickUpFailureKind,
    readonly code: ClickUpFailureCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(messages[kind])
    this.name = 'ClickUpError'
  }
}
export const CLICKUP_TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
export function assertClickUpTaskId(id: string): void {
  if (typeof id !== 'string' || !CLICKUP_TASK_ID_PATTERN.test(id))
    throw new ClickUpError('invalid_input', 'CLICKUP_INVALID_INPUT')
}
export function clickUpTaskUrl(id: string): string {
  assertClickUpTaskId(id)
  return `https://app.clickup.com/t/${encodeURIComponent(id)}`
}
