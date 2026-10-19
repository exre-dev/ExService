import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { BusinessServices } from './business-services.js'
import businessPlugins from './business-plugins.js'
import httpFoundation from './http/foundation.js'
import websiteApi from './http/plugin.js'

export { API_PREFIX, OPENAPI_PATH } from './contract/document.js'
export { serviceHandlers } from './http/service-handlers.js'

export interface CreateAppOptions extends BusinessServices {
  identityKeys?: { clients: Record<string, string>; bootstrapKey?: string }
  /**
   * 测试中保持静默；`server.ts` 开启日志，以便用 requestId 关联日志与响应。
   */
  logger?: FastifyServerOptions['logger']
  /** 由监听入口显式限定可信代理；默认不信任客户端转发头。 */
  trustProxy?: FastifyServerOptions['trustProxy']
  corsAllowedOrigins?: ReadonlySet<string>
  /**
   * 请求 ID 生成器；缺省沿用 Fastify 的自增生成器。
   *
   * `requestIdHeader` 恒为 false，传入的 `x-request-id` 永不被采信；
   * 这个选项只让测试把请求 ID 固定成确定值，便于逐字节比较错误 envelope。
   */
  genReqId?: FastifyServerOptions['genReqId']
}

/** Create synchronously; service decorators and API routes become available after Fastify boot. */
export function createApp({
  authServices,
  profileServices,
  joinServices,
  invitationServices,
  storageServices,
  notifications,
  clickupServices,
  supportServices,
  identityKeys,
  oidcServices,
  logger = false,
  trustProxy = false,
  corsAllowedOrigins = new Set(),
  genReqId,
}: CreateAppOptions): FastifyInstance {
  const app = Fastify({
    logger,
    trustProxy,
    requestIdHeader: false,
    bodyLimit: 4 * 1024 * 1024,
    genReqId,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  })
  app.register(
    businessPlugins,
    Object.freeze({
      authServices,
      profileServices,
      joinServices,
      invitationServices,
      storageServices,
      notifications,
      oidcServices,
      clickupServices,
      supportServices,
    }),
  )
  app.register(httpFoundation, { origins: corsAllowedOrigins })
  app.register(websiteApi, { identityKeys })
  return app
}
