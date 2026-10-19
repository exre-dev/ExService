import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '@server/src/db/client'
import { runMigrations } from '@server/src/db/migration-runner'
import { APPLICATION_TABLES } from '@server/src/db/schema-check'
import {
  parseIntegrationCheckArguments,
  validateWebsiteIntegrationPreflight,
} from '@server/src/integration-readiness'

const serverRoot = fileURLToPath(new URL('../../apps/server/', import.meta.url))
const preflight = {
  AUTH_CODE_HMAC_KEY: 'a'.repeat(64),
  IDENTITY_ENABLED: 'true',
  IDENTITY_MODE: 'local',
  SERVER_PUBLIC_WEB_BASE_URL: 'http://127.0.0.1:8080',
  HYDRA_PUBLIC_URL: 'http://127.0.0.1:4444/',
  HYDRA_ADMIN_URL: 'http://127.0.0.1:4445/',
  IDENTITY_FLOW_KEY: 'd'.repeat(64),
  IDENTITY_BOOTSTRAP_KEY: 'e'.repeat(64),
}

const failure = (code: string) => ({
  code: 1,
  output: expect.stringContaining(`[integration:check] ${code}；检查项：`),
})

async function cli(connectionString: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ code: number; output: string }>((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/cli/integration-check.ts', ...args],
      {
        cwd: serverRoot,
        env: {
          PATH: process.env.PATH ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
          TEMP: process.env.TEMP ?? '',
          TMP: process.env.TMP ?? '',
          ...preflight,
          DATABASE_URL: connectionString,
          ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
    })
    child.once('error', reject)
    child.once('close', (code) => resolveResult({ code: code ?? 1, output: output.trim() }))
  })
}

async function snapshot(db: AppDatabase) {
  const state: Record<string, unknown> = {}
  for (const table of APPLICATION_TABLES) {
    state[table] = (await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows
  }
  state.migrations = (await db.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows
  return state
}

it('validates optional administrator UUID and existing preflight configuration safely', () => {
  expect(parseIntegrationCheckArguments([])).toBeUndefined()
  const id = randomUUID()
  expect(parseIntegrationCheckArguments(['--admin-user-id', id])).toBe(id)
  for (const args of [
    ['--admin-user-id', 'private'],
    ['--repair'],
    ['--admin-user-id', id, '--repair'],
  ]) {
    expect(() => parseIntegrationCheckArguments(args)).toThrow(
      'INTEGRATION_CHECK_ARGUMENTS_INVALID',
    )
  }
  expect(() => validateWebsiteIntegrationPreflight(preflight)).not.toThrow()
  expect(() =>
    validateWebsiteIntegrationPreflight({ ...preflight, AUTH_CODE_HMAC_KEY: 'private' }),
  ).toThrow('INTEGRATION_CHECK_AUTH_KEY_INVALID')
  expect(() =>
    validateWebsiteIntegrationPreflight({ ...preflight, STORAGE_DEFAULT_ADAPTER: 'unknown' }),
  ).toThrow('INTEGRATION_CHECK_STORAGE_INVALID')
  expect(() =>
    validateWebsiteIntegrationPreflight({
      ...preflight,
      SERVER_AVATAR_DIRECTORY: 'relative/private',
    }),
  ).toThrow('INTEGRATION_CHECK_AVATAR_INVALID')
  expect(() =>
    validateWebsiteIntegrationPreflight({
      ...preflight,
      SERVER_PUBLIC_AVATAR_BASE_URL: '%%%private',
    }),
  ).toThrow('INTEGRATION_CHECK_AVATAR_INVALID')
})

it('runs the actual readiness CLI with a read-only role and rejects unsafe targets or incomplete preparation without changing data', async () => {
  // Public schema is required by the real CLI; its database still belongs only
  // to this disposable container, never the developer DATABASE_URL.
  const container = await new PostgreSqlContainer('postgres:16-alpine').withDatabase('exre').start()
  const url = new URL(container.getConnectionUri())
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  let db: AppDatabase | undefined
  try {
    const initial = await cli(url.href)
    expect(initial).toEqual(failure('INTEGRATION_CHECK_SCHEMA_NOT_READY'))
    expect(initial.output).toContain('pnpm db:migrate')
    await runMigrations({ connectionString: url.href })
    db = await openDatabase({ connectionString: url.href })
    const admin = randomUUID(),
      disabled = randomUUID(),
      now = Date.now()
    for (const [id, disabledAt] of [
      [admin, null],
      [disabled, now],
    ] as const) {
      await db.query(
        `INSERT INTO auth_users (id, email, nickname, password_hash, created_at, disabled_at)
        VALUES ($1, $2, 'Readiness', 'private-hash', $3, $4)`,
        [id, `${id}@example.test`, now, disabledAt],
      )
    }
    await db.query(
      `INSERT INTO auth_sessions (id,token_hash,user_id,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), 'f'.repeat(64), admin, now - 1000000, now - 1000],
    )
    // No Website group membership is required for an explicitly designated
    // documents administrator. The inspector only checks existence and active.
    await db.query("CREATE ROLE readiness_reader LOGIN PASSWORD 'test-only-reader'")
    await db.query('GRANT USAGE ON SCHEMA public, drizzle TO readiness_reader')
    await db.query('GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO readiness_reader')
    await db.query('ALTER ROLE readiness_reader SET default_transaction_read_only = on')
    const reader = new URL(url.href)
    reader.username = 'readiness_reader'
    reader.password = 'test-only-reader'
    const before = await snapshot(db)
    for (const args of [[], ['--admin-user-id', admin], ['--admin-user-id', admin]]) {
      expect(await cli(reader.href, args)).toEqual({
        code: 0,
        output: '[integration:check] INTEGRATION_CHECK_READY',
      })
    }
    const configured = new URL(reader.href)
    configured.searchParams.set('sslmode', 'disable')
    configured.searchParams.set('connect_timeout', '3')
    configured.searchParams.set(
      'options',
      '-c statement_timeout=2500 -c search_path=missing_schema',
    )
    expect(await cli(configured.href)).toEqual({
      code: 0,
      output: '[integration:check] INTEGRATION_CHECK_READY',
    })
    const configuredDb = await openDatabase({ connectionString: configured.href })
    try {
      expect(
        (
          await configuredDb.query(
            "SELECT current_schema() AS schema, current_setting('statement_timeout') AS timeout",
          )
        ).rows,
      ).toEqual([{ schema: 'public', timeout: '2500ms' }])
    } finally {
      await configuredDb.close()
    }
    expect(await cli(reader.href, [], { IDENTITY_ENABLED: 'false' })).toEqual({
      code: 0,
      output: '[integration:check] INTEGRATION_CHECK_READY',
    })
    for (const id of [disabled, randomUUID()]) {
      expect(await cli(reader.href, ['--admin-user-id', id])).toEqual(
        failure('INTEGRATION_CHECK_ADMIN_NOT_ACTIVE'),
      )
    }
    expect(await cli(reader.href, ['--admin-user-id', 'private'])).toEqual(
      failure('INTEGRATION_CHECK_ARGUMENTS_INVALID'),
    )
    for (const [values, code] of [
      [{ AUTH_CODE_HMAC_KEY: 'private-key' }, 'INTEGRATION_CHECK_AUTH_KEY_INVALID'],
      [{ STORAGE_DEFAULT_ADAPTER: 'unknown' }, 'INTEGRATION_CHECK_STORAGE_INVALID'],
      [
        { HYDRA_PUBLIC_URL: 'http://identity.exwebsite.test:8090/' },
        'IDENTITY_CONFIG_INVALID:HYDRA_PUBLIC_URL',
      ],
      [{ SERVER_PUBLIC_AVATAR_BASE_URL: '%%%private' }, 'INTEGRATION_CHECK_AVATAR_INVALID'],
    ] as const) {
      const result = await cli(reader.href, [], values)
      expect(result).toEqual(failure(code))
      expect(result.output).toContain('下一步：')
      expect(result.output).not.toContain('private')
    }
    const wrong = new URL(reader.href)
    wrong.pathname = '/outline'
    expect(await cli(wrong.href)).toEqual(failure('INTEGRATION_CHECK_DATABASE_URL_INVALID'))
    const wrongCredentials = new URL(reader.href)
    wrongCredentials.password = 'private-invalid-password'
    const denied = await cli(wrongCredentials.href)
    expect(denied).toEqual(failure('INTEGRATION_CHECK_DATABASE_AUTH_FAILED'))
    expect(denied.output).toContain('DATABASE_USER、DATABASE_PASSWORD')
    expect(denied.output).not.toContain('private-invalid-password')
    expect(await snapshot(db)).toEqual(before)
    await db.query('ALTER TABLE auth_users DROP COLUMN nickname')
    expect(await cli(reader.href)).toEqual(failure('INTEGRATION_CHECK_SCHEMA_NOT_READY'))
    expect(
      (
        await db.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'auth_users' AND column_name = 'nickname'`)
      ).rows,
    ).toEqual([])
  } finally {
    await db?.close()
    await container.stop()
  }
}, 120_000)
