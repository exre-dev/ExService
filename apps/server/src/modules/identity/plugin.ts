import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { OidcService } from './oidc.js'

export interface IdentityPluginOptions {
  oidcServices?: OidcService
}

const plugin: FastifyPluginAsync<IdentityPluginOptions> = async (app, options) => {
  app.getDecorator('authServices')
  app.decorate('oidcServices', options.oidcServices)
}

export default fp(plugin, {
  name: 'business-identity',
  fastify: '5.x',
  dependencies: ['business-auth'],
  decorators: { fastify: ['authServices'] },
})
