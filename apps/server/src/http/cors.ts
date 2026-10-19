import { readContract, listOperations } from '../contract/document.js'
import type { FastifyInstance } from 'fastify'
import { createErrorEnvelope } from '@server/src/errors.js'

export class CorsConfigError extends Error {
  constructor(reason: string) {
    super(`SERVER_CORS_ALLOWED_ORIGINS ${reason}`)
    this.name = 'CorsConfigError'
  }
}

export function parseCorsAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  if (value === undefined || value.trim() === '') return new Set()
  const origins = new Set<string>()
  for (const entry of value.split(',')) {
    const raw = entry.trim()
    if (!raw || raw === '*' || raw === 'null')
      throw new CorsConfigError('contains an invalid origin')
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new CorsConfigError('contains an invalid origin')
    }
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !/^https?:\/\/[^/]+\/?$/i.test(raw)
    ) {
      throw new CorsConfigError('requires HTTP(S) origins without paths or credentials')
    }
    origins.add(url.origin)
  }
  return origins
}

function contractMethods(path: string): Set<string> {
  return new Set(
    listOperations(readContract(path)).map((operation) => operation.method.toUpperCase()),
  )
}

function mergeVary(current: unknown, ...values: string[]): string {
  const members = String(current ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  for (const value of values)
    if (!members.some((member) => member.toLowerCase() === value.toLowerCase())) members.push(value)
  return members.join(', ')
}

export function registerHttpFoundation(
  app: FastifyInstance,
  options: { origins: ReadonlySet<string>; contractPath: string },
): void {
  const methods = contractMethods(options.contractPath)
  app.addHook('onRequest', (request, reply, done) => {
    reply.header('X-Request-Id', request.id)
    const isApi = request.url === '/api' || request.url.startsWith('/api/')
    const origin = request.headers.origin
    const allowed = isApi && typeof origin === 'string' && options.origins.has(origin)
    if (allowed) {
      reply.header('Access-Control-Allow-Origin', origin)
      reply.header(
        'Access-Control-Expose-Headers',
        'X-Request-Id, Retry-After, Content-Disposition',
      )
      reply.header('Vary', mergeVary(reply.getHeader('Vary'), 'Origin'))
    }
    const preflightMethod = request.headers['access-control-request-method']
    if (
      request.method !== 'OPTIONS' ||
      !isApi ||
      origin === undefined ||
      preflightMethod === undefined
    )
      return done()
    const requested = request.headers['access-control-request-headers']
    const headers: string[] =
      typeof requested === 'string'
        ? requested.split(',').map((value) => value.trim().toLowerCase())
        : []
    const validHeaders = headers.every(
      (header) => header === 'authorization' || header === 'content-type',
    )
    if (
      !allowed ||
      !methods.has(String(preflightMethod).toUpperCase()) ||
      headers.includes('') ||
      !validHeaders
    ) {
      void reply
        .code(400)
        .header('Cache-Control', 'no-store')
        .send(createErrorEnvelope('BAD_REQUEST', 'The request could not be processed.', request.id))
      return
    }
    reply.header('Access-Control-Allow-Methods', [...methods].sort().join(', '))
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    reply.header(
      'Vary',
      mergeVary(
        reply.getHeader('Vary'),
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
      ),
    )
    void reply.code(204).send()
  })
  app.addHook('onSend', (_request, reply, payload, done) => {
    const origin = reply.getHeader('Access-Control-Allow-Origin')
    if (origin) reply.header('Vary', mergeVary(reply.getHeader('Vary'), 'Origin'))
    done(null, payload)
  })
}
