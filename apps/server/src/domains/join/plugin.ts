import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { JoinService } from './applications/service.js'
import type { InvitationService } from './invitations/service.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'

export interface JoinPluginOptions {
  joinServices: JoinService
  invitationServices: InvitationService
}
const plugin: FastifyPluginAsync<JoinPluginOptions> = async (app, options) => {
  requireBusinessServices('business-join', {
    joinServices: options.joinServices,
    invitationServices: options.invitationServices,
  })
  app.decorate('joinServices', options.joinServices)
  app.decorate('invitationServices', options.invitationServices)
}
export default fp(plugin, { name: 'business-join', fastify: '5.x' })
