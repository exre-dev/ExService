import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { openDatabase } from '@server/src/db/client'
import { runMigrations } from '@server/src/db/migration-runner'
import { resetDatabase } from '@server/src/db/reset-plan'
import { assertDatabaseReady } from '@server/src/db/schema-check'

let container: StartedPostgreSqlContainer
let connectionString: string

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18').withDatabase('exre').start()
  const url = new URL(container.getConnectionUri())
  url.hostname = '127.0.0.1'
  connectionString = url.toString()
}, 120_000)
afterAll(async () => {
  await container?.stop()
}, 60_000)

it('migrates and safely resets only a temporary PostgreSQL 18 exre database', async () => {
  await runMigrations({ connectionString })
  const db = await openDatabase({ connectionString })
  try {
    const version = (
      await db.query<{ version_num: number }>(
        "SELECT current_setting('server_version_num')::integer AS version_num",
      )
    ).rows[0]!.version_num
    expect(version).toBeGreaterThanOrEqual(180000)
    expect(version).toBeLessThan(190000)
    await expect(assertDatabaseReady(db)).resolves.toBeUndefined()
    await db.query(`INSERT INTO auth_users (id,email,nickname,password_hash,created_at)
      VALUES ('user-1','member@example.com','Member','hash',1)`)
    await resetDatabase({ connectionString }, 'exre')
    await expect(assertDatabaseReady(db)).resolves.toBeUndefined()
    expect((await db.query('SELECT * FROM auth_users')).rows).toEqual([])
    expect((await db.query<{ code: string }>('SELECT code FROM community_groups')).rows).toEqual([
      { code: 'admin' },
    ])
    const migrations = JSON.parse(
      readFileSync(
        new URL('../../apps/server/drizzle/meta/_journal.json', import.meta.url),
        'utf8',
      ),
    ) as {
      entries: Array<{ tag: string; when: number }>
    }
    const journal = await db.query<{ hash: string; created_at: number }>(
      'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id',
    )
    expect(journal.rows).toEqual(
      migrations.entries.map((entry) => ({
        hash: createHash('sha256')
          .update(
            readFileSync(
              new URL(`../../apps/server/drizzle/${entry.tag}.sql`, import.meta.url),
              'utf8',
            ),
          )
          .digest('hex'),
        created_at: entry.when,
      })),
    )

    await db.query(`INSERT INTO auth_users (id,email,nickname,password_hash,created_at)
      VALUES ('user-2','keep@example.com','Keep','hash',2)`)
    await db.query('CREATE TABLE foreign_data (id integer)')
    const beforeUsers = (await db.query('SELECT * FROM auth_users ORDER BY id')).rows
    const beforeJournal = (await db.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id'))
      .rows
    await expect(resetDatabase({ connectionString }, 'exre')).rejects.toThrow()
    expect((await db.query('SELECT * FROM auth_users ORDER BY id')).rows).toEqual(beforeUsers)
    expect((await db.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows).toEqual(
      beforeJournal,
    )
    expect((await db.query('SELECT id FROM foreign_data')).rows).toEqual([])
  } finally {
    await db.close()
  }
}, 60_000)
