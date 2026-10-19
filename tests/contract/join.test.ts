import { compileComponentSchema } from '@tests/helpers/contract'
import { afterEach, expect, it } from 'vitest'
import type { FastifyReply } from 'fastify'
import { createApp, serviceHandlers } from '@workspace/server'
import {
  approvedInvitation,
  createTestAuth,
  joinSnapshot,
  newJoinApplication,
  type TestAuth,
} from '@tests/helpers/auth'
const schemas = Object.fromEntries(
  [
    'InvitationEligibility',
    'InvitationCodeAccepted',
    'InvitationVerified',
    'InvitationRegistrationCompleted',
    'ErrorEnvelope',
  ].map((name) => [name, compileComponentSchema(name)]),
)
function validate(name: string, value: unknown) {
  const check = schemas[name]!
  expect(check(value), JSON.stringify(check.errors)).toBe(true)
}
const fixtures: TestAuth[] = [],
  apps: Array<ReturnType<typeof createApp>> = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
async function setup() {
  const f = await createTestAuth()
  fixtures.push(f)
  const app = createApp({ ...f })
  apps.push(app)
  return { f, app }
}
const specifications = {
  checkInvitationEligibility: {
    path: '/auth/invitations/check',
    schema: 'InvitationEligibility',
    status: 200,
  },
  requestInvitationCode: {
    path: '/auth/invitations/code',
    schema: 'InvitationCodeAccepted',
    status: 202,
  },
  verifyInvitationCode: {
    path: '/auth/invitations/verify',
    schema: 'InvitationVerified',
    status: 200,
  },
  completeInvitationRegistration: {
    path: '/auth/invitations/complete',
    schema: 'InvitationRegistrationCompleted',
    status: 200,
  },
} as const
it.each(['http', 'raw'])(
  'keeps invitation registration available through %s without creating sessions',
  async (mode) => {
    const { f, app } = await setup()
    await approvedInvitation(f)
    async function invoke(operation: keyof typeof specifications, body: unknown) {
      const spec = specifications[operation]
      if (mode === 'raw') {
        const headers: Record<string, string> = {}
        let status = 200
        const reply = {
          header(key: string, value: string) {
            headers[key.toLowerCase()] = value
            return this
          },
          code(value: number) {
            status = value
            return this
          },
        }
        const value = await serviceHandlers[operation](
          { server: f, body, ip: '127.0.0.1' } as never,
          reply as FastifyReply,
        )
        expect(status).toBe(spec.status)
        expect(headers['cache-control']).toBe('no-store')
        validate(spec.schema, value)
        return value
      }
      const response = await app.inject({
        method: 'POST',
        url: '/api' + spec.path,
        payload: body as Record<string, unknown>,
      })
      expect(response.statusCode).toBe(spec.status)
      expect(response.headers['cache-control']).toBe('no-store')
      validate(spec.schema, response.json())
      return response.json()
    }
    await invoke('checkInvitationEligibility', { email: 'member@example.com' })
    f.advance(60_000)
    await invoke('requestInvitationCode', { email: 'member@example.com' })
    const verified = await invoke('verifyInvitationCode', {
      email: 'member@example.com',
      code: f.deliveries.at(-1)!.code,
    })
    expect((await f.db.query<{ n: number }>('SELECT count(*) n FROM auth_users')).rows[0]).toEqual({
      n: 0,
    })
    await invoke('completeInvitationRegistration', {
      completionToken: verified.completionToken,
      nickname: 'Final',
      password: 'valid password',
    })
    expect(
      (await f.db.query('SELECT nickname, qq, avatar_key, fivem_id FROM auth_users')).rows[0],
    ).toEqual({ nickname: 'Final', qq: '001234', avatar_key: null, fivem_id: null })
    expect(
      (await f.db.query<{ n: number }>('SELECT count(*) n FROM auth_sessions')).rows[0],
    ).toEqual({ n: 0 })
  },
)
it('removes all old routes and rejects extra request fields and invalid query without coercion', async () => {
  const { app } = await setup()
  for (const path of ['', '/resend', '/cancel', '/verify'])
    expect(
      (await app.inject({ method: 'POST', url: `/api/auth/registrations${path}`, payload: {} }))
        .statusCode,
    ).toBe(404)
  const bodies = [
    ['/auth/invitations/check', { email: 'a@example.com', code: '123456' }],
    ['/auth/invitations/code', { email: 'a@example.com', secret: 'x' }],
    ['/auth/invitations/verify', { email: 'a@example.com', code: '123456', qq: '1' }],
    [
      '/auth/invitations/complete',
      {
        completionToken: 'a'.repeat(43),
        nickname: 'Name',
        password: 'valid password',
        email: 'a@example.com',
      },
    ],
  ] as const
  for (const [path, payload] of bodies) {
    const res = await app.inject({ method: 'POST', url: `/api${path}`, payload })
    expect(res.statusCode).toBe(400)
    expect(res.headers['cache-control']).toBe('no-store')
    validate('ErrorEnvelope', res.json())
  }
})
it('exposes fixed check errors, treats checks as read-only, shares IP budget, and ignores forwarded IP', async () => {
  const { f, app } = await setup()
  const missing = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/check',
    payload: { email: 'missing@example.com' },
  })
  expect(missing.statusCode).toBe(404)
  expect(missing.json().error.message).toBe('未找到该邮箱的申请，请先申请加入')
  await f.joinServices.submit(newJoinApplication('pending@example.com', 'Private', '00001'))
  const pending = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/check',
    payload: { email: 'pending@example.com' },
  })
  expect(pending.statusCode).toBe(409)
  expect(pending.body).not.toContain('Private')
  await approvedInvitation(f)
  const before = await joinSnapshot(f),
    calls = f.deliveries.length
  for (let n = 0; n < 58; n++) {
    const check = await app.inject({
      method: 'POST',
      url: '/api/auth/invitations/check',
      headers: { 'x-forwarded-for': `10.1.1.${n}` },
      payload: { email: 'member@example.com' },
    })
    expect(check.statusCode).toBe(200)
    expect(Object.keys(check.json())).toEqual([
      'status',
      'email',
      'serverTime',
      'resendAvailableAt',
    ])
  }
  expect(await joinSnapshot(f)).toEqual(before)
  expect(f.deliveries.length).toBe(calls)
  const limited = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/check',
    payload: { email: 'member@example.com' },
  })
  expect(limited.statusCode).toBe(429)
  expect(limited.headers['retry-after']).toBe('60')
  expect(limited.json().error.code).toBe('JOIN_RATE_LIMITED')
})
it('produces retryable and safe invitation errors through actual glue handlers', async () => {
  const { f, app } = await setup(),
    a = await approvedInvitation(f)
  const deliveries = f.deliveries.length
  const cooldown = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/code',
    payload: { email: a.email },
  })
  expect(cooldown.statusCode).toBe(202)
  expect(f.deliveries.length).toBe(deliveries)
  validate('InvitationCodeAccepted', cooldown.json())
  for (let i = 0; i < 5; i++) {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/invitations/verify',
      payload: { email: a.email, code: '000000' },
    })
    expect(bad.statusCode).toBe(i === 4 ? 429 : 400)
    validate('ErrorEnvelope', bad.json())
    if (i === 4) expect(bad.headers['retry-after']).toBe('600')
  }
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/complete',
    payload: { completionToken: 'a'.repeat(43), nickname: 'Name', password: 'valid password' },
  })
  expect(invalid.statusCode).toBe(401)
  expect(invalid.json().error.code).toBe('COMPLETION_GRANT_INVALID')
  await f.db.query('DROP TABLE join_delivery_attempts')
  await f.db.query('DROP TABLE join_invitations')
  const failure = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/check',
    payload: { email: a.email },
  })
  expect(failure.statusCode).toBe(500)
  expect(failure.json().error.message).toBe('An unexpected error occurred.')
  expect(failure.body).not.toContain('join_invitations')
  expect(failure.headers['cache-control']).toBe('no-store')
})
it('maps password resource saturation to 503 without creating account/session rows', async () => {
  const { AuthError } = await import('@server/src/modules/auth/errors')
  const f = await createTestAuth({
    passwordHasher: {
      hash: async () => {
        throw new AuthError('AUTH_BUSY', { retryAfterSeconds: 1 })
      },
      verify: async () => false,
    },
  })
  fixtures.push(f)
  const app = createApp({ ...f })
  apps.push(app)
  const a = await approvedInvitation(f),
    grant = await f.invitationServices.verifyCode(a.email, a.code)
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/complete',
    payload: {
      completionToken: grant.completionToken,
      nickname: 'Name',
      password: 'valid password',
    },
  })
  expect(response.statusCode).toBe(503)
  expect(response.headers['retry-after']).toBe('1')
  expect(response.json().error.code).toBe('AUTH_BUSY')
  expect((await f.db.query<{ n: number }>('SELECT count(*) n FROM auth_users')).rows[0]).toEqual({
    n: 0,
  })
  expect((await f.db.query<{ n: number }>('SELECT count(*) n FROM auth_sessions')).rows[0]).toEqual(
    { n: 0 },
  )
})
