import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { AuthService } from './service.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'

export interface AuthPluginOptions {
  authServices: AuthService
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  requireBusinessServices('business-auth', { authServices: options.authServices })
  app.decorate('authServices', options.authServices)
}

export default fp(plugin, {
  name: 'business-auth',
  fastify: '5.x',
})
