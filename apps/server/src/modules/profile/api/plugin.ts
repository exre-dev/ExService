import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync = async (app) => {
  app.getDecorator('profileServices')
  app.getDecorator('authServices')
}

export default fp(plugin, {
  name: 'api-profile',
  fastify: '5.x',
  dependencies: ['business-profile', 'business-auth', 'api-auth'],
  decorators: { fastify: ['profileServices', 'authServices'], request: ['authSession'] },
})
