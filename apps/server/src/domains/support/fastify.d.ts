import type { SupportServices } from './service.js'
declare module 'fastify' {
  interface FastifyInstance {
    supportServices: SupportServices
  }
}
