import { createRuntime } from './runtime.js'
import type { SdkInstance, SessionExpiredHandler } from './request-types.js'
import type { Storage } from './storage/types.js'
const runtime = createRuntime(
  { environment: 'node' },
  async () => (await import('./storage/node.js')).transport,
)
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
