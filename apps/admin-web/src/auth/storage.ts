import type { Schema } from '@admin/src/api/types'

export type CurrentUser = Schema<'AccountLoginUser'>
export interface Session {
  token: string | null
  user: CurrentUser | null
}

export function readToken(): string | null {
  try {
    return localStorage.getItem('exre_token')
  } catch {
    return null
  }
}
export function loadSession(): Session {
  try {
    const token = readToken()
    const user: unknown = JSON.parse(localStorage.getItem('exre_user') || 'null')
    if (token && isCurrentUser(user)) return { token, user }
  } catch {
    /* Invalid or unavailable storage starts anonymously. */
  }
  clearSession()
  return { token: null, user: null }
}
function isCurrentUser(value: unknown): value is CurrentUser {
  if (!value || typeof value !== 'object') return false
  return (
    'id' in value &&
    typeof value.id === 'number' &&
    'email' in value &&
    typeof value.email === 'string' &&
    'username' in value &&
    typeof value.username === 'string' &&
    'avatar' in value &&
    (value.avatar === null || typeof value.avatar === 'string') &&
    'platform_role' in value &&
    (value.platform_role === null || typeof value.platform_role === 'string')
  )
}
export function saveSession(token: string, user: CurrentUser): void {
  try {
    localStorage.setItem('exre_user', JSON.stringify(user))
    localStorage.setItem('exre_token', token)
  } catch {
    clearSession()
    throw new Error('无法保存登录状态，请检查浏览器存储后重试')
  }
}
export function clearSession(): void {
  for (const key of ['exre_token', 'exre_user']) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* Memory logout must still complete. */
    }
  }
}
