import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { DocsService } from './service.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'

export interface DocsPluginOptions {
  docsServices: DocsService
}

const plugin: FastifyPluginAsync<DocsPluginOptions> = async (app, options) => {
  requireBusinessServices('business-docs', { docsServices: options.docsServices })
  app.decorate('docsServices', options.docsServices)
}

export default fp(plugin, { name: 'business-docs', fastify: '5.x' })
