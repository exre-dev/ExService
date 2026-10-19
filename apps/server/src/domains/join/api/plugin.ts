import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync = async (app) => {
  app.getDecorator('invitationServices')
}

export default fp(plugin, {
  name: 'api-join',
  fastify: '5.x',
  dependencies: ['business-join', 'api-auth'],
  decorators: { fastify: ['invitationServices'], request: ['authSession'] },
})
