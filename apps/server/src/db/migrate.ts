import { assertCliEntry } from '@server/src/db/client.js'
import { runMigrations } from '@server/src/db/migration-runner.js'

assertCliEntry(import.meta.url)

try {
  await runMigrations()
  console.log('[db:migrate] exre migrations applied')
} catch {
  console.error(
    '[db:migrate] 迁移失败；请检查目标 exre 数据库与 schema，确认没有未知对象或不完整迁移。',
  )
  process.exitCode = 1
}
