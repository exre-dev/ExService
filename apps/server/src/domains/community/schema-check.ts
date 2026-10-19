import type { SqlExecutor } from '@server/src/db/client.js'

export async function assertCommunitySchemaAvailable(db: SqlExecutor): Promise<void> {
  const required = ['community_groups', 'community_group_memberships']
  const tables = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_catalog.pg_tables
    WHERE schemaname = current_schema() AND tablename = ANY($1::text[])`,
    [required],
  )
  if (tables.rows.length !== required.length)
    throw new Error('社区身份组数据表缺失；请运行 pnpm db:migrate。')
  const groups = await db.query<{ code: string }>(
    "SELECT code FROM community_groups WHERE code IN ('admin', 'general')",
  )
  const available = new Set(groups.rows.map((row) => row.code))
  if (!available.has('admin')) throw new Error('管理员社区身份组缺失；请运行 pnpm db:migrate。')
  if (available.has('general'))
    throw new Error('旧版普通社区身份组仍存在；请运行 pnpm db:migrate。')
}
