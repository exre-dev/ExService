import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import openapiGlue from 'fastify-openapi-glue'
import { API_PREFIX, readContract, assertOperationCoverage } from '../contract/document.js'
import authApi from '../modules/auth/api/plugin.js'
import profileApi from '../modules/profile/api/plugin.js'
import joinApi from '../domains/join/api/plugin.js'
import identityApi, { type IdentityApiPluginOptions } from '../modules/identity/api/plugin.js'
import storageApi from '../modules/storage/api/plugin.js'
import notificationsApi from '../modules/notifications/api/plugin.js'
import supportApi from '../domains/support/api/plugin.js'
import systemApi from './system/plugin.js'
import { registerRequestNormalization } from './shared/request-normalization.js'
import { serviceHandlers } from './service-handlers.js'
import { createSecurityHandlers } from './security-handlers.js'

export interface WebsiteApiPluginOptions extends IdentityApiPluginOptions {}
const plugin: FastifyPluginAsync<WebsiteApiPluginOptions> = async (app, options) => {
  registerRequestNormalization(app)
  await app.register(authApi)
  await app.register(systemApi)
  await app.register(profileApi)
  await app.register(joinApi)
  await app.register(identityApi, options)
  await app.register(storageApi)
  await app.register(notificationsApi)
  await app.register(supportApi)
  const document = readContract()
  assertOperationCoverage(document, serviceHandlers)
  await app.register(openapiGlue, {
    specification: document,
    prefix: API_PREFIX,
    serviceHandlers,
    securityHandlers: createSecurityHandlers(options.identityKeys),
  })
}
export default fp(plugin, {
  name: 'website-api',
  fastify: '5.x',
  encapsulate: true,
  dependencies: ['http-foundation'],
})
