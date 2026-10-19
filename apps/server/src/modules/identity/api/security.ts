import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'
import { AuthError } from '../../auth/errors.js'
import type { IdentityApiPluginOptions } from './plugin.js'

function safeKeyEqual(expected: string, actual: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(hash(expected), hash(actual))
}

export function createIdentitySecurityHandlers(
  identityKeys: IdentityApiPluginOptions['identityKeys'],
) {
  return {
    async integrationKey(request: FastifyRequest): Promise<void> {
      const supplied = request.headers['x-integration-key']
      if (typeof supplied !== 'string') throw new AuthError('IDENTITY_UNAUTHORIZED')
      const client = Object.entries(identityKeys?.clients ?? {}).find(([, key]) =>
        safeKeyEqual(key, supplied),
      )
      if (!client) throw new AuthError('IDENTITY_UNAUTHORIZED')
      request.identityClientId = client[0]
    },
    async bootstrapKey(request: FastifyRequest): Promise<void> {
      const supplied = request.headers['x-bootstrap-key']
      if (
        typeof supplied !== 'string' ||
        !identityKeys?.bootstrapKey ||
        !safeKeyEqual(identityKeys.bootstrapKey, supplied)
      )
        throw new AuthError('IDENTITY_UNAUTHORIZED')
    },
  }
}
