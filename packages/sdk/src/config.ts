import { ExAxiosError } from './http/errors.js'
import type { SessionExpiredHandler } from './request-types.js'

export type TokenRead = { kind: 'known'; value: string | null } | { kind: 'unavailable' }
export interface RuntimeEnvironment {
  environment: 'browser' | 'node'
  origin?: string
  readToken?: () => TokenRead
  clearToken?: (expected: string | null) => boolean
  notify?: (message: string) => void
  navigate?: (url: string) => void
}
export interface ConfigSnapshot {
  baseUrl: string | undefined
  scopeRevision: number
  tokenRevision: number
  token: string | null
  source: 'automatic' | 'explicit' | 'unavailable'
}
export const configError = () => new ExAxiosError('config', 'CONFIG_ERROR', '请求配置无效')
export function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/[\x00-\x20\x7f]/.test(value)
}
// Check the raw spelling before URL normalisation can erase traversal segments.
export function safePath(value: string): boolean {
  if (/[\\?#]/.test(value) || /%(?:2f|5c)/i.test(value)) return false
  return !value.split('/').some((part) => {
    try {
      const decoded = decodeURIComponent(part)
      return decoded === '.' || decoded === '..'
    } catch {
      return true
    }
  })
}
export function normalizeBase(value: string, environment: RuntimeEnvironment): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || !safePath(value))
    throw configError()
  let url: URL
  try {
    url = new URL(value, environment.environment === 'browser' ? environment.origin : undefined)
  } catch {
    throw configError()
  }
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (environment.environment === 'node' && !/^https?:\/\//i.test(value))
  )
    throw configError()
  return url.href.replace(/\/+$/, '')
}

export function createConfig(environment: RuntimeEnvironment) {
  const defaultBase =
    environment.environment === 'browser' && environment.origin
      ? new URL(environment.origin).origin
      : undefined
  let baseUrl = defaultBase
  let scopeRevision = 0,
    tokenRevision = 0
  let effectiveToken: string | null = null
  let lastReadable: TokenRead = { kind: 'unavailable' }
  let override: { value: string | null; baseline: TokenRead } | undefined
  let explicitToken: string | null = null
  let expiredRevision: string | undefined
  let handler: SessionExpiredHandler | null = null
  const currentRevision = () => `${scopeRevision}:${tokenRevision}`
  const automaticTarget = () => defaultBase !== undefined && baseUrl === defaultBase

  function read(): TokenRead {
    try {
      const result = environment.readToken?.()
      return result?.kind === 'known' && (result.value === null || typeof result.value === 'string')
        ? result
        : { kind: 'unavailable' }
    } catch {
      return { kind: 'unavailable' }
    }
  }
  function update(value: string | null) {
    if (effectiveToken !== value) {
      effectiveToken = value
      tokenRevision++
      expiredRevision = undefined
    }
  }
  function resolve(): ConfigSnapshot {
    let source: ConfigSnapshot['source'] = 'explicit'
    let token = explicitToken
    if (automaticTarget()) {
      const observed = read()
      if (observed.kind === 'known') {
        lastReadable = observed
        if (override) {
          if (override.baseline.kind === 'unavailable') override.baseline = observed
          else if (override.baseline.value !== observed.value) override = undefined
        }
      }
      if (override) token = override.value
      else if (observed.kind === 'known') {
        token = validToken(observed.value) ? observed.value : null
        source = 'automatic'
      } else {
        token = null
        source = 'unavailable'
      }
    }
    update(token)
    return { baseUrl, scopeRevision, tokenRevision, token, source }
  }
  function matches(expected: ConfigSnapshot, actual = resolve()): boolean {
    return (
      actual.scopeRevision === expected.scopeRevision &&
      actual.tokenRevision === expected.tokenRevision &&
      actual.baseUrl === expected.baseUrl
    )
  }
  function setBaseUrl(value: string) {
    const next = normalizeBase(value, environment)
    if (next === baseUrl) return
    baseUrl = next
    scopeRevision++
    tokenRevision++
    expiredRevision = undefined
    explicitToken = null
    override = undefined
    effectiveToken = null
    lastReadable = { kind: 'unavailable' }
    resolve()
  }
  function setAccessToken(value: string | null) {
    if (value !== null && !validToken(value)) throw configError()
    resolve()
    if (automaticTarget()) override = { value, baseline: lastReadable }
    else explicitToken = value
    update(value)
  }
  function setSessionExpiredHandler(value: SessionExpiredHandler | null) {
    if (value !== null && typeof value !== 'function') throw configError()
    handler = value
  }
  function expire(expected: ConfigSnapshot, error: ExAxiosError, alert: boolean): void {
    const actual = resolve()
    if (
      !matches(expected, actual) ||
      expiredRevision === currentRevision() ||
      actual.source === 'unavailable'
    )
      return
    if (actual.source === 'automatic') {
      let cleared = false
      try {
        cleared = environment.clearToken?.(actual.token) === true
      } catch {
        /* unreadable storage is not a successful clear */
      }
      const after = read()
      if (!cleared || after.kind !== 'known' || after.value !== null) {
        resolve()
        return
      }
      lastReadable = after
      override = { value: null, baseline: after }
    } else if (automaticTarget()) override = { value: null, baseline: lastReadable }
    else explicitToken = null
    update(null)
    expiredRevision = currentRevision()
    const revision = expiredRevision
    const notify = () => {
      if (!alert) return
      resolve()
      if (expiredRevision !== revision || currentRevision() !== revision) return
      try {
        environment.notify?.(error.message)
      } catch {
        /* preserve request error */
      }
    }
    const loginUrl = actual.baseUrl ? `${new URL(actual.baseUrl).origin}/login` : '/login'
    if (handler) {
      try {
        const result = handler({ error, loginUrl })
        if (result && typeof result === 'object' && typeof result.then === 'function') {
          void Promise.resolve(result)
            .then((value) => {
              if (value !== false) notify()
            })
            .catch(() => {})
        } else if (result !== false) notify()
      } catch {
        /* cleanup proof is unknown; preserve request error without notifying */
      }
    } else {
      notify()
      try {
        environment.navigate?.(loginUrl)
      } catch {
        /* preserve request error */
      }
    }
  }
  return { resolve, matches, setBaseUrl, setAccessToken, setSessionExpiredHandler, expire }
}
export type SdkConfig = ReturnType<typeof createConfig>
