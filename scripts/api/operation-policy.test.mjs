import assert from 'node:assert/strict'
import { test } from 'node:test'
import { operationPolicy } from './operation-policy.mjs'
import { validateContract } from './read-contract.mjs'

function fixture(topSecurity, overrides = {}) {
  return validateContract({
    openapi: '3.0.3',
    info: { title: 'test', version: '1' },
    ...(topSecurity === undefined ? {} : { security: topSecurity }),
    paths: {
      '/api/public': {
        get: { operationId: 'public', responses: { 200: { description: 'ok' } }, ...overrides },
      },
      '/api/private/{id}': {
        post: { operationId: 'private', responses: { 200: { description: 'ok' } } },
      },
    },
    components: {
      schemas: {},
      securitySchemes: {
        sessionAuth: { type: 'http', scheme: 'bearer' },
        apiKey: { type: 'apiKey', name: 'X-Key', in: 'header' },
      },
    },
  })
}

test('derives method and full path with inherited, explicit and optional anonymous security', () => {
  const inherited = operationPolicy(fixture([{ sessionAuth: [] }]))
  assert.deepEqual(inherited['POST /api/private/{id}'], { requiresSession: true })
  assert.deepEqual(inherited['GET /api/public'], { requiresSession: true })
  assert.deepEqual(
    operationPolicy(fixture([{ sessionAuth: [] }], { security: [] }))['GET /api/public'],
    { requiresSession: false },
  )
  assert.deepEqual(operationPolicy(fixture([{ sessionAuth: [] }, {}]))['POST /api/private/{id}'], {
    requiresSession: false,
  })
  assert.deepEqual(operationPolicy(fixture(undefined))['POST /api/private/{id}'], {
    requiresSession: false,
  })
})

test('rejects undeclared and malformed security instead of guessing authentication', () => {
  for (const security of [[{ missing: [] }], [{ sessionAuth: 'bad' }], [null], 'bad'])
    assert.throws(() => operationPolicy(fixture(security)), /security/i)
  assert.throws(() => operationPolicy(fixture([{ sessionAuth: ['scope'] }])), /scopes/i)
})

test('validates every alternative even after an anonymous or other-scheme option', () => {
  const invalid = [{ missingScheme: [] }, null, { sessionAuth: 'bad' }]
  for (const first of [{}, { apiKey: [] }]) {
    for (const later of invalid) {
      assert.throws(() => operationPolicy(fixture([first, later])), /security/i)
      assert.throws(() => operationPolicy(fixture([later, first])), /security/i)
    }
  }
})
