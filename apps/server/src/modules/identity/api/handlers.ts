import type { ApiRequest, ApiJsonResult } from '@server/src/http/handler-types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthError } from '@server/src/modules/auth/errors.js'
import { requireSession } from '@server/src/modules/auth/api/handlers.js'

function noStore(reply: FastifyReply): void {
  void reply.header('Cache-Control', 'no-store')
}

function oidc(request: FastifyRequest) {
  const service = request.server.oidcServices
  if (!service) throw new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
  return service
}

export async function inspectOidcRequest(
  request: ApiRequest<'inspectOidcRequest'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'inspectOidcRequest'>> {
  noStore(reply)
  const { phase, challenge } = request.body
  return oidc(request).inspect(phase, challenge)
}

export async function acceptOidcLogin(
  request: ApiRequest<'acceptOidcLogin'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'acceptOidcLogin'>> {
  noStore(reply)
  const { challenge } = request.body
  return oidc(request).acceptLogin(challenge, requireSession(request))
}

export async function acceptOidcConsent(
  request: ApiRequest<'acceptOidcConsent'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'acceptOidcConsent'>> {
  noStore(reply)
  const { challenge } = request.body
  return oidc(request).acceptConsent(challenge, requireSession(request))
}

export async function acceptOidcLogout(
  request: ApiRequest<'acceptOidcLogout'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'acceptOidcLogout'>> {
  noStore(reply)
  const { challenge } = request.body
  return oidc(request).acceptLogout(challenge, requireSession(request))
}

export async function checkLinkedSession(
  request: ApiRequest<'checkLinkedSession'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'checkLinkedSession'>> {
  noStore(reply)
  if (!request.identityClientId) throw new AuthError('IDENTITY_UNAUTHORIZED')
  const { hydraSid, subject } = request.body
  return request.server.authServices.checkLinkedSession(request.identityClientId, hydraSid, subject)
}

export async function revokeLinkedSession(
  request: ApiRequest<'revokeLinkedSession'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'revokeLinkedSession'>> {
  noStore(reply)
  if (!request.identityClientId) throw new AuthError('IDENTITY_UNAUTHORIZED')
  const { hydraSid, subject, requestId } = request.body
  return request.server.authServices.revokeLinkedSession(
    request.identityClientId,
    hydraSid,
    subject,
    requestId,
  )
}

export async function inspectIdentityUser(
  request: ApiRequest<'inspectIdentityUser'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'inspectIdentityUser'>> {
  noStore(reply)
  const { userId } = request.body
  const result = await request.server.authServices.inspectIdentityUser(userId)
  if (!result) throw new AuthError('IDENTITY_NOT_FOUND')
  return result
}
