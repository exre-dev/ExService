import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { registerStorageTransport } from './transport.js'

const plugin: FastifyPluginAsync = async (app) => {
  app.getDecorator('storageServices')
  app.getDecorator('authServices')
  registerStorageTransport(app, { maxBytes: app.storageServices.config.maxBytes })
}

export default fp(plugin, {
  name: 'api-storage',
  fastify: '5.x',
  dependencies: ['business-storage', 'business-auth', 'api-auth'],
  decorators: { fastify: ['storageServices', 'authServices'], request: ['authSession'] },
})
