import { toast } from '@exre/exui'
import { createRuntime } from './runtime.js'
import type { RuntimeEnvironment } from './config.js'
import type { SdkInstance, SessionExpiredHandler } from './request-types.js'
import type { Storage } from './storage/types.js'
const tokenKey = `exwebsite.php.auth.v1:${encodeURIComponent(typeof location === 'undefined' ? '' : location.origin)}`
const environment: RuntimeEnvironment = {
  environment: 'browser',
  origin: typeof location === 'undefined' ? undefined : location.origin,
  readToken: () => {
    try {
      return { kind: 'known', value: localStorage.getItem(tokenKey) }
    } catch {
      return { kind: 'unavailable' }
    }
  },
  clearToken: (expected) => {
    try {
      if (localStorage.getItem(tokenKey) !== expected) return false
      if (expected !== null) localStorage.removeItem(tokenKey)
      return true
    } catch {
      return false
    }
  },
  notify: (message) => toast.error(message),
  navigate: (url) => {
    if (typeof location === 'undefined') return
    const target = new URL(url, location.href)
    if (
      location.origin !== target.origin ||
      location.pathname !== target.pathname ||
      location.search !== target.search
    )
      location.replace(target.href)
  },
}
const runtime = createRuntime(environment)
export const instance: SdkInstance = runtime.instance
export const storage: Storage = runtime.storage
export const setBaseUrl: (url: string) => void = runtime.setBaseUrl
export const setAccessToken: (token: string | null) => void = runtime.setAccessToken
export const setSessionExpiredHandler: (handler: SessionExpiredHandler | null) => void =
  runtime.setSessionExpiredHandler
export { ExAxiosError } from './http/errors.js'
export type { ExAxiosErrorKind } from './http/errors.js'
export { StorageSdkError } from './errors.js'
export type { StorageSdkErrorCode } from './errors.js'
export type {
  RequestConfig,
  SdkInstance,
  SessionExpiredContext,
  SessionExpiredHandler,
} from './request-types.js'
export type { Storage, UploadOptions, UploadData, Medium } from './storage/types.js'
export type { paths, operations, components } from './generated/schema.js'
