import { afterEach, expect, it } from 'vitest'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('checks only the bound client and revokes one browser session group', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const userId = await fixture.seedUser({
    email: 'bound@example.com',
    nickname: 'Bound',
    password: 'valid password',
  })
  const first = await fixture.authServices.login({
    email: 'bound@example.com',
    password: 'valid password',
  })
  const second = await fixture.authServices.login({
    email: 'bound@example.com',
    password: 'valid password',
  })
  const firstSession = await fixture.authServices.authenticateToken(first.token)
  await fixture.db.query(
    `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
    VALUES ('test-app', 'sid-a', $1, $2, $3)`,
    [firstSession.id, userId, fixture.now()],
  )
  const check = await fixture.authServices.checkLinkedSession('test-app', 'sid-a', userId)
  expect(check).toMatchObject({
    active: true,
    sessionId: firstSession.id,
    userId,
    profile: { nickname: 'Bound', email: 'bound@example.com', version: 0 },
  })
  expect(await fixture.authServices.checkLinkedSession('another-app', 'sid-a', userId)).toEqual({
    active: false,
    reason: 'unknown',
  })
  expect(await fixture.authServices.revokeLinkedSession('test-app', 'sid-a', userId)).toEqual({
    revoked: true,
  })
  expect(await fixture.authServices.checkLinkedSession('test-app', 'sid-a', userId)).toEqual({
    active: false,
    reason: 'revoked',
  })
  await expect(fixture.authServices.authenticateToken(first.token)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
  await expect(fixture.authServices.authenticateToken(second.token)).resolves.toMatchObject({
    userId,
  })
  const queued = await fixture.db.query<{ target_bindings: string }>(
    'SELECT target_bindings FROM auth_identity_outbox WHERE session_id = $1',
    [firstSession.id],
  )
  expect(queued.rows).toHaveLength(1)
  expect(JSON.parse(queued.rows[0]!.target_bindings)).toEqual([
    { clientId: 'test-app', hydraSid: 'sid-a' },
  ])
})

it('isolates equal sid bindings belonging to local and legacy browser sessions', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const email = 'same-sid@example.test'
  const userId = await fixture.seedUser({ email, nickname: 'Same sid', password: 'valid password' })
  const sessions = []
  const logins = []
  for (const clientId of ['test-app', 'another-app']) {
    const login = await fixture.authServices.login({ email, password: 'valid password' })
    const session = await fixture.authServices.authenticateToken(login.token)
    logins.push(login)
    sessions.push(session)
    await fixture.db.query(
      `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
      VALUES ($1, 'equal-sid', $2, $3, $4)`,
      [clientId, session.id, userId, fixture.now()],
    )
    expect(
      await fixture.authServices.checkLinkedSession(clientId, 'equal-sid', userId),
    ).toMatchObject({ active: true, sessionId: session.id })
  }
  expect(
    await fixture.authServices.checkLinkedSession('hydra-only-app', 'equal-sid', userId),
  ).toEqual({ active: false, reason: 'unknown' })
  expect(await fixture.authServices.revokeLinkedSession('test-app', 'equal-sid', userId)).toEqual({
    revoked: true,
  })
  expect(
    await fixture.authServices.checkLinkedSession('another-app', 'equal-sid', userId),
  ).toMatchObject({ active: true, sessionId: sessions[1]!.id })
  await expect(fixture.authServices.authenticateToken(logins[0]!.token)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
  await expect(fixture.authServices.authenticateToken(logins[1]!.token)).resolves.toMatchObject({
    id: sessions[1]!.id,
  })
})
