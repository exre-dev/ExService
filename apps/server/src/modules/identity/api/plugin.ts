import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

export interface IdentityApiPluginOptions {
  identityKeys?: { clients: Record<string, string>; bootstrapKey?: string }
}

const plugin: FastifyPluginAsync<IdentityApiPluginOptions> = async (app) => {
  app.getDecorator('authServices')
  app.getDecorator('oidcServices')
  app.decorateRequest('identityClientId', undefined)
}

export default fp(plugin, {
  name: 'api-identity',
  fastify: '5.x',
  dependencies: ['business-auth', 'business-identity', 'api-auth'],
  decorators: { fastify: ['authServices', 'oidcServices'], request: ['authSession'] },
})
