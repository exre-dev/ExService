import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync = async (app) => {
  app.getDecorator('notifications')
}

export default fp(plugin, {
  name: 'api-notifications',
  fastify: '5.x',
  dependencies: ['business-notifications', 'api-auth'],
  decorators: { fastify: ['notifications'], request: ['authSession'] },
})
