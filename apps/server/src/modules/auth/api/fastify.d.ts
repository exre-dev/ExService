import type { SessionIdentity } from '../service.js'

declare module 'fastify' {
  interface FastifyRequest {
    authSession: SessionIdentity | undefined
  }
}
