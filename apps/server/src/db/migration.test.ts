import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from './client.js'
import { runMigrations } from './migration-runner.js'
import { assertDatabaseReady } from './schema-check.js'
import { assertCommunitySchemaAvailable } from '../domains/community/schema-check.js'

let container: StartedPostgreSqlContainer
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').withDatabase('exre').start()
}, 90_000)
afterAll(async () => {
  await container?.stop()
}, 90_000)

it('applies the PostgreSQL baseline and seeds only the admin community group', async () => {
  const connectionString = container.getConnectionUri()
  const schema = `test_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString })
  await admin.connect()
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    await runMigrations({ connectionString, searchPath: schema, migrationsSchema: schema })
    const db = await openDatabase({ connectionString, searchPath: schema })
    try {
      await expect(assertCommunitySchemaAvailable(db)).resolves.toBeUndefined()
      expect(
        (await db.query<{ code: string }>('SELECT code FROM community_groups ORDER BY code')).rows,
      ).toEqual([{ code: 'admin' }])
      expect((await db.query('SELECT * FROM community_group_memberships')).rows).toEqual([])
    } finally {
      await db.close()
    }
  } finally {
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin.end()
  }
}, 30_000)

const serverRequire = createRequire(new URL('../../package.json', import.meta.url))
const serverEntry = fileURLToPath(new URL('../server.ts', import.meta.url))
const serverCwd = fileURLToPath(new URL('../../', import.meta.url))
const tsx = pathToFileURL(serverRequire.resolve('tsx')).href

async function databaseSnapshot(db: AppDatabase) {
  const [objects, columns, constraints, indexes, indexStates, users, sessions, journal] =
    await Promise.all([
      db.query(`SELECT n.nspname, c.relname, c.relkind FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public','drizzle') AND c.relkind IN ('r','p','v','m','S','f','i','I')
      ORDER BY n.nspname, c.relname`),
      db.query(`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('auth_users','auth_sessions')
      ORDER BY table_name, ordinal_position`),
      db.query(`SELECT t.relname AS table_name,c.conname,pg_catalog.pg_get_constraintdef(c.oid) AS definition
      FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' ORDER BY t.relname,c.conname`),
      db.query(`SELECT tablename,indexname,indexdef FROM pg_catalog.pg_indexes
      WHERE schemaname = 'public' ORDER BY tablename,indexname`),
      db.query(`SELECT t.relname AS table_name,c.relname AS index_name,
        i.indisvalid,i.indisready,i.indislive
      FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
      JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' ORDER BY t.relname,c.relname`),
      db.query('SELECT * FROM public.auth_users ORDER BY id'),
      db.query('SELECT * FROM public.auth_sessions ORDER BY token_hash'),
      db.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id'),
    ])
  return {
    objects: objects.rows,
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
    indexStates: indexStates.rows,
    users: users.rows,
    sessions: sessions.rows,
    journal: journal.rows,
  }
}

const corruptions: Array<[string, string[], string]> = [
  [
    'missing auth password hash',
    ['ALTER TABLE public.auth_users DROP COLUMN password_hash'],
    'auth_users',
  ],
  [
    'wrong session expiry type',
    [
      'ALTER TABLE public.auth_sessions ALTER COLUMN expires_at TYPE integer USING expires_at::integer',
    ],
    'auth_sessions',
  ],
  [
    'same-name wrong unique constraint',
    [
      'ALTER TABLE public.auth_users DROP CONSTRAINT auth_users_email_unique',
      'ALTER TABLE public.auth_users ADD CONSTRAINT auth_users_email_unique UNIQUE (nickname)',
    ],
    'auth_users',
  ],
  [
    'same-name wrong CHECK constraint',
    [
      'ALTER TABLE public.join_applications DROP CONSTRAINT join_applications_review_check',
      'ALTER TABLE public.join_applications ADD CONSTRAINT join_applications_review_check CHECK (true)',
    ],
    'join_applications',
  ],
  [
    'same-name wrong index',
    [
      'DROP INDEX public.join_applications_email_history_idx',
      'CREATE INDEX join_applications_email_history_idx ON public.join_applications (nickname)',
    ],
    'join_applications',
  ],
]
it.each(corruptions)(
  'real server rejects %s without changing schema, data or migration journal',
  async (_case, alterations, table) => {
    const connectionString = container.getConnectionUri()
    let db: AppDatabase | undefined
    try {
      await runMigrations({ connectionString })
      db = await openDatabase({ connectionString })
      await db.query(
        'INSERT INTO auth_users (id,email,nickname,password_hash,created_at) VALUES ($1,$2,$3,$4,$5)',
        ['user-1', 'member@example.com', 'Member', 'hash', 100],
      )
      await db.query(
        'INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES ($1,$2,$3,$4)',
        ['session-1', 'user-1', 100, 1000],
      )
      for (const alteration of alterations) await db.query(alteration)
      const before = await databaseSnapshot(db)
      await expect(assertDatabaseReady(db)).rejects.toThrow(table)
      const result = spawnSync(process.execPath, ['--import', tsx, serverEntry], {
        cwd: serverCwd,
        env: { ...process.env, DATABASE_URL: connectionString, AUTH_CODE_HMAC_KEY: 'a'.repeat(64) },
        encoding: 'utf8',
        timeout: 15_000,
      })
      expect(result.error).toBeUndefined()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('[server]')
      expect(await databaseSnapshot(db)).toEqual(before)
    } finally {
      await db?.close()
      const cleanup = new Client({ connectionString })
      await cleanup.connect()
      try {
        // This container belongs only to this file; restore empty schemas for the next mutation case.
        await cleanup.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
        await cleanup.query('DROP SCHEMA public CASCADE')
        await cleanup.query('CREATE SCHEMA public')
      } finally {
        await cleanup.end()
      }
    }
  },
  40_000,
)

it('real server rejects a same-definition INVALID unique index without writing', async () => {
  const connectionString = container.getConnectionUri()
  let db: AppDatabase | undefined
  try {
    await runMigrations({ connectionString })
    db = await openDatabase({ connectionString })
    await db.query('DROP INDEX public.auth_users_avatar_key_unique')
    await db.query(`INSERT INTO auth_users (id,email,nickname,password_hash,created_at,avatar_key) VALUES
      ('user-1','one@example.com','One','hash',1,'shared-avatar'),
      ('user-2','two@example.com','Two','hash',2,'shared-avatar')`)
    await expect(
      db.query(`CREATE UNIQUE INDEX CONCURRENTLY auth_users_avatar_key_unique
      ON public.auth_users (avatar_key)`),
    ).rejects.toMatchObject({ code: '23505' })
    const before = await databaseSnapshot(db)
    expect(before.indexStates).toContainEqual(
      expect.objectContaining({
        table_name: 'auth_users',
        index_name: 'auth_users_avatar_key_unique',
        indisvalid: false,
      }),
    )
    await expect(assertDatabaseReady(db)).rejects.toThrow()
    const result = spawnSync(process.execPath, ['--import', tsx, serverEntry], {
      cwd: serverCwd,
      env: { ...process.env, DATABASE_URL: connectionString, AUTH_CODE_HMAC_KEY: 'a'.repeat(64) },
      encoding: 'utf8',
      timeout: 15_000,
    })
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('[server]')
    expect(await databaseSnapshot(db)).toEqual(before)
  } finally {
    await db?.close()
    const cleanup = new Client({ connectionString })
    await cleanup.connect()
    try {
      await cleanup.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
      await cleanup.query('DROP SCHEMA public CASCADE')
      await cleanup.query('CREATE SCHEMA public')
    } finally {
      await cleanup.end()
    }
  }
}, 40_000)
