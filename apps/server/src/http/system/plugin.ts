import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync = async (app) => {}

export default fp(plugin, {
  name: 'api-system',
  fastify: '5.x',
  dependencies: [],
  decorators: { fastify: [], request: [] },
})
