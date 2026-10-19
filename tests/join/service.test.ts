import { afterEach, expect, it, vi } from 'vitest'
import {
  approvedInvitation,
  createTestAuth,
  joinSnapshot,
  registerInvited,
  newJoinApplication,
  type TestAuth,
} from '@tests/helpers/auth'
import { JoinRateLimiter } from '@server/src/domains/join/applications/rate-limiter'
import { publicWebBaseUrl } from '@server/src/domains/join/invitations/mail'
const fixtures: TestAuth[] = []
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
async function setup(overrides: Parameters<typeof createTestAuth>[0] = {}) {
  const f = await createTestAuth(overrides)
  fixtures.push(f)
  return f
}
const all = async <T extends Record<string, unknown>>(
  f: TestAuth,
  sql: string,
  values: unknown[] = [],
) => (await f.db.query<T>(sql, values)).rows
const one = async <T extends Record<string, unknown>>(
  f: TestAuth,
  sql: string,
  values: unknown[] = [],
) => (await all<T>(f, sql, values))[0]
const error = (code: string) => expect.objectContaining({ code })
const input = (completionToken: string, nickname = 'Final', password = 'valid password') => ({
  completionToken,
  nickname,
  password,
})
it('rejects duplicate lifetime applications without overwriting original values and distinguishes account conflicts', async () => {
  const f = await setup()
  await f.joinServices.submit(
    newJoinApplication('  MEMBER@EXAMPLE.COM  ', '  Original  ', '000123'),
  )
  await expect(
    f.joinServices.submit(newJoinApplication('member@example.com', 'Changed', '001234')),
  ).rejects.toMatchObject(error('JOIN_APPLICATION_EXISTS'))
  const list = await f.joinServices.list()
  expect(list.total).toBe(1)
  expect(list.items[0]).toMatchObject({
    nickname: 'Original',
    qq: '000123',
    email: 'member@example.com',
    reviewedByUserId: null,
  })
  const id = list.items[0]!.id
  const rejected = await f.joinServices.reject(id)
  expect(rejected.application.status).toBe('rejected')
  expect(await f.joinServices.reject(id)).toEqual(rejected)
  await expect(f.joinServices.approve(id)).rejects.toMatchObject({ code: 'JOIN_STATE_CONFLICT' })
  const before = await joinSnapshot(f)
  await expect(
    f.joinServices.submit(newJoinApplication('member@example.com', 'Second', '001234')),
  ).rejects.toMatchObject(error('JOIN_APPLICATION_EXISTS'))
  expect(await joinSnapshot(f)).toEqual(before)
  expect((await f.joinServices.list({ view: 'all' })).total).toBe(1)
  expect((await f.joinServices.list()).total).toBe(0)
  await f.seedUser({
    email: 'account@example.com',
    nickname: 'Existing',
    password: 'valid password',
  })
  await expect(
    f.joinServices.submit(newJoinApplication('account@example.com', 'Hidden', '001234')),
  ).rejects.toMatchObject(error('EMAIL_IN_USE'))
  expect((await f.joinServices.list({ view: 'all' })).total).toBe(1)
})
it('keeps cooldown approval rejection entirely read-only even with expired rows and stale pending deliveries', async () => {
  const f = await setup()
  const old = await approvedInvitation(f, 'old@example.com')
  f.advance(7 * 86_400_000)
  // Simulate a restart with abandoned delivery and stale active invitation.
  await f.db.query("UPDATE join_delivery_attempts SET status='pending', finished_at=NULL")
  await f.joinServices.submit(newJoinApplication('new@example.com', 'New', '001234'))
  await f.db.query(
    "UPDATE join_invitations SET status='active', code_digest='sensitive', code_expires_at=$1, completion_token_hash='old-grant', completion_expires_at=$2 WHERE application_id=$3",
    [f.now() - 1, f.now() - 1, old.id],
  )
  await f.db.query("UPDATE join_delivery_attempts SET status='pending', finished_at=NULL")
  await f.db.query(
    'INSERT INTO join_email_controls (email,next_send_at,failed_attempts) VALUES ($1, $2, 0)',
    ['new@example.com', f.now() + 60_000],
  )
  const id = (await f.joinServices.list()).items[0]!.id
  // List cleans stale rows: restore them immediately before testing the gate.
  await f.db.query(
    "UPDATE join_invitations SET status='active', code_digest='sensitive', code_expires_at=$1, completion_token_hash='old-grant', completion_expires_at=$2 WHERE application_id=$3",
    [f.now() - 1, f.now() - 1, old.id],
  )
  await f.db.query("UPDATE join_delivery_attempts SET status='pending', finished_at=NULL")
  const before = await joinSnapshot(f)
  await expect(f.joinServices.approve(id)).rejects.toMatchObject({
    code: 'CODE_RESEND_TOO_SOON',
    retryAfterSeconds: 60,
  })
  expect(await joinSnapshot(f)).toEqual(before)
  f.advance(60_000)
  const approved = await f.joinServices.approve(id)
  expect(approved.application.status).toBe('approved')
  const after = await joinSnapshot(f)
  expect(await f.joinServices.approve(id)).toEqual(approved)
  expect(await joinSnapshot(f)).toEqual(after)
  expect(f.deliveries.length).toBe(2)
})
it('makes same approval idempotent and allows only one concurrent opposite decision', async () => {
  const f = await setup()
  await f.joinServices.submit(newJoinApplication('member@example.com', 'Member', '001234'))
  const id = (await f.joinServices.list()).items[0]!.id
  const [approval, rejection] = await Promise.allSettled([
    f.joinServices.approve(id),
    f.joinServices.reject(id),
  ])
  expect([approval.status, rejection.status].sort()).toEqual(['fulfilled', 'rejected'])
  if (approval.status === 'fulfilled') {
    expect(rejection.status === 'rejected' && rejection.reason).toMatchObject(
      error('JOIN_STATE_CONFLICT'),
    )
    expect((await f.joinServices.get(id)).application.status).toBe('approved')
    expect(await f.joinServices.approve(id)).toEqual(approval.value)
    await expect(f.joinServices.reject(id)).rejects.toMatchObject(error('JOIN_STATE_CONFLICT'))
    expect(f.deliveries).toHaveLength(1)
  } else {
    expect(approval.reason).toMatchObject(error('JOIN_STATE_CONFLICT'))
    if (rejection.status !== 'fulfilled')
      throw new Error('Expected rejection to win the review decision')
    expect((await f.joinServices.get(id)).application.status).toBe('rejected')
    expect(await f.joinServices.reject(id)).toEqual(rejection.value)
    await expect(f.joinServices.approve(id)).rejects.toMatchObject(error('JOIN_STATE_CONFLICT'))
    expect(f.deliveries).toHaveLength(0)
  }
  const reject = await setup()
  await reject.joinServices.submit(newJoinApplication('member@example.com', 'Member', '001234'))
  const rejectId = (await reject.joinServices.list()).items[0]!.id
  await reject.joinServices.reject(rejectId)
  await expect(reject.joinServices.approve(rejectId)).rejects.toMatchObject({
    code: 'JOIN_STATE_CONFLICT',
  })
})
it('checks all eligibility cases without touching any tables or dependencies', async () => {
  const f = await setup({
    deliverInvitation: () => {
      throw new Error('private provider failure')
    },
  })
  await expect(f.invitationServices.checkEligibility('unknown@example.com')).rejects.toMatchObject(
    error('INVITATION_APPLICATION_NOT_FOUND'),
  )
  await f.joinServices.submit(newJoinApplication('pending@example.com', 'Pending', '001234'))
  await expect(f.invitationServices.checkEligibility('pending@example.com')).rejects.toMatchObject(
    error('INVITATION_NOT_ELIGIBLE'),
  )
  const pending = (await f.joinServices.list()).items[0]!.id
  await f.joinServices.reject(pending)
  await expect(f.invitationServices.checkEligibility('pending@example.com')).rejects.toMatchObject(
    error('INVITATION_NOT_ELIGIBLE'),
  )
  const approved = await approvedInvitation(f)
  expect((await f.joinServices.get(approved.id)).application.deliveryStatus).toBe('failed')
  f.advance(600_000)
  let before = await joinSnapshot(f)
  expect((await f.invitationServices.checkEligibility('member@example.com')).status).toBe(
    'eligible',
  )
  expect(await joinSnapshot(f)).toEqual(before)
  expect(f.deliveries.length).toBe(1)
  await f.invitationServices.requestCode('member@example.com')
  const grant = await f.invitationServices.verifyCode(
    'member@example.com',
    f.deliveries.at(-1)!.code,
  )
  before = await joinSnapshot(f)
  expect((await f.invitationServices.checkEligibility('member@example.com')).status).toBe(
    'eligible',
  )
  expect(await joinSnapshot(f)).toEqual(before)
  await f.invitationServices.complete(input(grant.completionToken))
  before = await joinSnapshot(f)
  await expect(f.invitationServices.checkEligibility('member@example.com')).rejects.toMatchObject(
    error('INVITATION_NOT_ELIGIBLE'),
  )
  expect(await joinSnapshot(f)).toEqual(before)
  const expired = await approvedInvitation(f, 'expired@example.com')
  f.advance(7 * 86_400_000)
  before = await joinSnapshot(f)
  await expect(f.invitationServices.checkEligibility(expired.email)).rejects.toMatchObject(
    error('INVITATION_NOT_ELIGIBLE'),
  )
  expect(await joinSnapshot(f)).toEqual(before)
})
it('does not require usable code or reset locks during read-only eligibility checks', async () => {
  const f = await setup()
  const { email } = await approvedInvitation(f)
  for (let n = 1; n <= 5; n++)
    await expect(f.invitationServices.verifyCode(email, '000000')).rejects.toMatchObject(
      error(n === 5 ? 'INVITATION_CODE_LOCKED' : 'INVITATION_CODE_INVALID'),
    )
  const before = await joinSnapshot(f)
  expect((await f.invitationServices.checkEligibility(email)).status).toBe('eligible')
  expect(await joinSnapshot(f)).toEqual(before)
  await expect(f.invitationServices.verifyCode(email, f.deliveries[0]!.code)).rejects.toMatchObject(
    error('INVITATION_CODE_LOCKED'),
  )
})
it('shares resend cooldown, preserves failure windows across code changes and unlocks at the exact window boundary', async () => {
  const codes = [42, 43, 44],
    f = await setup({ randomInteger: () => codes.shift() ?? 45 })
  const { id, email } = await approvedInvitation(f)
  expect(f.deliveries[0]!.code).toBe('000042')
  await expect(f.invitationServices.verifyCode(email, '111111')).rejects.toMatchObject(
    error('INVITATION_CODE_INVALID'),
  )
  f.advance(59_000)
  await expect(f.joinServices.resend(id)).rejects.toMatchObject({
    code: 'CODE_RESEND_TOO_SOON',
    retryAfterSeconds: 1,
  })
  expect(await f.invitationServices.requestCode(email)).toEqual({
    status: 'accepted',
    serverTime: f.now(),
    resendAvailableAt: f.now() + 60_000,
  })
  expect(f.deliveries.length).toBe(1)
  f.advance(1_000)
  await f.joinServices.resend(id)
  expect(f.deliveries[1]!.code).toBe('000043')
  await expect(f.invitationServices.verifyCode(email, '000042')).rejects.toMatchObject(
    error('INVITATION_CODE_INVALID'),
  )
  for (let n = 0; n < 3; n++)
    await expect(f.invitationServices.verifyCode(email, '111111')).rejects.toMatchObject(
      error(n === 2 ? 'INVITATION_CODE_LOCKED' : 'INVITATION_CODE_INVALID'),
    )
  expect(
    await one(f, 'SELECT failed_attempts FROM join_email_controls WHERE email=$1', [email]),
  ).toEqual({ failed_attempts: 5 })
  f.advance(60_000)
  await f.invitationServices.requestCode(email)
  await expect(f.invitationServices.verifyCode(email, '000044')).rejects.toMatchObject(
    error('INVITATION_CODE_LOCKED'),
  )
  f.advance(480_000)
  expect((await f.invitationServices.verifyCode(email, '000044')).status).toBe('verified')
})
it('commits unknown-email failed attempts and uses the same lock window', async () => {
  const f = await setup()
  for (let n = 1; n <= 5; n++)
    await expect(
      f.invitationServices.verifyCode('unknown@example.com', '000000'),
    ).rejects.toMatchObject(error(n === 5 ? 'INVITATION_CODE_LOCKED' : 'INVITATION_CODE_INVALID'))
  expect(await one(f, 'SELECT failed_attempts FROM join_email_controls')).toEqual({
    failed_attempts: 5,
  })
  f.advance(599_999)
  await expect(
    f.invitationServices.verifyCode('unknown@example.com', '000000'),
  ).rejects.toMatchObject({ code: 'INVITATION_CODE_LOCKED', retryAfterSeconds: 1 })
  f.advance(1)
  await expect(
    f.invitationServices.verifyCode('unknown@example.com', '000000'),
  ).rejects.toMatchObject(error('INVITATION_CODE_INVALID'))
  expect(await one(f, 'SELECT failed_attempts FROM join_email_controls')).toEqual({
    failed_attempts: 1,
  })
})
it('expires code at ten minutes without increasing guesses and expires invitations at seven days', async () => {
  const f = await setup(),
    a = await approvedInvitation(f)
  f.advance(600_000)
  await expect(f.invitationServices.verifyCode(a.email, a.code)).rejects.toMatchObject(
    error('INVITATION_CODE_INVALID'),
  )
  expect(await one(f, 'SELECT failed_attempts FROM join_email_controls')).toEqual({
    failed_attempts: 0,
  })
  await f.invitationServices.requestCode(a.email)
  const grant = await f.invitationServices.verifyCode(a.email, f.deliveries.at(-1)!.code)
  await expect(
    f.invitationServices.verifyCode(a.email, f.deliveries.at(-1)!.code),
  ).rejects.toMatchObject(error('INVITATION_CODE_INVALID'))
  expect(await one(f, 'SELECT failed_attempts FROM join_email_controls')).toEqual({
    failed_attempts: 0,
  })
  f.advance(7 * 86_400_000 - 600_000)
  await expect(f.invitationServices.checkEligibility(a.email)).rejects.toMatchObject(
    error('INVITATION_NOT_ELIGIBLE'),
  )
  await expect(f.invitationServices.complete(input(grant.completionToken))).rejects.toMatchObject({
    code: 'COMPLETION_GRANT_INVALID',
  })
  const refreshed = await f.joinServices.resend(a.id)
  expect(refreshed.invitation!.expiresAt).toBe(f.now() + 7 * 86_400_000)
  expect(await all(f, 'SELECT status FROM join_invitations ORDER BY issued_at')).toEqual([
    { status: 'expired' },
    { status: 'active' },
  ])
})
it('clips code and completion expiry to invitation expiry', async () => {
  const f = await setup(),
    a = await approvedInvitation(f)
  f.advance(7 * 86_400_000 - 300_000)
  await f.invitationServices.requestCode(a.email)
  const mail = f.deliveries.at(-1)!
  expect(mail.codeExpiresAt).toBe(mail.invitationExpiresAt)
  const grant = await f.invitationServices.verifyCode(a.email, mail.code)
  expect(grant.completionExpiresAt).toBe(mail.invitationExpiresAt)
  f.advance(300_000)
  await expect(f.invitationServices.complete(input(grant.completionToken))).rejects.toMatchObject({
    code: 'COMPLETION_GRANT_INVALID',
  })
})
it('replaces completion grants only on new verification and creates an immutable idempotent result', async () => {
  const f = await setup(),
    a = await approvedInvitation(f),
    firstGrant = await f.invitationServices.verifyCode(a.email, a.code)
  expect(await one(f, 'SELECT count(*) n FROM auth_users')).toEqual({ n: 0 })
  f.advance(60_000)
  await f.invitationServices.requestCode(a.email)
  expect(await one(f, 'SELECT completion_token_hash FROM join_invitations')).not.toEqual({
    completion_token_hash: null,
  })
  const two = await f.invitationServices.verifyCode(a.email, f.deliveries.at(-1)!.code)
  await expect(
    f.invitationServices.complete(input(firstGrant.completionToken)),
  ).rejects.toMatchObject({ code: 'COMPLETION_GRANT_INVALID' })
  expect(await f.invitationServices.complete(input(two.completionToken, 'Chosen'))).toEqual({
    status: 'registered',
    email: a.email,
  })
  expect(
    await f.invitationServices.complete(input(two.completionToken, 'Changed', 'another password')),
  ).toEqual({ status: 'registered', email: a.email })
  expect(
    await one(f, 'SELECT nickname,password_hash,qq,avatar_key,fivem_id FROM auth_users'),
  ).toEqual({
    nickname: 'Chosen',
    password_hash: 'test-password:valid password',
    qq: '001234',
    avatar_key: null,
    fivem_id: null,
  })
  expect(await one(f, 'SELECT count(*) n FROM auth_sessions')).toEqual({ n: 0 })
  expect(await one(f, 'SELECT count(*) n FROM community_group_memberships')).toEqual({ n: 0 })
  f.advance(1_800_000)
  await expect(f.invitationServices.complete(input(two.completionToken))).rejects.toMatchObject({
    code: 'COMPLETION_GRANT_INVALID',
  })
})
it('rechecks time after asynchronous hashing before creating any account', async () => {
  let resolve!: (value: string) => void
  const f = await setup({
      passwordHasher: {
        hash: () =>
          new Promise<string>((r) => {
            resolve = r
          }),
        verify: async () => true,
      },
    }),
    a = await approvedInvitation(f),
    grant = await f.invitationServices.verifyCode(a.email, a.code)
  const pending = f.invitationServices.complete(input(grant.completionToken))
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  f.advance(1_800_000)
  resolve('hashed')
  await expect(pending).rejects.toMatchObject({ code: 'COMPLETION_GRANT_INVALID' })
  expect(await one(f, 'SELECT count(*) n FROM auth_users')).toEqual({ n: 0 })
})
it('allows exactly one concurrent completion and prevents losing hashes from modifying it', async () => {
  const resolvers: Array<(value: string) => void> = [],
    f = await setup({
      passwordHasher: {
        hash: () => new Promise<string>((resolve) => resolvers.push(resolve)),
        verify: async () => true,
      },
    }),
    a = await approvedInvitation(f),
    grant = await f.invitationServices.verifyCode(a.email, a.code)
  const first = f.invitationServices.complete(input(grant.completionToken, 'First')),
    second = f.invitationServices.complete(input(grant.completionToken, 'Second'))
  await vi.waitFor(() => expect(resolvers).toHaveLength(2))
  resolvers[1]!('second-hash')
  await second
  resolvers[0]!('first-hash')
  expect(await first).toEqual({ status: 'registered', email: a.email })
  expect(await all(f, 'SELECT nickname,password_hash FROM auth_users')).toEqual([
    { nickname: 'Second', password_hash: 'second-hash' },
  ])
})
it('rechecks grant replacement and account competition after asynchronous hash', async () => {
  let release!: (v: string) => void
  const f = await setup({
      passwordHasher: {
        hash: () =>
          new Promise<string>((r) => {
            release = r
          }),
        verify: async () => true,
      },
    }),
    a = await approvedInvitation(f),
    grantOne = await f.invitationServices.verifyCode(a.email, a.code)
  const pending = f.invitationServices.complete(input(grantOne.completionToken))
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  f.advance(60_000)
  await f.invitationServices.requestCode(a.email)
  await f.invitationServices.verifyCode(a.email, f.deliveries.at(-1)!.code)
  release('hash')
  await expect(pending).rejects.toMatchObject({ code: 'COMPLETION_GRANT_INVALID' })
  const two = await one(f, 'SELECT completion_token_hash FROM join_invitations')
  expect(two).not.toBeNull()
  let releaseOther: ((value: string) => void) | undefined
  const other = await setup({
      passwordHasher: {
        hash: () =>
          new Promise<string>((r) => {
            releaseOther = r
          }),
        verify: async () => true,
      },
    }),
    b = await approvedInvitation(other),
    grant = await other.invitationServices.verifyCode(b.email, b.code)
  const competing = other.invitationServices.complete(input(grant.completionToken))
  await vi.waitFor(() => expect(releaseOther).toBeTypeOf('function'))
  await other.db.query(
    'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
    ['30000000-0000-4000-8000-000000000001', b.email, 'External', 'original', other.now()],
  )
  releaseOther!('hash')
  await expect(competing).rejects.toMatchObject({ code: 'EMAIL_IN_USE' })
  expect(await one(other, 'SELECT nickname,password_hash FROM auth_users')).toEqual({
    nickname: 'External',
    password_hash: 'original',
  })
})
it('keeps approval after delivery failure and never stores codes, URLs, tokens or provider errors in database', async () => {
  const f = await setup({
      deliverInvitation: () => {
        throw new Error('provider sensitive exception')
      },
    }),
    a = await approvedInvitation(f)
  expect((await f.joinServices.get(a.id)).application.deliveryStatus).toBe('failed')
  expect((await f.invitationServices.checkEligibility(a.email)).status).toBe('eligible')
  await expect(f.joinServices.resend(a.id)).rejects.toMatchObject({ code: 'CODE_RESEND_TOO_SOON' })
  const before = JSON.stringify(await joinSnapshot(f)),
    code = f.deliveries[0]!.code
  expect(before).not.toContain(code)
  expect(before).not.toContain('provider sensitive')
  expect(before).not.toContain('/register?')
  const grant = await f.invitationServices.verifyCode(a.email, code)
  expect(JSON.stringify(await joinSnapshot(f))).not.toContain(grant.completionToken)
  await f.invitationServices.complete(input(grant.completionToken))
})
it('marks timeout failed, ignores late adapter success and preserves newer attempt result', async () => {
  let release!: () => void, started!: () => void
  let deliveryStarted = new Promise<void>((r) => {
    started = r
  })
  const f = await setup({
    deliverInvitation: () =>
      new Promise<void>((r) => {
        release = r
        started()
      }),
  })
  await f.joinServices.submit(newJoinApplication('member@example.com', 'Member', '001234'))
  const id = (await f.joinServices.list()).items[0]!.id
  vi.useFakeTimers()
  const pending = f.joinServices.approve(id)
  await deliveryStarted
  await vi.advanceTimersByTimeAsync(10_000)
  expect((await pending).application.deliveryStatus).toBe('failed')
  release()
  await Promise.resolve()
  expect((await f.joinServices.get(id)).application.deliveryStatus).toBe('failed')
  f.advance(60_000)
  deliveryStarted = new Promise<void>((r) => {
    started = r
  })
  const resend = f.joinServices.resend(id)
  await deliveryStarted
  release()
  expect((await resend).application.deliveryStatus).toBe('sent')
  expect(await all(f, 'SELECT status FROM join_delivery_attempts ORDER BY code_version')).toEqual([
    { status: 'failed' },
    { status: 'sent' },
  ])
})
it('recovers abandoned pending deliveries only on later mutating-flow requests, not check or startup', async () => {
  const f = await setup(),
    a = await approvedInvitation(f)
  await f.db.query("UPDATE join_delivery_attempts SET status='pending',finished_at=NULL")
  f.advance(10_000)
  const before = await joinSnapshot(f)
  expect((await f.invitationServices.checkEligibility(a.email)).status).toBe('eligible')
  expect(await joinSnapshot(f)).toEqual(before)
  await f.invitationServices.requestCode('other@example.com')
  expect(await one(f, 'SELECT status FROM join_delivery_attempts')).toEqual({ status: 'failed' })
})
it('uses safe base URLs and a bounded expiring IP limiter', () => {
  for (const url of [
    'https://user:secret@example.com',
    'https://example.com/path',
    'https://example.com?x=1',
    'https://example.com/#x',
    'javascript:alert(1)',
    'invalid',
  ])
    expect(() => publicWebBaseUrl(url)).toThrow()
  expect(publicWebBaseUrl('https://example.com/')).toBe('https://example.com')
  let now = 0
  const limiter = new JoinRateLimiter(() => now)
  for (let i = 0; i < 60; i++) expect(limiter.check('ip')).toBeUndefined()
  expect(limiter.check('ip')).toBe(60)
  for (let i = 0; i < 1024; i++) limiter.check(`other-${i}`)
  expect(limiter.check('ip')).toBeUndefined()
  now = 60_000
  expect(limiter.check('ip')).toBeUndefined()
})
it('returns the same anonymous code acceptance for unknown, pending, cooldown and failed deliveries', async () => {
  const f = await setup({ deliverInvitation: () => Promise.reject(new Error('delivery failed')) })
  const at = f.now(),
    expected = { status: 'accepted', serverTime: at, resendAvailableAt: at + 60_000 }
  expect(await f.invitationServices.requestCode('unknown@example.com')).toEqual(expected)
  expect(await all(f, 'SELECT * FROM join_email_controls')).toEqual([])
  await f.joinServices.submit(newJoinApplication('pending@example.com', 'Pending', '001234'))
  expect(await f.invitationServices.requestCode('pending@example.com')).toEqual(expected)
  const a = await approvedInvitation(f)
  expect(await f.invitationServices.requestCode(a.email)).toEqual(expected)
  expect(f.deliveries.length).toBe(1)
  f.advance(60_000)
  expect(await f.invitationServices.requestCode(a.email)).toEqual({
    status: 'accepted',
    serverTime: f.now(),
    resendAvailableAt: f.now() + 60_000,
  })
  expect((await f.joinServices.get(a.id)).application.deliveryStatus).toBe('failed')
})
it('fails verification after previously successful eligibility becomes invalid', async () => {
  const f = await setup(),
    a = await approvedInvitation(f)
  expect((await f.invitationServices.checkEligibility(a.email)).status).toBe('eligible')
  f.advance(7 * 86_400_000)
  await expect(f.invitationServices.verifyCode(a.email, a.code)).rejects.toMatchObject(
    error('INVITATION_CODE_INVALID'),
  )
  expect(await one(f, 'SELECT count(*) n FROM auth_users')).toEqual({ n: 0 })
})
it('limits lazy cleanup to 25 expired records in each category', async () => {
  const f = await setup()
  for (let i = 0; i < 30; i++) await approvedInvitation(f, `member-${i}@example.com`)
  f.advance(7 * 86_400_000)
  await f.invitationServices.requestCode('trigger@example.com')
  expect(await one(f, "SELECT count(*) n FROM join_invitations WHERE status='expired'")).toEqual({
    n: 25,
  })
  const last = await one<{ email: string }>(
    f,
    "SELECT a.email FROM join_applications a JOIN join_invitations i ON a.id=i.application_id WHERE i.status='active' LIMIT 1",
  )
  const before = await joinSnapshot(f)
  await expect(f.invitationServices.checkEligibility(last!.email)).rejects.toMatchObject(
    error('INVITATION_NOT_ELIGIBLE'),
  )
  expect(await joinSnapshot(f)).toEqual(before)
})
