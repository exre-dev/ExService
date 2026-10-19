import { afterEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { IdentityOutboxWorker } from '@server/src/modules/identity/outbox'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('disables every old session and delivers only captured session targets after re-enable', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const userId = await fixture.seedUser({
    email: 'disabled-everywhere@example.test',
    nickname: 'Everywhere',
    password: 'valid password',
  })
  const logins = await Promise.all(
    Array.from({ length: 3 }, () =>
      fixture.authServices.login({
        email: 'disabled-everywhere@example.test',
        password: 'valid password',
      }),
    ),
  )
  const sessions = await Promise.all(
    logins.map((login) => fixture.authServices.authenticateToken(login.token)),
  )
  for (const [index, session] of sessions.slice(0, 2).entries()) {
    await fixture.db.query(
      `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
      VALUES ('another-app', $1, $2, $3, $4)`,
      [`old-sid-${index}`, session.id, userId, fixture.now()],
    )
  }
  await fixture.authServices.disableUser(userId)
  for (const login of logins) {
    await expect(fixture.authServices.authenticateToken(login.token)).rejects.toMatchObject({
      code: 'SESSION_INVALID',
    })
  }
  const revoked = await fixture.db.query<{ id: string; revoked_at: number | null }>(
    'SELECT id, revoked_at FROM auth_sessions WHERE user_id = $1',
    [userId],
  )
  expect(revoked.rows).toHaveLength(3)
  expect(revoked.rows.every((row) => row.revoked_at === fixture.now())).toBe(true)
  const outbox = await fixture.db.query<{
    event_id: string
    kind: string
    session_id: string | null
    target_bindings: string
  }>(
    'SELECT event_id, kind, session_id, target_bindings FROM auth_identity_outbox WHERE user_id = $1',
    [userId],
  )
  expect(outbox.rows).toHaveLength(1)
  expect(outbox.rows[0]).toMatchObject({ kind: 'user', session_id: null })
  const targets = JSON.parse(outbox.rows[0]!.target_bindings) as Array<{
    sessionId: string
    deliveryEventId: string
  }>
  expect(targets.map((target) => target.sessionId).sort()).toEqual(
    sessions
      .slice(0, 2)
      .map((session) => session.id)
      .sort(),
  )
  expect(new Set(targets.map((target) => target.deliveryEventId)).size).toBe(2)

  await fixture.authServices.enableUser(userId)
  const fresh = await fixture.authServices.login({
    email: 'disabled-everywhere@example.test',
    password: 'valid password',
  })
  const freshSession = await fixture.authServices.authenticateToken(fresh.token)
  await fixture.db.query(
    `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
    VALUES ('another-app', 'new-sid-after-enable', $1, $2, $3)`,
    [freshSession.id, userId, fixture.now()],
  )
  const hydra = vi.fn().mockResolvedValue(undefined)
  const application = vi.fn().mockResolvedValue(undefined)
  const worker = new IdentityOutboxWorker(fixture.db, hydra, application, fixture.now)
  expect(await worker.drainOne()).toBe(true)
  expect(hydra).toHaveBeenCalledTimes(2)
  expect(application).toHaveBeenCalledTimes(2)
  expect(application.mock.calls.map(([, message]) => message.sessionId).sort()).toEqual(
    sessions
      .slice(0, 2)
      .map((session) => session.id)
      .sort(),
  )
  expect(
    application.mock.calls.some(
      ([, message]) => message.userId || message.sessionId === freshSession.id,
    ),
  ).toBe(false)
  await expect(fixture.authServices.authenticateToken(fresh.token)).resolves.toMatchObject({
    id: freshSession.id,
  })
  fixture.advance(24 * 60 * 60 * 1000 + 1)
  await fixture.authServices.createSsoRequest()
  const currentBinding = (
    await fixture.db.query<{ revoked_at: number | null }>(
      `SELECT revoked_at FROM auth_oidc_bindings WHERE client_id = 'another-app' AND hydra_sid = 'new-sid-after-enable'`,
    )
  ).rows[0]
  expect(currentBinding?.revoked_at).toBeNull()
  for (const login of logins) {
    await expect(fixture.authServices.authenticateToken(login.token)).rejects.toMatchObject({
      code: 'SESSION_INVALID',
    })
  }
})

it('keeps a multi-binding user snapshot pending through failed delivery and cleanup', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const userId = await fixture.seedUser({
    email: 'retry-disable@example.test',
    nickname: 'Retry',
    password: 'valid password',
  })
  const login = await fixture.authServices.login({
    email: 'retry-disable@example.test',
    password: 'valid password',
  })
  const session = await fixture.authServices.authenticateToken(login.token)
  for (const sid of ['same-browser-a', 'same-browser-b']) {
    await fixture.db.query(
      `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
      VALUES ('another-app', $1, $2, $3, $4)`,
      [sid, session.id, userId, fixture.now()],
    )
  }
  await fixture.authServices.disableUser(userId)
  const hydra = vi
    .fn()
    .mockRejectedValueOnce(new Error('temporarily offline'))
    .mockResolvedValue(undefined)
  const application = vi.fn().mockResolvedValue(undefined)
  const worker = new IdentityOutboxWorker(fixture.db, hydra, application, fixture.now)
  expect(await worker.drainOne()).toBe(true)
  expect(application).not.toHaveBeenCalled()
  fixture.advance(25 * 60 * 60 * 1000)
  await fixture.authServices.createSsoRequest()
  expect(
    (await fixture.db.query('SELECT 1 FROM auth_oidc_bindings WHERE session_id = $1', [session.id]))
      .rows,
  ).toHaveLength(2)
  expect(
    (await fixture.db.query('SELECT 1 FROM auth_identity_outbox WHERE user_id = $1', [userId]))
      .rows,
  ).toHaveLength(1)
  expect(await worker.drainOne()).toBe(true)
  expect(application).toHaveBeenCalledTimes(2)
  expect(new Set(application.mock.calls.map(([, message]) => message.eventId)).size).toBe(2)
  expect(
    application.mock.calls.every(
      ([, message]) => message.sessionId === session.id && !message.userId,
    ),
  ).toBe(true)
  fixture.advance(24 * 60 * 60 * 1000 + 1)
  await fixture.authServices.createSsoRequest()
  expect(
    (await fixture.db.query('SELECT 1 FROM auth_identity_outbox WHERE user_id = $1', [userId]))
      .rows,
  ).toHaveLength(0)
  expect(
    (await fixture.db.query('SELECT 1 FROM auth_oidc_bindings WHERE session_id = $1', [session.id]))
      .rows,
  ).toHaveLength(0)
})

it('never broadcasts a legacy user event that lacks a captured session', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const userId = await fixture.seedUser({
    email: 'legacy-disable@example.test',
    nickname: 'Legacy',
    password: 'valid password',
  })
  await fixture.db.query(
    `INSERT INTO auth_identity_outbox
    (event_id, kind, session_id, user_id, target_bindings, created_at, next_attempt_at, delivered_targets)
    VALUES ($1, 'user', NULL, $2, $3, $4, $4, '[]')`,
    [
      randomUUID(),
      userId,
      JSON.stringify([{ clientId: 'another-app', hydraSid: 'legacy-sid' }]),
      fixture.now(),
    ],
  )
  const hydra = vi.fn()
  const application = vi.fn()
  const reportError = vi.fn()
  const worker = new IdentityOutboxWorker(fixture.db, hydra, application, fixture.now, reportError)
  expect(await worker.drainOne()).toBe(true)
  expect(reportError).toHaveBeenCalledWith('INVALID_USER_TARGET_SNAPSHOT')
  expect(hydra).not.toHaveBeenCalled()
  expect(application).not.toHaveBeenCalled()
  const row = (
    await fixture.db.query<{ completed_at: number | null; attempts: number }>(
      'SELECT completed_at, attempts FROM auth_identity_outbox WHERE user_id = $1',
      [userId],
    )
  ).rows[0]
  expect(row).toMatchObject({ completed_at: null, attempts: 1 })
})

it('serializes login, consent binding, logout and expiry cleanup against disable', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const email = 'concurrent-disable@example.test'
  const userId = await fixture.seedUser({
    email,
    nickname: 'Concurrent',
    password: 'valid password',
  })
  const firstLogin = await fixture.authServices.login({ email, password: 'valid password' })
  const first = await fixture.authServices.authenticateToken(firstLogin.token)
  let releaseBinding!: () => void
  let signalBinding!: () => void
  const bindingMayCommit = new Promise<void>((resolve) => {
    releaseBinding = resolve
  })
  const bindingHasLock = new Promise<void>((resolve) => {
    signalBinding = resolve
  })
  const binding = fixture.db.transaction(async (tx) => {
    await fixture.authServices.assertSessionCurrent(first, tx, true)
    signalBinding()
    await bindingMayCommit
    await tx.query(
      `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
      VALUES ('another-app', 'concurrent-sid', $1, $2, $3)`,
      [first.id, userId, fixture.now()],
    )
  })
  await bindingHasLock
  const disable = fixture.authServices.disableUser(userId)
  releaseBinding()
  await Promise.all([binding, disable])
  const captured = (
    await fixture.db.query<{ target_bindings: string }>(
      `SELECT target_bindings FROM auth_identity_outbox WHERE kind = 'user' AND user_id = $1`,
      [userId],
    )
  ).rows[0]
  expect(JSON.parse(captured!.target_bindings)).toEqual([
    expect.objectContaining({
      hydraSid: 'concurrent-sid',
      sessionId: first.id,
    }),
  ])
  await fixture.authServices.enableUser(userId)
  const next = await fixture.authServices.login({ email, password: 'valid password' })
  const nextSession = await fixture.authServices.authenticateToken(next.token)
  const concurrent = await Promise.allSettled([
    fixture.authServices.logout(nextSession),
    fixture.authServices.disableUser(userId),
  ])
  expect(concurrent[1]?.status).toBe('fulfilled')
  if (concurrent[0]?.status === 'rejected') {
    expect(concurrent[0].reason).toMatchObject({ code: 'SESSION_INVALID' })
  }
  await fixture.authServices.enableUser(userId)
  await expect(fixture.authServices.authenticateToken(next.token)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })

  const race = await Promise.allSettled([
    fixture.authServices.login({ email, password: 'valid password' }),
    fixture.authServices.disableUser(userId),
  ])
  expect(race[1]?.status).toBe('fulfilled')
  if (race[0]?.status === 'fulfilled') {
    await expect(fixture.authServices.authenticateToken(race[0].value.token)).rejects.toMatchObject(
      { code: 'SESSION_INVALID' },
    )
  }
  await fixture.authServices.enableUser(userId)
  const expiring = await fixture.authServices.login({ email, password: 'valid password' })
  fixture.advance(7 * 24 * 60 * 60 * 1000 + 1)
  const expiryRace = await Promise.allSettled([
    fixture.authServices.createSsoRequest(),
    fixture.authServices.disableUser(userId),
  ])
  expect(expiryRace.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled'])
  await expect(fixture.authServices.authenticateToken(expiring.token)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
})

it('cannot complete a CLI SSO request or reuse a bearer after disable and enable', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const email = 'disabled-sso@example.test'
  const userId = await fixture.seedUser({ email, nickname: 'SSO', password: 'valid password' })
  const login = await fixture.authServices.login({ email, password: 'valid password' })
  const oldSession = await fixture.authServices.authenticateToken(login.token)
  const sso = await fixture.authServices.createSsoRequest()
  const race = await Promise.allSettled([
    fixture.authServices.loginForSso({
      ssoRequestId: sso.ssoRequestId,
      email,
      password: 'valid password',
    }),
    fixture.authServices.disableUser(userId),
  ])
  expect(race[1]?.status).toBe('fulfilled')
  await expect(fixture.authServices.authenticateToken(login.token)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
  await fixture.authServices.enableUser(userId)
  const another = await fixture.authServices.createSsoRequest()
  await expect(
    fixture.authServices.confirmSsoWithSession(another.ssoRequestId, oldSession),
  ).rejects.toMatchObject({ code: 'SESSION_INVALID' })
  const fresh = await fixture.authServices.login({ email, password: 'valid password' })
  await expect(fixture.authServices.authenticateToken(fresh.token)).resolves.toMatchObject({
    userId,
  })
})
