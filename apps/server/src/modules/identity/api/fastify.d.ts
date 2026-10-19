import type {} from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    identityClientId: string | undefined
  }
}
