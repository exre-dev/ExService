import { afterEach, expect, it, vi } from 'vitest'
import {
  configuredIdentityOutboxWorker,
  IdentityOutboxWorker,
} from '@server/src/modules/identity/outbox'
import { parseIdentityConfig } from '@server/src/modules/identity/config'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const localEnv = {
  IDENTITY_ENABLED: 'true',
  IDENTITY_MODE: 'local',
  SERVER_PUBLIC_WEB_BASE_URL: 'http://127.0.0.1:8080',
  HYDRA_PUBLIC_URL: 'http://127.0.0.1:14444/',
  HYDRA_ADMIN_URL: 'http://127.0.0.1:14447/',
  IDENTITY_BOOTSTRAP_KEY: 'c'.repeat(64),
  IDENTITY_FLOW_KEY: 'd'.repeat(64),
  IDENTITY_CLIENTS_JSON: JSON.stringify([
    {
      clientId: 'test-app',
      name: 'Test App',
      redirectUri: 'http://127.0.0.1:9000/callback',
      postLogoutRedirectUri: 'http://127.0.0.1:9000/out',
      clientSecret: 'existing app secret',
      scopes: ['openid'],
      revocation: { url: 'http://127.0.0.1:3102/custom/revoke', key: 'b'.repeat(64) },
    },
  ]),
}

async function queuedBindings(clientIds: string[], sid = 'shared-sid') {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const email = 'targets@example.test'
  const userId = await fixture.seedUser({ email, nickname: 'Targets', password: 'valid password' })
  const login = await fixture.authServices.login({ email, password: 'valid password' })
  const session = await fixture.authServices.authenticateToken(login.token)
  for (const clientId of clientIds) {
    await fixture.db.query(
      `INSERT INTO auth_oidc_bindings
      (client_id, hydra_sid, session_id, user_id, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [clientId, sid, session.id, userId, fixture.now()],
    )
  }
  await fixture.authServices.logout(session)
  return { fixture, session }
}

async function outboxState(fixture: TestAuth) {
  return (
    await fixture.db.query<{
      completed_at: number | null
      delivered_targets: string
      attempts: number
    }>('SELECT completed_at, delivered_targets, attempts FROM auth_identity_outbox')
  ).rows[0]!
}

it('delivers a revoked session by sid and retries each durable target after a failure', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const userId = await fixture.seedUser({
    email: 'outbox@example.com',
    nickname: 'Outbox',
    password: 'valid password',
  })
  const login = await fixture.authServices.login({
    email: 'outbox@example.com',
    password: 'valid password',
  })
  const session = await fixture.authServices.authenticateToken(login.token)
  await fixture.db.query(
    `INSERT INTO auth_oidc_bindings
    (client_id, hydra_sid, session_id, user_id, created_at) VALUES ('another-app', 'sid-one', $1, $2, $3)`,
    [session.id, userId, fixture.now()],
  )
  await fixture.authServices.logout(session)
  const hydra = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  const application = vi.fn().mockResolvedValue(undefined)
  const worker = new IdentityOutboxWorker(fixture.db, hydra, application, fixture.now)
  expect(await worker.drainOne()).toBe(true)
  expect(hydra).toHaveBeenCalledWith({ clientId: 'another-app', hydraSid: 'sid-one' })
  expect(application).not.toHaveBeenCalled()
  fixture.advance(1000)
  expect(await worker.drainOne()).toBe(true)
  expect(hydra).toHaveBeenCalledTimes(2)
  expect(application).toHaveBeenCalledWith(
    'another-app',
    expect.objectContaining({ sessionId: session.id }),
  )
  expect(await worker.drainOne()).toBe(false)
  const row = (
    await fixture.db.query<{ completed_at: number | null }>(
      'SELECT completed_at FROM auth_identity_outbox WHERE session_id = $1',
      [session.id],
    )
  ).rows[0]
  expect(row?.completed_at).toBe(fixture.now())
})

it('selects original destinations for active, cleanup-only and Hydra-only bindings with the same sid', async () => {
  const { fixture, session } = await queuedBindings(['test-app', 'another-app', 'hydra-only-app'])
  const calls: Array<{ url: string; options: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, options: RequestInit) => {
      calls.push({ url: url.href, options })
      return Response.json({ ok: true })
    }),
  )
  const config = parseIdentityConfig({
    ...localEnv,
    IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({
      'another-app': {
        hydraAdminUrl: 'http://127.0.0.1:14445/',
        revocation: { url: 'http://127.0.0.1:13000/original/revoke', key: 'e'.repeat(64) },
      },
      'hydra-only-app': { hydraAdminUrl: 'http://127.0.0.1:14445/' },
    }),
  })
  const worker = configuredIdentityOutboxWorker(fixture.db, config, fixture.now)
  expect(await worker.drainOne()).toBe(true)
  const deletes = calls.filter((call) => call.options.method === 'DELETE')
  expect(deletes.map((call) => new URL(call.url).port).sort()).toEqual(['14445', '14445', '14447'])
  expect(deletes.every((call) => new URL(call.url).searchParams.get('sid') === 'shared-sid')).toBe(
    true,
  )
  const posts = calls.filter((call) => call.options.method === 'POST')
  expect(posts).toHaveLength(2)
  expect(posts.find((call) => new URL(call.url).port === '3102')!.options.headers).toMatchObject({
    'X-Identity-Delivery-Key': 'b'.repeat(64),
  })
  expect(posts.find((call) => new URL(call.url).port === '13000')!.options.headers).toMatchObject({
    'X-Identity-Delivery-Key': 'e'.repeat(64),
  })
  expect(posts.map((call) => JSON.parse(String(call.options.body)))).toEqual([
    expect.objectContaining({ sessionId: session.id }),
    expect.objectContaining({ sessionId: session.id }),
  ])
  const row = await outboxState(fixture)
  expect(row.completed_at).toBe(fixture.now())
  expect(JSON.parse(row.delivered_targets).sort()).toEqual(
    [
      'hydra:hydra-only-app:shared-sid',
      'hydra:test-app:shared-sid',
      'hydra:another-app:shared-sid',
      'app:test-app:shared-sid',
      'app:another-app:shared-sid',
    ].sort(),
  )
})

it.each(['unknown-client', 'another-app', 'hydra-only-app'])(
  'keeps %s pending without calling the current Hydra',
  async (clientId) => {
    const { fixture } = await queuedBindings([clientId])
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const errors = vi.fn()
    const worker = configuredIdentityOutboxWorker(
      fixture.db,
      parseIdentityConfig(localEnv),
      fixture.now,
      errors,
    )
    expect(await worker.drainOne()).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
    expect(errors).toHaveBeenCalledWith('IDENTITY_OUTBOX_TARGET_MISSING')
    expect(await outboxState(fixture)).toMatchObject({
      completed_at: null,
      delivered_targets: '[]',
      attempts: 1,
    })
  },
)

it('keeps removed active targets pending without their original destination', async () => {
  const { fixture } = await queuedBindings(['test-app'])
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const worker = configuredIdentityOutboxWorker(
    fixture.db,
    parseIdentityConfig({
      ...localEnv,
      IDENTITY_CLIENTS_JSON: '[]',
      HYDRA_ADMIN_URL: 'http://127.0.0.1:14445/',
    }),
    fixture.now,
    () => undefined,
  )
  expect(await worker.drainOne()).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
  expect((await outboxState(fixture)).completed_at).toBeNull()
})

it('requires the original destination even when an earlier process persisted every delivery key', async () => {
  const { fixture } = await queuedBindings(['hydra-only-app'])
  await fixture.db.query('UPDATE auth_identity_outbox SET delivered_targets = $1', [
    JSON.stringify(['hydra:hydra-only-app:shared-sid']),
  ])
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const errors = vi.fn()
  const worker = configuredIdentityOutboxWorker(
    fixture.db,
    parseIdentityConfig(localEnv),
    fixture.now,
    errors,
  )
  expect(await worker.drainOne()).toBe(true)
  expect(fetch).not.toHaveBeenCalled()
  expect(errors).toHaveBeenCalledWith('IDENTITY_OUTBOX_TARGET_MISSING')
  expect((await outboxState(fixture)).completed_at).toBeNull()
})

it('retries an offline local delivery without repeating its completed Hydra cleanup', async () => {
  const { fixture } = await queuedBindings(['test-app'])
  let offline = true
  const fetch = vi.fn(async (_url: URL, options: RequestInit) => {
    if (options.method === 'POST' && offline) throw new Error('private connection detail')
    return options.method === 'DELETE'
      ? new Response(null, { status: 404 })
      : Response.json({ ok: true })
  })
  vi.stubGlobal('fetch', fetch)
  const errors = vi.fn()
  const worker = configuredIdentityOutboxWorker(
    fixture.db,
    parseIdentityConfig(localEnv),
    fixture.now,
    errors,
  )
  expect(await worker.drainOne()).toBe(true)
  expect(await outboxState(fixture)).toMatchObject({
    completed_at: null,
    delivered_targets: '["hydra:test-app:shared-sid"]',
  })
  expect(errors).toHaveBeenCalledWith('IDENTITY_OUTBOX_DELIVERY_PENDING')
  fixture.advance(999)
  expect(await worker.drainOne()).toBe(false)
  fixture.advance(1)
  offline = false
  expect(await worker.drainOne()).toBe(true)
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(1)
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(2)
  expect((await outboxState(fixture)).completed_at).toBe(fixture.now())
})

it('keeps an offline Hydra target pending with no delivery and safe error reporting', async () => {
  const { fixture } = await queuedBindings(['test-app'])
  const fetch = vi.fn(async () => {
    throw new Error('private unavailable endpoint')
  })
  vi.stubGlobal('fetch', fetch)
  const errors = vi.fn()
  const worker = configuredIdentityOutboxWorker(
    fixture.db,
    parseIdentityConfig(localEnv),
    fixture.now,
    errors,
  )
  expect(await worker.drainOne()).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(errors.mock.calls).toEqual([['IDENTITY_OUTBOX_HYDRA_PENDING']])
  expect(await outboxState(fixture)).toMatchObject({ completed_at: null, delivered_targets: '[]' })
})

it('delivers delayed multi-client account-disable snapshots only to old sessions after recovery', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const email = 'snapshot-targets@example.test'
  const userId = await fixture.seedUser({
    email,
    nickname: 'Snapshots',
    password: 'valid password',
  })
  const oldLogin = await fixture.authServices.login({ email, password: 'valid password' })
  const oldSession = await fixture.authServices.authenticateToken(oldLogin.token)
  for (const clientId of ['test-app', 'another-app', 'hydra-only-app']) {
    await fixture.db.query(
      `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
      VALUES ($1, 'old-shared-sid', $2, $3, $4)`,
      [clientId, oldSession.id, userId, fixture.now()],
    )
  }
  await fixture.authServices.disableUser(userId)
  await fixture.authServices.enableUser(userId)
  const freshLogin = await fixture.authServices.login({ email, password: 'valid password' })
  const freshSession = await fixture.authServices.authenticateToken(freshLogin.token)
  for (const clientId of ['test-app', 'another-app']) {
    await fixture.db.query(
      `INSERT INTO auth_oidc_bindings (client_id, hydra_sid, session_id, user_id, created_at)
      VALUES ($1, 'new-shared-sid', $2, $3, $4)`,
      [clientId, freshSession.id, userId, fixture.now()],
    )
  }
  const hydra = vi.fn().mockResolvedValue(undefined)
  const application = vi.fn().mockResolvedValue(undefined)
  const worker = new IdentityOutboxWorker(
    fixture.db,
    hydra,
    application,
    fixture.now,
    undefined,
    undefined,
    (clientId) => clientId !== 'hydra-only-app',
  )
  expect(await worker.drainOne()).toBe(true)
  expect(hydra.mock.calls.map(([target]) => target)).toEqual([
    { clientId: 'another-app', hydraSid: 'old-shared-sid' },
    { clientId: 'hydra-only-app', hydraSid: 'old-shared-sid' },
    { clientId: 'test-app', hydraSid: 'old-shared-sid' },
  ])
  expect(application.mock.calls.map(([clientId]) => clientId)).toEqual(['another-app', 'test-app'])
  expect(
    application.mock.calls.every(
      ([, message]) => message.sessionId === oldSession.id && !message.userId,
    ),
  ).toBe(true)
  expect(new Set(application.mock.calls.map(([, message]) => message.eventId)).size).toBe(2)
  await expect(fixture.authServices.authenticateToken(freshLogin.token)).resolves.toMatchObject({
    id: freshSession.id,
  })
  for (const clientId of ['test-app', 'another-app']) {
    expect(
      await fixture.authServices.checkLinkedSession(clientId, 'new-shared-sid', userId),
    ).toMatchObject({ active: true, sessionId: freshSession.id })
  }
})

it('completes a configured Hydra-only client without an application notification', async () => {
  const { fixture } = await queuedBindings(['only-hydra'])
  const fetch = vi.fn(
    async (_url: URL, _options: RequestInit) => new Response(null, { status: 204 }),
  )
  vi.stubGlobal('fetch', fetch)
  const worker = configuredIdentityOutboxWorker(
    fixture.db,
    parseIdentityConfig({
      ...localEnv,
      IDENTITY_CLIENTS_JSON: JSON.stringify([
        {
          clientId: 'only-hydra',
          name: 'Hydra Only',
          redirectUri: 'http://127.0.0.1:9001/callback',
          postLogoutRedirectUri: 'http://127.0.0.1:9001/out',
          clientSecret: 'existing',
          scopes: ['openid'],
        },
      ]),
    }),
    fixture.now,
  )
  expect(await worker.drainOne()).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0]![0].pathname).toBe('/admin/oauth2/auth/sessions/login')
  expect(await outboxState(fixture)).toMatchObject({
    completed_at: fixture.now(),
    delivered_targets: '["hydra:only-hydra:shared-sid"]',
  })
})
it.each([302, 500, 'invalid-json'])(
  'keeps failed application delivery %s pending and prohibits redirects',
  async (status) => {
    const { fixture } = await queuedBindings(['test-app'])
    const fetch = vi.fn(async (_url: URL, options: RequestInit) =>
      options.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : new Response('not json', {
            status: typeof status === 'number' ? status : 200,
            headers: { location: 'https://hostile.example/' },
          }),
    )
    vi.stubGlobal('fetch', fetch)
    const worker = configuredIdentityOutboxWorker(
      fixture.db,
      parseIdentityConfig(localEnv),
      fixture.now,
      () => undefined,
    )
    expect(await worker.drainOne()).toBe(true)
    expect(fetch.mock.calls[1]![0].pathname).toBe('/custom/revoke')
    expect(fetch.mock.calls[1]![1]).toMatchObject({
      redirect: 'error',
      headers: { 'X-Identity-Delivery-Key': 'b'.repeat(64) },
    })
    expect(await outboxState(fixture)).toMatchObject({
      completed_at: null,
      delivered_targets: '["hydra:test-app:shared-sid"]',
    })
  },
)
