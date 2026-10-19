import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { ClickUpServices } from './service.js'
import { BusinessPluginLoadError } from '../../business-plugin-errors.js'

export interface ClickUpPluginOptions {
  clickupServices: ClickUpServices
}
const plugin: FastifyPluginAsync<ClickUpPluginOptions> = async (app, options) => {
  if (!options.clickupServices)
    throw new BusinessPluginLoadError('BUSINESS_PLUGIN_BOOT_FAILED', {
      pluginName: 'business-clickup',
    })
  app.decorate('clickupServices', options.clickupServices)
}
export default fp(plugin, { name: 'business-clickup', fastify: '5.x' })
