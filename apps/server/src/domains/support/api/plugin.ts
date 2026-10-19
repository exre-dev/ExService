import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { registerSupportTransport } from './transport.js'
const plugin: FastifyPluginAsync = async (app) => {
  app.getDecorator('supportServices')
  registerSupportTransport(app)
}
export default fp(plugin, {
  name: 'api-support',
  fastify: '5.x',
  dependencies: ['business-support', 'api-auth'],
  decorators: { fastify: ['supportServices'], request: ['authSession'] },
})
