import { Writable } from 'node:stream'
import { afterEach, expect, it } from 'vitest'
import { createApp } from '@workspace/server'
import { approvedInvitation, createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
const apps: Array<ReturnType<typeof createApp>> = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('keeps secrets and original exception stacks out of real HTTP request and error logs', async () => {
  const password = 'PASSWORD_SECRET_LOG_93821'
  const code = '654987'
  const hmac = '1a'.repeat(32)
  const stackMarker = 'PRIVATE_PROVIDER_STACK_FRAME_93821'
  let completionToken = ''
  const fixture = await createTestAuth({
    codeHmacKey: Buffer.from(hmac, 'hex'),
    randomInteger: () => Number(code),
    passwordHasher: {
      async verify() {
        return true
      },
      async hash() {
        const error = new Error(`${password} ${code} ${completionToken} ${hmac}`)
        error.stack = `${stackMarker}\n${error.message}`
        throw error
      },
    },
  })
  fixtures.push(fixture)
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(chunk.toString())
      done()
    },
  })
  const app = createApp({ ...fixture, logger: { level: 'info', stream } })
  apps.push(app)
  const approved = await approvedInvitation(fixture)

  const check = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/check',
    payload: { email: approved.email },
  })
  expect(check.statusCode).toBe(200)
  const verified = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/verify',
    payload: { email: approved.email, code },
  })
  expect(verified.statusCode).toBe(200)
  completionToken = verified.json().completionToken
  expect(completionToken).toHaveLength(43)

  // Exercise request logging with a real password-bearing successful login.
  await fixture.db.query(
    'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
    [
      '10000000-0000-4000-8000-000000000001',
      'existing@example.com',
      'Existing',
      'fixture-hash',
      fixture.now(),
    ],
  )
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'existing@example.com', password },
  })
  expect(login.statusCode).toBe(200)
  const bad = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/verify',
    payload: { email: approved.email, code },
  })
  expect(bad.statusCode).toBe(400)
  const failure = await app.inject({
    method: 'POST',
    url: '/api/auth/invitations/complete',
    payload: { completionToken, nickname: 'Final', password },
  })
  expect(failure.statusCode).toBe(500)

  const logs = chunks.join('')
  for (const secret of [password, code, completionToken, hmac, stackMarker])
    expect(logs).not.toContain(secret)
  const records = chunks.flatMap((chunk) =>
    chunk
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  )
  expect(records.filter((record) => record.msg === 'incoming request')).toHaveLength(5)
  const rejected = records.find((record) => record.msg === 'request rejected')
  const failed = records.find((record) => record.msg === 'request failed')
  expect(rejected).toMatchObject({
    code: 'INVITATION_CODE_INVALID',
    statusCode: 400,
    reqId: expect.any(String),
  })
  expect(failed).toMatchObject({
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    reqId: expect.any(String),
  })
  expect(failed.reqId).toBe(failure.json().error.requestId)
  expect(rejected.reqId).toBe(bad.json().error.requestId)
  expect(records.some((record) => 'err' in record || 'stack' in record)).toBe(false)
})
