import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import type { NotificationModule } from './factory.js'
import { requireBusinessServices } from '../../business-plugin-errors.js'

export interface NotificationsPluginOptions {
  notifications: NotificationModule
}

const plugin: FastifyPluginAsync<NotificationsPluginOptions> = async (app, options) => {
  requireBusinessServices('business-notifications', { notifications: options.notifications })
  app.decorate('notifications', options.notifications)
}

export default fp(plugin, {
  name: 'business-notifications',
  fastify: '5.x',
})
