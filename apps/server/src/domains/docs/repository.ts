import type { SqlExecutor } from '@server/src/db/client.js'
import type { DocsContentNode } from './content/validation.js'
import { docsCorrupted } from './errors.js'

const MAX_TREE_DEPTH = 64

export interface DocsSpaceRow {
  id: string
  name: string
  description: string
  version: number
  treeVersion: number
  createdAt: number
  updatedAt: number
  createdByUserId: string
  updatedByUserId: string
}

export interface DocsDocumentRow {
  id: string
  spaceId: string
  parentId: string | null
  position: number
  title: string
  contentSchemaVersion: number
  version: number
  createdAt: number
  updatedAt: number
  createdByUserId: string
  updatedByUserId: string
  deletedAt: number | null
  deletedByUserId: string | null
  deletionBatchId: string | null
  deletionRootId: string | null
}

export interface DocsDocumentContentRow extends DocsDocumentRow {
  content: unknown
  textContent: string
}

/** node-postgres 把 `bigint` 作为字符串返回；Docs 在解码边界显式转成安全整数。 */
function integer(value: unknown, column: string): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(number)) throw new Error(`Docs 数据库整数 ${column} 超出安全范围。`)
  return number
}

function optionalInteger(value: unknown, column: string): number | null {
  return value === null || value === undefined ? null : integer(value, column)
}

export function decodeSpace(row: Record<string, unknown>): DocsSpaceRow {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    version: integer(row.version, 'version'),
    treeVersion: integer(row.tree_version, 'tree_version'),
    createdAt: integer(row.created_at, 'created_at'),
    updatedAt: integer(row.updated_at, 'updated_at'),
    createdByUserId: String(row.created_by_user_id),
    updatedByUserId: String(row.updated_by_user_id),
  }
}

export function decodeDocument(row: Record<string, unknown>): DocsDocumentRow {
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    parentId: row.parent_id === null || row.parent_id === undefined ? null : String(row.parent_id),
    position: integer(row.position, 'position'),
    title: String(row.title),
    contentSchemaVersion: integer(row.content_schema_version, 'content_schema_version'),
    version: integer(row.version, 'version'),
    createdAt: integer(row.created_at, 'created_at'),
    updatedAt: integer(row.updated_at, 'updated_at'),
    createdByUserId: String(row.created_by_user_id),
    updatedByUserId: String(row.updated_by_user_id),
    deletedAt: optionalInteger(row.deleted_at, 'deleted_at'),
    deletedByUserId:
      row.deleted_by_user_id === null || row.deleted_by_user_id === undefined
        ? null
        : String(row.deleted_by_user_id),
    deletionBatchId:
      row.deletion_batch_id === null || row.deletion_batch_id === undefined
        ? null
        : String(row.deletion_batch_id),
    deletionRootId:
      row.deletion_root_id === null || row.deletion_root_id === undefined
        ? null
        : String(row.deletion_root_id),
  }
}

export function decodeDocumentWithContent(row: Record<string, unknown>): DocsDocumentContentRow {
  return { ...decodeDocument(row), content: row.content, textContent: String(row.text_content) }
}

const SPACE_COLUMNS =
  'id, name, description, version, tree_version, created_at, updated_at, created_by_user_id, updated_by_user_id'
export const DOCUMENT_METADATA_COLUMNS = `id, space_id, parent_id, position, title, content_schema_version,
  version, created_at, updated_at, created_by_user_id, updated_by_user_id,
  deleted_at, deleted_by_user_id, deletion_batch_id, deletion_root_id`
const DOCUMENT_CONTENT_COLUMNS = `${DOCUMENT_METADATA_COLUMNS}, content, text_content`

/** 空间行锁：命令显式给出的空间 ID 去重后按 UUID 字节序逐个加锁。 */
export async function lockSpaces(tx: SqlExecutor, spaceIds: readonly string[]): Promise<void> {
  for (const spaceId of spaceIds) {
    const result = await tx.query<{ id: string }>(
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [spaceId],
    )
    if (result.rows.length === 0) return
  }
}

/** 文档行锁：先取得全部候选 ID，再按 UUID 顺序锁定，避免跨命令互锁。 */
export async function lockDocuments(
  tx: SqlExecutor,
  documentIds: readonly string[],
): Promise<void> {
  if (documentIds.length === 0) return
  await tx.query<{ id: string }>(
    'SELECT id FROM docs_documents WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
    [documentIds],
  )
}

export async function findSpace(
  tx: SqlExecutor,
  spaceId: string,
): Promise<DocsSpaceRow | undefined> {
  const result = await tx.query<Record<string, unknown>>(
    `SELECT ${SPACE_COLUMNS} FROM docs_spaces WHERE id = $1`,
    [spaceId],
  )
  return result.rows[0] === undefined ? undefined : decodeSpace(result.rows[0])
}

export async function findDocument(
  tx: SqlExecutor,
  documentId: string,
): Promise<DocsDocumentRow | undefined> {
  const result = await tx.query<Record<string, unknown>>(
    `SELECT ${DOCUMENT_METADATA_COLUMNS} FROM docs_documents WHERE id = $1`,
    [documentId],
  )
  return result.rows[0] === undefined ? undefined : decodeDocument(result.rows[0])
}

export async function findDocumentWithContent(
  tx: SqlExecutor,
  documentId: string,
): Promise<DocsDocumentContentRow | undefined> {
  const result = await tx.query<Record<string, unknown>>(
    `SELECT ${DOCUMENT_CONTENT_COLUMNS} FROM docs_documents WHERE id = $1`,
    [documentId],
  )
  return result.rows[0] === undefined ? undefined : decodeDocumentWithContent(result.rows[0])
}

export async function countSpaceDocuments(tx: SqlExecutor, spaceId: string): Promise<number> {
  const result = await tx.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM docs_documents WHERE space_id = $1',
    [spaceId],
  )
  return Number(result.rows[0]?.count ?? 0)
}

/**
 * 模板也阻止空空间删除。B 类三张表属于 Stage 3，因此这里按 `to_regclass` 显式判断：
 * 表不存在视为零行，表存在后自动参与条件，不需要改调用方。
 */
export async function countSpaceTemplates(tx: SqlExecutor, spaceId: string): Promise<number> {
  // 不能在 SQL 里用 `CASE WHEN to_regclass(...) IS NULL` 守着子查询：
  // PostgreSQL 在解析期就会解析 `FROM docs_templates`，表不存在时直接报 42P01。
  const present = await tx.query<{ present: boolean }>(
    "SELECT to_regclass('docs_templates') IS NOT NULL AS present",
  )
  if (present.rows[0]?.present !== true) return 0
  const result = await tx.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM docs_templates WHERE space_id = $1',
    [spaceId],
  )
  return Number(result.rows[0]?.count ?? 0)
}

/** 活动同级，按服务不变量 `(position, id)` 全序。 */
export async function listActiveSiblings(
  tx: SqlExecutor,
  spaceId: string,
  parentId: string | null,
): Promise<DocsDocumentRow[]> {
  const result =
    parentId === null
      ? await tx.query<Record<string, unknown>>(
          `SELECT ${DOCUMENT_METADATA_COLUMNS} FROM docs_documents
       WHERE space_id = $1 AND parent_id IS NULL AND deleted_at IS NULL
       ORDER BY position, id`,
          [spaceId],
        )
      : await tx.query<Record<string, unknown>>(
          `SELECT ${DOCUMENT_METADATA_COLUMNS} FROM docs_documents
       WHERE space_id = $1 AND parent_id = $2 AND deleted_at IS NULL
       ORDER BY position, id`,
          [spaceId, parentId],
        )
  return result.rows.map(decodeDocument)
}

/** 物理子树：不加 `deleted_at IS NULL` 过滤，回收后代必须一起参与。 */
export async function loadPhysicalSubtree(
  tx: SqlExecutor,
  spaceId: string,
  rootId: string,
): Promise<DocsDocumentRow[]> {
  const result = await tx.query<Record<string, unknown> & { depth: number; is_cycle: boolean }>(
    `WITH RECURSIVE subtree AS (
       SELECT d.id, ARRAY[d.id] AS path, 1 AS depth, false AS is_cycle
       FROM docs_documents d WHERE d.space_id = $1 AND d.id = $2
       UNION ALL
       SELECT child.id, subtree.path || child.id, subtree.depth + 1,
         child.id = ANY(subtree.path) AS is_cycle
       FROM docs_documents child JOIN subtree ON child.parent_id = subtree.id
       WHERE child.space_id = $1 AND subtree.depth < $3 AND NOT subtree.is_cycle
     )
     SELECT ${DOCUMENT_METADATA_COLUMNS.split('\n')
       .join(' ')
       .replace(
         /\b(id|space_id|parent_id|position|title|content_schema_version|version|created_at|updated_at|created_by_user_id|updated_by_user_id|deleted_at|deleted_by_user_id|deletion_batch_id|deletion_root_id)\b/g,
         'd.$1',
       )}, subtree.depth, subtree.is_cycle
     FROM docs_documents d JOIN subtree ON d.id = subtree.id`,
    [spaceId, rootId, MAX_TREE_DEPTH + 1],
  )
  if (result.rows.some((row) => row.is_cycle || row.depth > MAX_TREE_DEPTH)) throw docsCorrupted()
  return result.rows.map(decodeDocument)
}

/**
 * 物理祖先链，从直接父节点到空间根，按深度升序。
 * 不加 `deleted_at IS NULL` 过滤：调用方必须自己核验活动性并安全失败，
 * 不能因为按 ID 查询绕过树导航就暴露留在回收祖先下面的活动行。
 */
export async function loadPhysicalAncestors(
  tx: SqlExecutor,
  documentId: string,
): Promise<DocsDocumentRow[]> {
  const result = await tx.query<Record<string, unknown> & { depth: number; is_cycle: boolean }>(
    `WITH RECURSIVE chain AS (
       SELECT d.parent_id AS id, ARRAY[d.id, d.parent_id] AS path, 1 AS depth,
         d.parent_id = d.id AS is_cycle
       FROM docs_documents d WHERE d.id = $1 AND d.parent_id IS NOT NULL
       UNION ALL
       SELECT parent.parent_id, chain.path || parent.parent_id, chain.depth + 1,
         parent.parent_id = ANY(chain.path) AS is_cycle
       FROM docs_documents parent JOIN chain ON parent.id = chain.id
       WHERE chain.depth < $2 AND NOT chain.is_cycle AND parent.parent_id IS NOT NULL
     )
     SELECT ${DOCUMENT_METADATA_COLUMNS.split('\n')
       .join(' ')
       .replace(
         /\b(id|space_id|parent_id|position|title|content_schema_version|version|created_at|updated_at|created_by_user_id|updated_by_user_id|deleted_at|deleted_by_user_id|deletion_batch_id|deletion_root_id)\b/g,
         'd.$1',
       )}, chain.depth, chain.is_cycle
     FROM docs_documents d JOIN chain ON d.id = chain.id
     ORDER BY chain.depth`,
    [documentId, MAX_TREE_DEPTH],
  )
  if (result.rows.some((row) => row.is_cycle || row.depth >= MAX_TREE_DEPTH)) throw docsCorrupted()
  return result.rows.map(decodeDocument)
}

export async function hasActiveChildren(
  tx: SqlExecutor,
  documentIds: readonly string[],
): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set()
  const result = await tx.query<{ parent_id: string }>(
    'SELECT DISTINCT parent_id FROM docs_documents WHERE parent_id = ANY($1::uuid[]) AND deleted_at IS NULL',
    [documentIds],
  )
  return new Set(result.rows.map((row) => row.parent_id))
}

export async function setPosition(
  tx: SqlExecutor,
  documentId: string,
  position: number,
): Promise<void> {
  await tx.query('UPDATE docs_documents SET position = $2 WHERE id = $1', [documentId, position])
}

export async function insertSpace(
  tx: SqlExecutor,
  space: { id: string; name: string; description: string; at: number; actorId: string },
): Promise<void> {
  await tx.query(
    `INSERT INTO docs_spaces (id, name, description, version, tree_version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, $3, 1, 1, $4, $4, $5, $5)`,
    [space.id, space.name, space.description, space.at, space.actorId],
  )
}

export async function insertDocument(
  tx: SqlExecutor,
  document: {
    id: string
    spaceId: string
    parentId: string | null
    position: number
    title: string
    content: DocsContentNode
    textContent: string
    at: number
    actorId: string
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO docs_documents (id, space_id, parent_id, position, title, content_schema_version, content, text_content,
      version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, $3, $4, $5, 1, $6::jsonb, $7, 1, $8, $8, $9, $9)`,
    [
      document.id,
      document.spaceId,
      document.parentId,
      document.position,
      document.title,
      JSON.stringify(document.content),
      document.textContent,
      document.at,
      document.actorId,
    ],
  )
}

export async function saveDocumentContent(
  tx: SqlExecutor,
  document: {
    id: string
    title: string
    content: DocsContentNode
    textContent: string
    at: number
    actorId: string
  },
): Promise<void> {
  await tx.query(
    `UPDATE docs_documents SET title = $2, content = $3::jsonb, text_content = $4,
      version = version + 1, updated_at = $5, updated_by_user_id = $6 WHERE id = $1`,
    [
      document.id,
      document.title,
      JSON.stringify(document.content),
      document.textContent,
      document.at,
      document.actorId,
    ],
  )
}

export async function markTrashed(
  tx: SqlExecutor,
  documentIds: readonly string[],
  deletion: { batchId: string; rootId: string; at: number; actorId: string },
): Promise<void> {
  // 本次新回收的行版本各递增一次，使回收后的重放请求得到 409 而不是覆盖。
  await tx.query(
    `UPDATE docs_documents SET deleted_at = $2, deleted_by_user_id = $3, deletion_batch_id = $4, deletion_root_id = $5,
      version = version + 1, updated_at = $2, updated_by_user_id = $3
     WHERE id = ANY($1::uuid[])`,
    [documentIds, deletion.at, deletion.actorId, deletion.batchId, deletion.rootId],
  )
}

export async function clearTrashed(
  tx: SqlExecutor,
  documentIds: readonly string[],
  restore: { at: number; actorId: string },
): Promise<void> {
  // 恢复的行版本同样递增一次，命令语义统一，也阻止旧恢复请求重放。
  await tx.query(
    `UPDATE docs_documents SET deleted_at = NULL, deleted_by_user_id = NULL, deletion_batch_id = NULL, deletion_root_id = NULL,
      version = version + 1, updated_at = $2, updated_by_user_id = $3
     WHERE id = ANY($1::uuid[])`,
    [documentIds, restore.at, restore.actorId],
  )
}

export async function setDocumentPlacement(
  tx: SqlExecutor,
  documentId: string,
  placement: { spaceId: string; parentId: string | null },
): Promise<void> {
  await tx.query('UPDATE docs_documents SET space_id = $2, parent_id = $3 WHERE id = $1', [
    documentId,
    placement.spaceId,
    placement.parentId,
  ])
}

export async function updateSpaceRow(
  tx: SqlExecutor,
  space: { id: string; name: string; description: string; at: number; actorId: string },
): Promise<void> {
  await tx.query(
    `UPDATE docs_spaces SET name = $2, description = $3, version = version + 1, updated_at = $4, updated_by_user_id = $5
     WHERE id = $1`,
    [space.id, space.name, space.description, space.at, space.actorId],
  )
}

export async function deleteSpaceRow(tx: SqlExecutor, spaceId: string): Promise<void> {
  await tx.query('DELETE FROM docs_spaces WHERE id = $1', [spaceId])
}
