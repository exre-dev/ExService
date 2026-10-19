import { beforeAll, expect, it } from 'vitest'
import { openDatabase } from '@server/src/db/client'
import { InvitationService } from '@server/src/domains/join/invitations/service'
import { JoinService } from '@server/src/domains/join/applications/service'
import { experiencedJoinApplication, newJoinApplication } from '@tests/helpers/auth'
import { isolatedPostgres } from '@tests/helpers/postgres'

let fixture: Awaited<ReturnType<typeof isolatedPostgres>>
beforeAll(async () => {
  fixture = await isolatedPostgres()
}, 90_000)

it('arbitrates one lifetime email across two independent PostgreSQL connection pools and categories', async () => {
  const contender = await openDatabase({
    connectionString: fixture.connectionString,
    searchPath: fixture.schema,
  })
  try {
    let nextId = 0
    const join = (db: typeof contender) =>
      new JoinService(
        new InvitationService({ db, codeHmacKey: Buffer.alloc(32), now: () => 1_800_000_000_000 }),
        () => `20000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
      )
    const results = await Promise.allSettled([
      join(fixture.db).submit(newJoinApplication(' RACE@EXAMPLE.COM ')),
      join(contender).submit(experiencedJoinApplication('race@example.com')),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toMatchObject([
      { reason: { code: 'JOIN_APPLICATION_EXISTS' } },
    ])
    for (const table of [
      'join_applications',
      'join_application_email_registry',
      'join_application_forms',
    ]) {
      expect(
        (await fixture.db.query<{ n: number }>(`SELECT count(*)::integer AS n FROM ${table}`))
          .rows[0]?.n,
      ).toBe(1)
    }
    const { rows } = await fixture.db.query<{ form_version: number; version: number }>(
      'SELECT a.form_version, f.version FROM join_applications a JOIN join_application_forms f ON f.application_id = a.id',
    )
    expect(rows).toEqual([{ form_version: 1, version: 1 }])
  } finally {
    await contender.close()
    await fixture.close()
  }
}, 30_000)
