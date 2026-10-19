import { randomUUID } from 'node:crypto'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'
import { afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { openDatabase, type AppDatabase } from '@server/src/db/client'
import { runMigrations } from '@server/src/db/migration-runner'

let containerPromise: Promise<StartedPostgreSqlContainer> | undefined

async function testContainer(): Promise<StartedPostgreSqlContainer> {
  const images = JSON.parse(
    readFileSync(new URL('../../infra/runtime/images.lock.json', import.meta.url), 'utf8'),
  ) as { postgres: string }
  containerPromise ??= new PostgreSqlContainer(images.postgres).withDatabase('exre').start()
  return containerPromise
}

export async function isolatedPostgres(options: { migrate?: boolean } = {}): Promise<{
  db: AppDatabase
  connectionString: string
  schema: string
  close(): Promise<void>
}> {
  // The URL is obtained only from this newly started container. Never read DATABASE_URL here.
  const container = await testContainer()
  const containerUrl = new URL(container.getConnectionUri())
  if (containerUrl.hostname === 'localhost') containerUrl.hostname = '127.0.0.1'
  const connectionString = containerUrl.href
  const schema = `test_${randomUUID().replaceAll('-', '')}`
  const admin = new Client({ connectionString })
  await admin.connect()
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
  } finally {
    await admin.end()
  }
  let db: AppDatabase | undefined
  try {
    if (options.migrate !== false)
      await runMigrations({ connectionString, searchPath: schema, migrationsSchema: schema })
    db = await openDatabase({ connectionString, searchPath: schema })
  } catch (error) {
    await db?.close()
    const cleanup = new Client({ connectionString })
    await cleanup.connect()
    try {
      await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`)
    } finally {
      await cleanup.end()
    }
    throw error
  }
  if (!db) throw new Error('Test database did not open')
  const ready = db
  return {
    db: ready,
    connectionString,
    schema,
    async close() {
      await ready.close()
      const cleanup = new Client({ connectionString })
      await cleanup.connect()
      try {
        await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`)
      } finally {
        await cleanup.end()
      }
    },
  }
}

export async function stopTestPostgres(): Promise<void> {
  const started = containerPromise
  containerPromise = undefined
  if (started) await (await started).stop()
}

if (process.env.EXWEBSITE_PROOF_SERVER_CHILD !== '1') afterAll(stopTestPostgres)
