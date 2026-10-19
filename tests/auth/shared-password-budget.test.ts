import { afterEach, expect, it, vi } from 'vitest'
import type { ScryptOptions } from 'node:crypto'
import { createApp } from '@workspace/server'
import { ScryptPasswordHasher } from '@server/src/modules/auth/crypto'
import { createAuthServices } from '@server/src/create-services'
import { approvedInvitation, createTestAuth, type TestAuth } from '@tests/helpers/auth'

const work = vi.hoisted(() => ({
  callbacks: [] as Array<() => void>,
  active: 0,
  peak: 0,
  started: 0,
}))
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  // Replace only the expensive primitive. The production hasher and its gate run unchanged.
  scrypt(
    _password: string,
    _salt: Buffer,
    length: number,
    _options: ScryptOptions,
    callback: (error: Error | null, key: Buffer) => void,
  ) {
    work.active += 1
    work.peak = Math.max(work.peak, work.active)
    work.started += 1
    work.callbacks.push(() => {
      work.active -= 1
      callback(null, Buffer.alloc(length))
    })
  },
}))

const fixtures: TestAuth[] = []
const apps: Array<ReturnType<typeof createApp>> = []
afterEach(async () => {
  // Also drain held primitives when an assertion fails, so regressions do not hang cleanup.
  while (work.callbacks.length > 0) {
    work.callbacks.splice(0).forEach((finish) => finish())
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
  vi.restoreAllMocks()
  Object.assign(work, { callbacks: [], active: 0, peak: 0, started: 0 })
})

it('shares the production two-active/sixteen-waiting budget between login and invitation completion', async () => {
  const fixture = await createTestAuth({ now: Date.now })
  fixtures.push(fixture)
  const approved = await approvedInvitation(fixture)
  const grant = await fixture.invitationServices.verifyCode(approved.email, approved.code)
  const encodedHash = `scrypt$v1$N=32768,r=8,p=1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`
  await fixture.db.query(
    'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
    [
      '10000000-0000-4000-8000-000000000001',
      'existing@example.com',
      'Existing',
      encodedHash,
      Date.now(),
    ],
  )
  const hash = vi.spyOn(ScryptPasswordHasher.prototype, 'hash')
  const verify = vi.spyOn(ScryptPasswordHasher.prototype, 'verify')
  // This is the same pure assembly function used by server.ts, not a test-only hasher assembly.
  const services = createAuthServices({ db: fixture.db, codeHmacKey: Buffer.alloc(32, 7) })
  const app = createApp({
    ...services,
    profileServices: fixture.profileServices,
    storageServices: fixture.storageServices,
    notifications: fixture.notifications,
    clickupServices: fixture.clickupServices,
    supportServices: fixture.supportServices,
  })
  apps.push(app)
  const login = () =>
    app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'existing@example.com', password: 'valid password' },
    })
  const complete = () =>
    app.inject({
      method: 'POST',
      url: '/api/auth/invitations/complete',
      payload: {
        completionToken: grant.completionToken,
        nickname: 'Final',
        password: 'valid password',
      },
    })
  const accepted = Array.from({ length: 18 }, (_, index) =>
    index % 2 === 0 ? login() : complete(),
  )
  // PostgreSQL preflight runs before the shared crypto gate. Wait until every accepted
  // request reaches that gate; the exact counts and final HTTP/database facts stay asserted.
  await vi.waitFor(
    () => {
      expect(hash).toHaveBeenCalledTimes(9)
      expect(verify).toHaveBeenCalledTimes(9)
    },
    { timeout: 15_000, interval: 20 },
  )
  expect(new Set([...hash.mock.contexts, ...verify.mock.contexts]).size).toBe(1)
  expect(work.started).toBe(2)
  expect(work.active).toBe(2)

  const excess = await Promise.all([login(), complete()])
  for (const response of excess) {
    expect(response.statusCode).toBe(503)
    expect(response.headers['retry-after']).toBe('1')
    expect(response.json().error.code).toBe('AUTH_BUSY')
  }
  expect(work.started).toBe(2)
  expect(
    (await fixture.db.query<{ n: number }>('SELECT count(*) AS n FROM auth_users')).rows[0],
  ).toEqual({ n: 1 })
  expect(
    (await fixture.db.query<{ n: number }>('SELECT count(*) AS n FROM auth_sessions')).rows[0],
  ).toEqual({ n: 0 })

  // Release each underlying operation; all sixteen waiters must continue through the real gate.
  for (let finished = 0; finished < 18; finished += 1) {
    await vi.waitFor(() => expect(work.callbacks.length).toBeGreaterThan(0))
    work.callbacks.shift()!()
  }
  const responses = await Promise.all(accepted)
  expect(responses.map((response) => response.statusCode)).toEqual(Array(18).fill(200))
  expect(work.started).toBe(18)
  expect(work.peak).toBe(2)
  expect(work.active).toBe(0)
  expect(
    (await fixture.db.query<{ n: number }>('SELECT count(*) AS n FROM auth_sessions')).rows[0],
  ).toEqual({ n: 9 })
  expect(
    (
      await fixture.db.query('SELECT email,nickname,qq FROM auth_users WHERE email = $1', [
        approved.email,
      ])
    ).rows,
  ).toEqual([{ email: approved.email, nickname: 'Final', qq: '001234' }])
  const retry = await complete()
  expect(retry.statusCode).toBe(200)
  expect(work.started).toBe(18)
})

it('reserves a released slot for its waiter while a new request arrives before that waiter resumes', async () => {
  const hasher = new ScryptPasswordHasher()
  const accepted = [
    hasher.hash('first password'),
    hasher.hash('second password'),
    hasher.hash('waiting password'),
  ]
  expect(work.started).toBe(2)
  work.callbacks.shift()!()

  // Match the reviewed microtask interleaving: the original waiter has been notified,
  // but has not resumed when another public hash request arrives.
  await new Promise<void>((resolve) => {
    let hops = 0
    const arrive = () => {
      if (++hops < 4) queueMicrotask(arrive)
      else {
        accepted.push(hasher.hash('interleaved password'))
        resolve()
      }
    }
    queueMicrotask(arrive)
  })
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(work.peak).toBe(2)
  expect(work.active).toBe(2)
  expect(work.started).toBe(3)

  // The interleaved request occupies one waiting place; exactly fifteen more fit.
  for (let index = 0; index < 15; index += 1) accepted.push(hasher.hash(`queued password ${index}`))
  await expect(hasher.hash('excess password')).rejects.toMatchObject({
    code: 'AUTH_BUSY',
    retryAfterSeconds: 1,
  })
  expect(work.started).toBe(3)
  for (let finished = 1; finished < 19; finished += 1) {
    await vi.waitFor(() => expect(work.callbacks.length).toBeGreaterThan(0))
    work.callbacks.shift()!()
  }
  expect(await Promise.all(accepted)).toHaveLength(19)
  expect(work.started).toBe(19)
  expect(work.peak).toBe(2)
  expect(work.active).toBe(0)

  const recovered = hasher.hash('after queue drained')
  expect(work.active).toBe(1)
  work.callbacks.shift()!()
  await expect(recovered).resolves.toMatch(/^scrypt\$v1\$/)
  expect(work.active).toBe(0)
})
