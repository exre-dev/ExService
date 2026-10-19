import { afterEach, expect, it } from 'vitest'
import {
  createTestAuth,
  newJoinApplication,
  testPasswordHasher,
  type TestAuth,
} from '@tests/helpers/auth'
import { openDatabase } from '@server/src/db/client'
import { InvitationService } from '@server/src/domains/join/invitations/service'
import { JoinService } from '@server/src/domains/join/applications/service'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('stores one complete application per normalized email in PostgreSQL', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const first = await fixture.joinServices.submit(newJoinApplication(' MEMBER@EXAMPLE.COM '))
  expect(first).toEqual({ status: 'received' })
  await expect(
    fixture.joinServices.submit(newJoinApplication('member@example.com')),
  ).rejects.toMatchObject({ code: 'JOIN_APPLICATION_EXISTS' })
  const { rows } = await fixture.db.query<{
    applications: string
    forms: string
    registrations: string
  }>(`
    SELECT (SELECT count(*) FROM join_applications)::text AS applications,
           (SELECT count(*) FROM join_application_forms)::text AS forms,
           (SELECT count(*) FROM join_application_email_registry)::text AS registrations`)
  expect(rows[0]).toEqual({ applications: '1', forms: '1', registrations: '1' })
})

it('arbitrates concurrent applications through the email registry without partial rows', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const results = await Promise.allSettled([
    fixture.joinServices.submit(newJoinApplication(' RACE@EXAMPLE.COM ')),
    fixture.joinServices.submit(newJoinApplication('race@example.com')),
  ])
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
  const rejected = results.find((result) => result.status === 'rejected')
  expect(rejected).toMatchObject({ reason: { code: 'JOIN_APPLICATION_EXISTS' } })
  const { rows } = await fixture.db.query<{
    applications: string
    forms: string
    registrations: string
  }>(`
    SELECT (SELECT count(*) FROM join_applications)::text AS applications,
           (SELECT count(*) FROM join_application_forms)::text AS forms,
           (SELECT count(*) FROM join_application_email_registry)::text AS registrations`)
  expect(rows[0]).toEqual({ applications: '1', forms: '1', registrations: '1' })
})

it('consumes a code once and completes one account when the same grant races', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  await fixture.joinServices.submit(newJoinApplication())
  const { rows } = await fixture.db.query<{ id: string }>(
    'SELECT id FROM join_applications WHERE email = $1',
    ['member@example.com'],
  )
  const approved = await fixture.joinServices.approve(rows[0]!.id)
  expect(approved.application.status).toBe('approved')
  expect(approved.application.deliveryStatus).toBe('sent')
  const code = fixture.deliveries.at(-1)!.code
  const grant = await fixture.invitationServices.verifyCode('member@example.com', code)
  await expect(
    fixture.invitationServices.verifyCode('member@example.com', code),
  ).rejects.toMatchObject({ code: 'INVITATION_CODE_INVALID' })
  const input = {
    completionToken: grant.completionToken,
    nickname: 'Member',
    password: 'valid password',
  }
  const results = await Promise.all([
    fixture.invitationServices.complete(input),
    fixture.invitationServices.complete(input),
  ])
  expect(results).toEqual([
    { status: 'registered', email: 'member@example.com' },
    { status: 'registered', email: 'member@example.com' },
  ])
  expect(
    (await fixture.db.query<{ n: number }>('SELECT count(*) n FROM auth_users')).rows[0],
  ).toEqual({ n: 1 })
  const completed = await fixture.db.query<{ status: string; completed_user_id: string }>(
    'SELECT status, completed_user_id FROM join_invitations WHERE application_id = $1',
    [rows[0]!.id],
  )
  expect(completed.rows[0]).toMatchObject({
    status: 'completed',
    completed_user_id: expect.any(String),
  })
})

it('serializes review and resend across independent database pools', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const secondDb = await openDatabase({
    connectionString: fixture.connectionString,
    searchPath: fixture.schema,
  })
  try {
    const otherInvitations = new InvitationService({
      db: secondDb,
      now: fixture.now,
      codeHmacKey: Buffer.alloc(32, 7),
      passwordHasher: testPasswordHasher,
      deliverInvitation: async () => undefined,
    })
    const otherJoin = new JoinService(otherInvitations)
    await fixture.joinServices.submit(newJoinApplication())
    const { rows } = await fixture.db.query<{ id: string }>(
      'SELECT id FROM join_applications WHERE email = $1',
      ['member@example.com'],
    )
    const id = rows[0]!.id
    const reviews = await Promise.all([fixture.joinServices.approve(id), otherJoin.approve(id)])
    expect(reviews.map((review) => review.application.status)).toEqual(['approved', 'approved'])
    expect(
      (await fixture.db.query<{ n: number }>('SELECT count(*) n FROM join_invitations')).rows[0],
    ).toEqual({ n: 1 })
    expect(
      (await fixture.db.query<{ n: number }>('SELECT count(*) n FROM join_delivery_attempts'))
        .rows[0],
    ).toEqual({ n: 1 })
    fixture.advance(60_000)
    const resends = await Promise.allSettled([
      fixture.joinServices.resend(id),
      otherJoin.resend(id),
    ])
    expect(resends.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(resends.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'CODE_RESEND_TOO_SOON' },
    })
    expect(
      (await fixture.db.query<{ n: number }>('SELECT count(*) n FROM join_delivery_attempts'))
        .rows[0],
    ).toEqual({ n: 2 })
  } finally {
    await secondDb.close()
  }
})

it('counts concurrent invalid codes and completes a grant across independent database pools', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const secondDb = await openDatabase({
    connectionString: fixture.connectionString,
    searchPath: fixture.schema,
  })
  try {
    const other = new InvitationService({
      db: secondDb,
      now: fixture.now,
      codeHmacKey: Buffer.alloc(32, 7),
      passwordHasher: testPasswordHasher,
    })
    await fixture.joinServices.submit(newJoinApplication())
    const { rows } = await fixture.db.query<{ id: string }>(
      'SELECT id FROM join_applications WHERE email = $1',
      ['member@example.com'],
    )
    await fixture.joinServices.approve(rows[0]!.id)
    const failures = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        (index % 2 === 0 ? fixture.invitationServices : other).verifyCode(
          'member@example.com',
          '000000',
        ),
      ),
    )
    expect(failures.every((result) => result.status === 'rejected')).toBe(true)
    expect(
      (
        await fixture.db.query<{ failed_attempts: number }>(
          'SELECT failed_attempts FROM join_email_controls WHERE email = $1',
          ['member@example.com'],
        )
      ).rows[0],
    ).toEqual({ failed_attempts: 5 })
    fixture.advance(600_000)
    await fixture.invitationServices.requestCode('member@example.com')
    const grant = await other.verifyCode('member@example.com', fixture.deliveries.at(-1)!.code)
    const input = {
      completionToken: grant.completionToken,
      nickname: 'Member',
      password: 'valid password',
    }
    expect(
      await Promise.all([fixture.invitationServices.complete(input), other.complete(input)]),
    ).toEqual(Array(2).fill({ status: 'registered', email: 'member@example.com' }))
    expect(
      (await fixture.db.query<{ n: number }>('SELECT count(*) n FROM auth_users')).rows[0],
    ).toEqual({ n: 1 })
  } finally {
    await secondDb.close()
  }
})
