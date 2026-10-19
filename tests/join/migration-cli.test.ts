import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import { isolatedPostgres } from '@tests/helpers/postgres'
import { resetDatabase } from '@server/src/db/reset-plan'
import { runMigrations } from '@server/src/db/migration-runner'
import { APPLICATION_TABLES } from '@server/src/db/schema-check'

const requireServer = createRequire(new URL('../../apps/server/package.json', import.meta.url))
const entry = fileURLToPath(new URL('../../apps/server/src/db/migrate.ts', import.meta.url))
const tsx = pathToFileURL(requireServer.resolve('tsx')).href
function loopbackUrl(connectionString: string): string {
  const url = new URL(connectionString)
  url.hostname = '127.0.0.1'
  return url.toString()
}

it('rejects a wrong database target before writing migration state', async () => {
  const fixture = await isolatedPostgres({ migrate: false })
  try {
    const wrong = new URL(fixture.connectionString)
    wrong.pathname = '/outline'
    const result = spawnSync(process.execPath, ['--import', tsx, entry], {
      cwd: fileURLToPath(new URL('../../apps/server/', import.meta.url)),
      env: { ...process.env, DATABASE_URL: wrong.toString() },
      encoding: 'utf8',
      timeout: 15_000,
    })
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('exre')
    expect(result.stderr).not.toContain(fixture.connectionString)
    const { rows } = await fixture.db.query<{ name: string }>(
      'SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = $1',
      [fixture.schema],
    )
    expect(rows).toEqual([])
  } finally {
    await fixture.close()
  }
}, 30_000)

it.each(['library', 'CLI'] as const)(
  'keeps %s migration writes in the owned schema despite a DSN search_path override',
  async (mode) => {
    const fixture = await isolatedPostgres({ migrate: false })
    const otherSchema = `${fixture.schema}_other`
    const objects = async (schema: string) =>
      (
        await fixture.db.query<{ relname: string }>(
          `SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m','S','f','i','I') ORDER BY c.relname`,
          [schema],
        )
      ).rows
    try {
      await fixture.db.query(`CREATE SCHEMA "${otherSchema}"`)
      const schema = mode === 'library' ? fixture.schema : 'public'
      const journalSchema = mode === 'library' ? fixture.schema : 'drizzle'
      const untouchedSchemas =
        mode === 'library' ? ['public', otherSchema, 'drizzle'] : [fixture.schema, otherSchema]
      const before = await Promise.all(untouchedSchemas.map(objects))
      const overridden = new URL(fixture.connectionString)
      overridden.searchParams.set('options', `-c search_path=${otherSchema}`)
      if (mode === 'library') {
        await runMigrations({
          connectionString: overridden.toString(),
          searchPath: schema,
          migrationsSchema: journalSchema,
        })
      } else {
        const result = spawnSync(process.execPath, ['--import', tsx, entry], {
          cwd: fileURLToPath(new URL('../../apps/server/', import.meta.url)),
          env: { ...process.env, DATABASE_URL: overridden.toString() },
          encoding: 'utf8',
          timeout: 15_000,
        })
        expect(result.error).toBeUndefined()
        expect(result.status).toBe(0)
        expect(result.stderr).not.toContain(fixture.connectionString)
      }
      expect(await Promise.all(untouchedSchemas.map(objects))).toEqual(before)
      const tables = await fixture.db.query<{ name: string }>(
        'SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename',
        [schema],
      )
      expect(tables.rows.map((row) => row.name)).toEqual(
        [
          ...APPLICATION_TABLES,
          ...(schema === journalSchema ? ['__drizzle_migrations'] : []),
        ].sort(),
      )
      if (mode === 'CLI') {
        expect(await objects(journalSchema)).toEqual([
          { relname: '__drizzle_migrations' },
          { relname: '__drizzle_migrations_id_seq' },
          { relname: '__drizzle_migrations_pkey' },
        ])
      }
      expect(
        (
          await fixture.db.query<{ n: number }>(
            `SELECT count(*)::integer AS n FROM "${journalSchema}".__drizzle_migrations`,
          )
        ).rows[0]?.n,
      ).toBeGreaterThan(0)
    } finally {
      await fixture.db.query(`DROP SCHEMA IF EXISTS "${otherSchema}" CASCADE`)
      await fixture.close()
    }
  },
  30_000,
)

it('refuses reset without confirmation or with an unknown schema object, leaving data intact', async () => {
  const fixture = await isolatedPostgres()
  try {
    const options = {
      connectionString: loopbackUrl(fixture.connectionString),
      searchPath: fixture.schema,
    }
    await fixture.db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
      ['user-1', 'keep@example.com', 'Keep', 'hash', 100],
    )
    await expect(resetDatabase(options, '')).rejects.toThrow()
    await fixture.db.query('CREATE TABLE unrelated_data (id integer)')
    await expect(resetDatabase(options, 'exre')).rejects.toThrow()
    expect(
      (await fixture.db.query<{ email: string }>('SELECT email FROM auth_users')).rows,
    ).toEqual([{ email: 'keep@example.com' }])
    expect(
      (
        await fixture.db.query<{ name: string }>(
          'SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = $1 AND tablename = $2',
          [fixture.schema, 'unrelated_data'],
        )
      ).rows,
    ).toEqual([{ name: 'unrelated_data' }])
  } finally {
    await fixture.close()
  }
}, 30_000)

it('refuses an outline URL for reset before any application write', async () => {
  const fixture = await isolatedPostgres()
  try {
    await fixture.db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
      ['user-1', 'keep@example.com', 'Keep', 'hash', 100],
    )
    const wrong = new URL(loopbackUrl(fixture.connectionString))
    wrong.pathname = '/outline'
    await expect(
      resetDatabase({ connectionString: wrong.toString(), searchPath: fixture.schema }, 'exre'),
    ).rejects.toThrow()
    expect(
      (await fixture.db.query<{ email: string }>('SELECT email FROM auth_users')).rows,
    ).toEqual([{ email: 'keep@example.com' }])
  } finally {
    await fixture.close()
  }
}, 30_000)

it.each([
  ['host', 'evil.example'],
  ['port', '1'],
])(
  'refuses a DSN %s override before reset can alter the isolated database',
  async (key, value) => {
    const fixture = await isolatedPostgres()
    try {
      await fixture.db.query(
        'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
        ['user-1', 'keep@example.com', 'Keep', 'hash', 100],
      )
      const journalBefore = (
        await fixture.db.query('SELECT * FROM __drizzle_migrations ORDER BY id')
      ).rows
      const overridden = new URL(loopbackUrl(fixture.connectionString))
      overridden.searchParams.set(key, value)
      await expect(
        resetDatabase(
          { connectionString: overridden.toString(), searchPath: fixture.schema },
          'exre',
        ),
      ).rejects.toMatchObject({ code: 'DATABASE_URL_OPTIONS_INVALID' })
      expect(
        (await fixture.db.query<{ email: string }>('SELECT email FROM auth_users')).rows,
      ).toEqual([{ email: 'keep@example.com' }])
      expect(
        (
          await fixture.db.query<{ n: number }>(
            'SELECT count(*)::integer AS n FROM pg_catalog.pg_tables WHERE schemaname = $1 AND tablename = $2',
            [fixture.schema, '__drizzle_migrations'],
          )
        ).rows,
      ).toEqual([{ n: 1 }])
      expect(
        (await fixture.db.query('SELECT * FROM __drizzle_migrations ORDER BY id')).rows,
      ).toEqual(journalBefore)
    } finally {
      await fixture.close()
    }
  },
  30_000,
)

it('recreates only the isolated application baseline after explicit reset', async () => {
  const fixture = await isolatedPostgres()
  try {
    await fixture.db.query(
      'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
      ['user-1', 'deleted@example.com', 'Deleted', 'hash', 100],
    )
    await resetDatabase(
      { connectionString: loopbackUrl(fixture.connectionString), searchPath: fixture.schema },
      'exre',
    )
    expect((await fixture.db.query('SELECT * FROM auth_users')).rows).toEqual([])
    expect(
      (await fixture.db.query<{ code: string }>('SELECT code FROM community_groups')).rows,
    ).toEqual([{ code: 'admin' }])
  } finally {
    await fixture.close()
  }
}, 30_000)

it('refuses import of the migration CLI before it can alter an isolated schema', async () => {
  const fixture = await isolatedPostgres({ migrate: false })
  try {
    const before = (
      await fixture.db.query<{ name: string }>(
        'SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename',
        ['public'],
      )
    ).rows
    const source = `import ${JSON.stringify(new URL('../../apps/server/src/db/migrate.ts', import.meta.url).href)}`
    const result = spawnSync(
      process.execPath,
      ['--import', tsx, '--input-type=module', '-e', source],
      {
        cwd: fileURLToPath(new URL('../../apps/server/', import.meta.url)),
        env: { ...process.env, DATABASE_URL: fixture.connectionString },
        encoding: 'utf8',
        timeout: 15_000,
      },
    )
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('CLI')
    const after = (
      await fixture.db.query<{ name: string }>(
        'SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename',
        ['public'],
      )
    ).rows
    expect(after).toEqual(before)
  } finally {
    await fixture.close()
  }
}, 30_000)
