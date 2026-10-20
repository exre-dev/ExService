import { createConfig, type RuntimeEnvironment } from './config.js'
import { createHttpCore } from './http/core.js'
import type { SdkInstance, SessionExpiredHandler } from './request-types.js'
import { createStorage } from './storage/core.js'
import type { Storage } from './storage/types.js'

export interface SdkRuntime {
  instance: SdkInstance
  storage: Storage
  setBaseUrl: (url: string) => void
  setAccessToken: (token: string | null) => void
  setSessionExpiredHandler: (handler: SessionExpiredHandler | null) => void
}
/** Private assembly seam shared by each environment entry and behavioral tests. */
export function createRuntime(
  environment: RuntimeEnvironment,
  requestPolicy: { timeoutMs?: number; signal?: AbortSignal } = {},
): SdkRuntime {
  const state = createConfig(environment)
  const request = createHttpCore(environment, state)
  return {
    instance: request as unknown as SdkInstance,
    storage: createStorage(state, request, requestPolicy),
    setBaseUrl: state.setBaseUrl,
    setAccessToken: state.setAccessToken,
    setSessionExpiredHandler: state.setSessionExpiredHandler,
  }
}
