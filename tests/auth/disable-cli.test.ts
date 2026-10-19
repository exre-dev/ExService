import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { expect, it } from 'vitest'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { openDatabase } from '@server/src/db/client'
import { runMigrations } from '@server/src/db/migration-runner'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/server')

async function runCommand(
  script: 'auth-disable.ts' | 'auth-enable.ts',
  connectionString: string,
  userId: string,
) {
  return new Promise<number>((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', `src/cli/${script}`, '--user-id', userId],
      {
        cwd: serverRoot,
        env: {
          PATH: process.env.PATH ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
          TEMP: process.env.TEMP ?? '',
          TMP: process.env.TMP ?? '',
          DATABASE_URL: connectionString,
        },
        stdio: 'ignore',
      },
    )
    child.once('error', reject)
    child.once('exit', (code) => resolveResult(code ?? 1))
  })
}

it('runs account disable and enable only against a verified independent exre database', async () => {
  const container = await new PostgreSqlContainer('postgres:16-alpine').withDatabase('exre').start()
  const url = new URL(container.getConnectionUri())
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1'
  const connectionString = url.href
  let db: Awaited<ReturnType<typeof openDatabase>> | undefined
  try {
    await runMigrations({ connectionString })
    db = await openDatabase({ connectionString })
    const userId = randomUUID(),
      sessionId = randomUUID(),
      now = Date.now()
    await db.query(
      `INSERT INTO auth_users (id,email,nickname,password_hash,created_at)
      VALUES ($1,$2,$3,$4,$5)`,
      [userId, 'cli-disable@example.test', 'CLI', 'test-only', now],
    )
    await db.query(
      `INSERT INTO auth_sessions (id,token_hash,user_id,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5)`,
      [sessionId, 'a'.repeat(64), userId, now, now + 60_000],
    )
    const wrongDatabase = new URL(connectionString)
    wrongDatabase.pathname = '/outline'
    expect(await runCommand('auth-disable.ts', wrongDatabase.href, userId)).not.toBe(0)
    expect(
      (
        await db.query<{ disabled_at: number | null }>(
          'SELECT disabled_at FROM auth_users WHERE id = $1',
          [userId],
        )
      ).rows[0]?.disabled_at,
    ).toBeNull()
    expect(await runCommand('auth-disable.ts', connectionString, userId)).toBe(0)
    const disabled = (
      await db.query<{ disabled_at: number | null }>(
        'SELECT disabled_at FROM auth_users WHERE id = $1',
        [userId],
      )
    ).rows[0]
    expect(disabled?.disabled_at).not.toBeNull()
    expect(await runCommand('auth-enable.ts', connectionString, userId)).toBe(0)
    const state = (
      await db.query<{ disabled_at: number | null; revoked_at: number | null }>(
        `SELECT u.disabled_at, s.revoked_at FROM auth_users u JOIN auth_sessions s ON s.user_id = u.id
       WHERE u.id = $1`,
        [userId],
      )
    ).rows[0]
    expect(state?.disabled_at).toBeNull()
    expect(state?.revoked_at).not.toBeNull()
  } finally {
    await db?.close()
    await container.stop()
  }
})
