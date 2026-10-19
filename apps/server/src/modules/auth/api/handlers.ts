import type { ApiRequest, ApiJsonResult } from '@server/src/http/handler-types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomBytes } from 'node:crypto'

function noStore(reply: FastifyReply): void {
  void reply.header('Cache-Control', 'no-store')
}

// Valid 1 x 1 PNG only for exercising the reserved JSON contract.
const PLACEHOLDER_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII='

export async function createCaptchaChallenge(
  _request: ApiRequest<'createCaptchaChallenge'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'createCaptchaChallenge'>> {
  noStore(reply)
  return {
    challengeId: randomBytes(32).toString('base64url'),
    imageBase64: PLACEHOLDER_PNG,
    expiresAt: Date.now() + 5 * 60 * 1000,
  }
}

export async function login(
  request: ApiRequest<'login'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'login'>> {
  noStore(reply)
  return request.server.authServices.login(request.body)
}

export async function getCurrentUser(
  request: ApiRequest<'getCurrentUser'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getCurrentUser'>> {
  noStore(reply)
  return request.server.profileServices.snapshot(requireSession(request).userId)
}

export async function logout(
  request: ApiRequest<'logout'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'logout'>> {
  noStore(reply)
  return request.server.authServices.logout(requireSession(request))
}

export async function inspectSsoRequest(
  request: ApiRequest<'inspectSsoRequest'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'inspectSsoRequest'>> {
  noStore(reply)
  const { ssoRequestId } = request.body
  return request.server.authServices.inspectSsoRequest(ssoRequestId)
}

export async function loginForSso(
  request: ApiRequest<'loginForSso'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'loginForSso'>> {
  noStore(reply)
  return request.server.authServices.loginForSso(request.body)
}

export async function confirmSsoWithSession(
  request: ApiRequest<'confirmSsoWithSession'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'confirmSsoWithSession'>> {
  noStore(reply)
  const { ssoRequestId } = request.body
  return request.server.authServices.confirmSsoWithSession(ssoRequestId, requireSession(request))
}

export function requireSession(request: FastifyRequest) {
  if (request.authSession === undefined) {
    throw new Error('security handler did not attach an authenticated session')
  }
  return request.authSession
}
