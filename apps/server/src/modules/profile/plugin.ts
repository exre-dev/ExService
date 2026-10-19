import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { ProfileService } from './service.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'

export interface ProfilePluginOptions {
  profileServices: ProfileService
}

const plugin: FastifyPluginAsync<ProfilePluginOptions> = async (app, options) => {
  requireBusinessServices('business-profile', { profileServices: options.profileServices })
  app.decorate('profileServices', options.profileServices)
}

export default fp(plugin, {
  name: 'business-profile',
  fastify: '5.x',
})
