import type { FastifyRequest } from 'fastify'
import { AuthError } from '@server/src/modules/auth/errors.js'
import type { AuthService, SessionIdentity } from '@server/src/modules/auth/service.js'

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]{43})$/

export function readBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string') return undefined
  return BEARER_PATTERN.exec(authorization)?.[1]
}

/**
 * Bearer 认证的单一实现。
 *
 * 既被 Glue 的 securityHandler 使用，也被 storage transport 在消费请求体之前复用；
 * 这里只移动既有 token 格式与 authenticateToken 行为，不另建认证协议。
 */
export async function authenticateBearer(
  request: FastifyRequest,
  authServices: AuthService,
): Promise<SessionIdentity> {
  const token = readBearerToken(request)
  if (token === undefined) throw new AuthError('SESSION_INVALID')
  const identity = await authServices.authenticateToken(token)
  request.authSession = identity
  return identity
}
