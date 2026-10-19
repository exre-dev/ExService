import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import { OPENAPI_PATH } from '../contract/document.js'
import { registerErrorHandlers } from '../errors.js'
import { registerHttpFoundation } from './cors.js'

export interface HttpFoundationPluginOptions {
  origins: ReadonlySet<string>
  contractPath?: string
}
const plugin: FastifyPluginAsync<HttpFoundationPluginOptions> = async (app, options) => {
  registerHttpFoundation(app, {
    origins: options.origins,
    contractPath: options.contractPath ?? OPENAPI_PATH,
  })
  registerErrorHandlers(app)
  await app.register(multipart)
}
export default fp(plugin, { name: 'http-foundation', fastify: '5.x' })
