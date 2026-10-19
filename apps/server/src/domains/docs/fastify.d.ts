import type { DocsService } from './service.js'

declare module 'fastify' {
  interface FastifyInstance {
    docsServices: DocsService
  }
}
