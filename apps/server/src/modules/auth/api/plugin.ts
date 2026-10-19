import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync = async (app) => {
  app.getDecorator('authServices')
  app.getDecorator('profileServices')
  app.decorateRequest('authSession', undefined)
}

export default fp(plugin, {
  name: 'api-auth',
  fastify: '5.x',
  dependencies: ['business-auth', 'business-profile'],
  decorators: { fastify: ['authServices', 'profileServices'], request: [] },
})
