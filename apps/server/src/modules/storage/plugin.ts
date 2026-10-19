import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { StorageServices } from './factory.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'

export interface StoragePluginOptions {
  storageServices: StorageServices
}

const plugin: FastifyPluginAsync<StoragePluginOptions> = async (app, options) => {
  requireBusinessServices('business-storage', { storageServices: options.storageServices })
  app.decorate('storageServices', options.storageServices)
}

export default fp(plugin, {
  name: 'business-storage',
  fastify: '5.x',
})
