import type { SdkInstance, SessionExpiredHandler } from './request-types.js'
import type { Storage } from './storage/types.js'
export declare const instance: SdkInstance
export declare const storage: Storage
export declare function setBaseUrl(url: string): void
export declare function setAccessToken(token: string | null): void
export declare function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void
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
