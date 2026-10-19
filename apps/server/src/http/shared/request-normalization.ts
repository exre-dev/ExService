import type { FastifyInstance } from 'fastify'
import { coerceQueryStringTypes } from './query-coercion.js'

export function registerRequestNormalization(app: FastifyInstance): void {
  app.addHook('preValidation', (request, _reply, done) => {
    if (typeof request.body === 'object' && request.body !== null && !Array.isArray(request.body)) {
      const body = request.body as Record<string, unknown>
      if (typeof body.email === 'string') body.email = body.email.trim().toLowerCase()
      if (typeof body.nickname === 'string') body.nickname = body.nickname.trim()
    }
    done()
  })
  // Only query parameters use Contract scalar coercion; JSON bodies remain strict.
  app.addHook('preValidation', (request, _reply, done) => {
    coerceQueryStringTypes(
      request.query as Record<string, unknown>,
      request.routeOptions?.schema?.querystring,
    )
    done()
  })
}
