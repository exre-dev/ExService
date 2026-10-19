import type { SqlExecutor } from '@server/src/db/client.js'

export async function assertProfileSchemaAvailable(db: SqlExecutor): Promise<void> {
  const columns = await db.query<{
    column_name: string
  }>(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'auth_users'`)
  const available = new Set(columns.rows.map((column) => column.column_name))
  if (['qq', 'fivem_id', 'avatar_key'].some((name) => !available.has(name))) {
    throw new Error('用户资料列缺失；请运行 pnpm db:migrate。')
  }
}
