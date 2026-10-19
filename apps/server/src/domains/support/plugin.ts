import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import type { SupportServices } from './service.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'
const plugin: FastifyPluginAsync<{ supportServices: SupportServices }> = async (app, options) => {
  app.getDecorator('clickupServices')
  app.getDecorator('profileServices')
  requireBusinessServices('business-support', { supportServices: options.supportServices })
  app.decorate('supportServices', options.supportServices)
}
export default fp(plugin, {
  name: 'business-support',
  fastify: '5.x',
  dependencies: ['business-clickup', 'business-profile'],
  decorators: { fastify: ['clickupServices', 'profileServices'] },
})
