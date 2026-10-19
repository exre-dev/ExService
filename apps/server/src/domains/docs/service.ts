import { randomUUID } from 'node:crypto'
import type { AppDatabase, SqlExecutor } from '@server/src/db/client.js'
import { DocsError, docsBadRequest, docsBusy, docsCorrupted, docsNotImplemented } from './errors.js'
import {
  assertStoredDocsContent,
  validateDocsContent,
  type DocsContentNode,
  type DocsDocument,
} from './content/validation.js'
import {
  clearTrashed,
  countSpaceDocuments,
  countSpaceTemplates,
  decodeDocument,
  decodeSpace,
  deleteSpaceRow,
  findDocument,
  findDocumentWithContent,
  findSpace,
  hasActiveChildren,
  insertDocument,
  insertSpace,
  listActiveSiblings,
  loadPhysicalAncestors,
  loadPhysicalSubtree,
  lockDocuments,
  lockSpaces,
  markTrashed,
  saveDocumentContent,
  setDocumentPlacement,
  updateSpaceRow,
  DOCUMENT_METADATA_COLUMNS,
  type DocsDocumentContentRow,
  type DocsDocumentRow,
  type DocsSpaceRow,
} from './repository.js'

export const DOCS_LIMITS = {
  /** 每空间物理文档行上限，包含回收内容。 */
  documentsPerSpace: 10_000,
  /** 物理树最大层数，根文档为第 1 层。 */
  treeDepth: 64,
  defaultPageLimit: 100,
  maxPageLimit: 200,
} as const

export interface CommandTimeouts {
  lockTimeoutMs: number
  statementTimeoutMs: number
}

export type TimeoutCategory = 'metadata' | 'content' | 'tree'

const DEFAULT_TIMEOUTS: Readonly<Record<TimeoutCategory, CommandTimeouts>> = Object.freeze({
  metadata: Object.freeze({ lockTimeoutMs: 5_000, statementTimeoutMs: 10_000 }),
  content: Object.freeze({ lockTimeoutMs: 5_000, statementTimeoutMs: 10_000 }),
  tree: Object.freeze({ lockTimeoutMs: 5_000, statementTimeoutMs: 10_000 }),
})

export interface DocsServiceOptions {
  db: AppDatabase
  timeouts?: Readonly<Record<TimeoutCategory, CommandTimeouts>>
  now?: () => number
  createId?: () => string
}

export interface DocsSpaceView {
  id: string
  name: string
  description: string
  version: number
  treeVersion: number
  createdAt: number
  updatedAt: number
}

export interface DocsTreeNodeView {
  id: string
  spaceId: string
  parentId: string | null
  title: string
  position: number
  version: number
  hasChildren: boolean
}

export interface DocsDocumentView extends DocsTreeNodeView {
  contentSchemaVersion: 1
  content: DocsDocument
  createdAt: number
  updatedAt: number
}

export interface PageQuery {
  limit?: number
  cursor?: string
}

export interface TreeQuery extends PageQuery {
  parentId?: string
}

export interface DocsTrashGroupView {
  documentId: string
  spaceId: string
  parentId: string | null
  title: string
  version: number
  deletionBatchId: string
  deletedAt: number
  documentCount: number
}

const SPACE_COLUMNS =
  'id, name, description, version, tree_version, created_at, updated_at, created_by_user_id, updated_by_user_id'
/** 空间写锁顺序：去重后按 UUID 字节序逐个加锁，跨空间命令不会互锁。 */
function orderedSpaceIds(...ids: readonly (string | null | undefined)[]): string[] {
  const unique = new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))
  return [...unique].sort()
}

function mapDatabaseError(error: unknown): unknown {
  const code = (error as { code?: unknown } | null | undefined)?.code
  // 55P03 锁不可用/锁期限、57014 受控查询取消/语句期限、40P01 死锁、40001 序列化中止。
  // 事务边界已经回滚；调用方仍需重读后决定是否重试，不自动重放旧写入。
  if (code === '55P03' || code === '57014' || code === '40P01' || code === '40001')
    return docsBusy()
  return error
}

function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw docsBadRequest()
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof DocsError) throw error
    throw docsBadRequest()
  }
}

function cursorInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw docsBadRequest()
  return value
}

function cursorString(value: unknown): string {
  if (typeof value !== 'string') throw docsBadRequest()
  return value
}

function clampLimit(value: number | null | undefined): number {
  if (value === null || value === undefined) return DOCS_LIMITS.defaultPageLimit
  if (!Number.isSafeInteger(value)) return DOCS_LIMITS.defaultPageLimit
  return Math.min(Math.max(value, 1), DOCS_LIMITS.maxPageLimit)
}

function normalizeName(value: string, max: number): string {
  const trimmed = value.trim()
  const length = [...trimmed].length
  if (length === 0 || length > max) throw new DocsError('DOCS_INVALID_CONTENT')
  return trimmed
}

function requireVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new DocsError('DOCS_VERSION_CONFLICT')
  return value
}

function spaceView(row: DocsSpaceRow): DocsSpaceView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    treeVersion: row.treeVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function treeNodeView(row: DocsDocumentRow, hasChildren: boolean): DocsTreeNodeView {
  return {
    id: row.id,
    spaceId: row.spaceId,
    parentId: row.parentId,
    title: row.title,
    position: row.position,
    version: row.version,
    hasChildren,
  }
}

function documentView(row: DocsDocumentContentRow, hasChildren: boolean): DocsDocumentView {
  return {
    ...treeNodeView(row, hasChildren),
    contentSchemaVersion: 1,
    content: row.content as DocsDocument,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function assertStoredContent(row: DocsDocumentContentRow): void {
  if (row.contentSchemaVersion !== 1) throw docsCorrupted()
  try {
    assertStoredDocsContent(row.content)
  } catch (error) {
    if (error instanceof DocsError) throw docsCorrupted()
    throw error
  }
}

/** 按物理父子关系计算子树高度；用于移动后的深度门禁。 */
function subtreeHeight(rows: readonly DocsDocumentRow[], rootId: string): number {
  const children = new Map<string | null, string[]>()
  for (const row of rows) {
    const list = children.get(row.parentId) ?? []
    list.push(row.id)
    children.set(row.parentId, list)
  }
  const walk = (id: string): number => {
    const kids = children.get(id) ?? []
    let deepest = 1
    for (const kid of kids) deepest = Math.max(deepest, walk(kid) + 1)
    return deepest
  }
  return walk(rootId)
}

export class DocsService {
  private readonly db: AppDatabase
  private readonly timeouts: Readonly<Record<TimeoutCategory, CommandTimeouts>>
  private readonly now: () => number
  private readonly createId: () => string

  constructor(options: DocsServiceOptions) {
    this.db = options.db
    this.timeouts = freezeTimeouts(options.timeouts ?? DEFAULT_TIMEOUTS)
    this.now = options.now ?? (() => Date.now())
    this.createId = options.createId ?? randomUUID
  }

  private async command<T>(
    category: TimeoutCategory,
    run: (tx: SqlExecutor) => Promise<T>,
  ): Promise<T> {
    const timeouts = this.timeouts[category]
    try {
      return await this.db.transaction(async (tx) => {
        await tx.query(`SET LOCAL lock_timeout = ${timeouts.lockTimeoutMs}`)
        await tx.query(`SET LOCAL statement_timeout = ${timeouts.statementTimeoutMs}`)
        return run(tx)
      })
    } catch (error) {
      throw mapDatabaseError(error)
    }
  }

  /** 树与回收读取必须在一次只读一致快照中形成结果与树版本。 */
  private async snapshot<T>(
    category: TimeoutCategory,
    run: (tx: SqlExecutor) => Promise<T>,
  ): Promise<T> {
    const timeouts = this.timeouts[category]
    try {
      return await this.db.transaction(async (tx) => {
        await tx.query(`SET LOCAL lock_timeout = ${timeouts.lockTimeoutMs}`)
        await tx.query(`SET LOCAL statement_timeout = ${timeouts.statementTimeoutMs}`)
        return run(tx)
      }, 'repeatable-read-read-only')
    } catch (error) {
      throw mapDatabaseError(error)
    }
  }

  // ---------------------------------------------------------------- 空间

  async listSpaces(
    query: PageQuery,
  ): Promise<{ items: DocsSpaceView[]; nextCursor: string | null }> {
    const limit = clampLimit(query.limit)
    return this.snapshot('metadata', async (tx) => {
      let rows: Record<string, unknown>[]
      if (query.cursor === undefined) {
        const result = await tx.query<Record<string, unknown>>(
          `SELECT ${SPACE_COLUMNS} FROM docs_spaces ORDER BY created_at, id LIMIT $1`,
          [limit + 1],
        )
        rows = result.rows
      } else {
        const cursor = decodeCursor(query.cursor)
        if (cursor.kind !== 'docs-space') throw docsBadRequest()
        const result = await tx.query<Record<string, unknown>>(
          `SELECT ${SPACE_COLUMNS} FROM docs_spaces WHERE (created_at, id) > ($1, $2) ORDER BY created_at, id LIMIT $3`,
          [cursorInteger(cursor.createdAt), cursorString(cursor.id), limit + 1],
        )
        rows = result.rows
      }
      const items = rows.map((row) => spaceView(decodeSpace(row)))
      const page = items.slice(0, limit)
      const last = page[page.length - 1]
      return {
        items: page,
        nextCursor:
          items.length > limit && last !== undefined
            ? encodeCursor({ kind: 'docs-space', createdAt: last.createdAt, id: last.id })
            : null,
      }
    })
  }

  async createSpace(
    input: { name: string; description: string },
    actorId: string,
  ): Promise<DocsSpaceView> {
    const name = normalizeName(input.name, 100)
    const description = normalizeDescription(input.description, 2000)
    const id = this.createId()
    const at = this.now()
    await this.command('metadata', async (tx) => {
      await insertSpace(tx, { id, name, description, at, actorId })
    })
    return { id, name, description, version: 1, treeVersion: 1, createdAt: at, updatedAt: at }
  }

  async getSpace(spaceId: string): Promise<DocsSpaceView> {
    return this.snapshot('metadata', async (tx) => {
      const space = await findSpace(tx, spaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      return spaceView(space)
    })
  }

  async updateSpace(
    spaceId: string,
    input: { expectedVersion: number; name: string; description: string },
    actorId: string,
  ): Promise<DocsSpaceView> {
    const name = normalizeName(input.name, 100)
    const description = normalizeDescription(input.description, 2000)
    const expectedVersion = requireVersion(input.expectedVersion)
    return this.command('metadata', async (tx) => {
      await lockSpaces(tx, [spaceId])
      const space = await findSpace(tx, spaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      if (space.version !== expectedVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      const at = this.now()
      await updateSpaceRow(tx, { id: spaceId, name, description, at, actorId })
      return { ...spaceView(space), name, description, version: space.version + 1, updatedAt: at }
    })
  }

  /** 只删除真正空空间：任何文档行（含已回收）或模板行都使删除失败。 */
  async deleteSpace(
    spaceId: string,
    input: { expectedVersion: number; expectedTreeVersion: number },
  ): Promise<void> {
    const expectedVersion = requireVersion(input.expectedVersion)
    const expectedTreeVersion = requireVersion(input.expectedTreeVersion)
    await this.command('metadata', async (tx) => {
      await lockSpaces(tx, [spaceId])
      const space = await findSpace(tx, spaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      if (space.version !== expectedVersion || space.treeVersion !== expectedTreeVersion)
        throw new DocsError('DOCS_VERSION_CONFLICT')
      const documents = await countSpaceDocuments(tx, spaceId)
      const templates = await countSpaceTemplates(tx, spaceId)
      if (documents > 0 || templates > 0) throw new DocsError('DOCS_SPACE_NOT_EMPTY')
      await deleteSpaceRow(tx, spaceId)
    })
  }

  // ---------------------------------------------------------------- 树与文档读取

  async getTree(
    spaceId: string,
    query: TreeQuery,
  ): Promise<{ items: DocsTreeNodeView[]; treeVersion: number; nextCursor: string | null }> {
    const limit = clampLimit(query.limit)
    const parentId = query.parentId ?? null
    return this.snapshot('tree', async (tx) => {
      const space = await findSpace(tx, spaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      if (parentId !== null) {
        const parent = await findDocument(tx, parentId)
        if (parent === undefined || parent.spaceId !== spaceId || parent.deletedAt !== null)
          throw new DocsError('DOCS_NOT_FOUND')
      }
      let after: { position: number; id: string } | undefined
      if (query.cursor !== undefined) {
        const cursor = decodeCursor(query.cursor)
        if (cursor.kind !== 'docs-tree' || cursorString(cursor.spaceId) !== spaceId)
          throw docsBadRequest()
        if (cursor.parentId !== parentId) throw docsBadRequest()
        if (cursorInteger(cursor.treeVersion) !== space.treeVersion)
          throw new DocsError('DOCS_TREE_CHANGED')
        after = { position: cursorInteger(cursor.position), id: cursorString(cursor.id) }
      }
      const result =
        after === undefined
          ? await tx.query<Record<string, unknown>>(
              `SELECT ${DOCUMENT_METADATA_COLUMNS} FROM docs_documents
           WHERE space_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL
           ORDER BY position, id LIMIT $3`,
              [spaceId, parentId, limit + 1],
            )
          : await tx.query<Record<string, unknown>>(
              `SELECT ${DOCUMENT_METADATA_COLUMNS} FROM docs_documents
           WHERE space_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND deleted_at IS NULL
             AND (position, id) > ($3, $4)
           ORDER BY position, id LIMIT $5`,
              [spaceId, parentId, after.position, after.id, limit + 1],
            )
      const rows = result.rows.map(decodeDocument)
      const page = rows.slice(0, limit)
      const children = await hasActiveChildren(
        tx,
        page.map((row) => row.id),
      )
      const last = page[page.length - 1]
      return {
        items: page.map((row) => treeNodeView(row, children.has(row.id))),
        treeVersion: space.treeVersion,
        nextCursor:
          rows.length > limit && last !== undefined
            ? encodeCursor({
                kind: 'docs-tree',
                spaceId,
                parentId,
                treeVersion: space.treeVersion,
                position: last.position,
                id: last.id,
              })
            : null,
      }
    })
  }

  async getDocument(
    documentId: string,
  ): Promise<{ document: DocsDocumentView; treeVersion: number }> {
    return this.snapshot('content', async (tx) => {
      const row = await findDocumentWithContent(tx, documentId)
      if (row === undefined || row.deletedAt !== null) throw new DocsError('DOCS_NOT_FOUND')
      await this.assertReadable(tx, row)
      const space = await findSpace(tx, row.spaceId)
      if (space === undefined) throw docsCorrupted()
      return {
        document: documentView(row, (await hasActiveChildren(tx, [row.id])).has(row.id)),
        treeVersion: space.treeVersion,
      }
    })
  }

  async getTrashedDocument(documentId: string): Promise<{
    document: DocsDocumentView
    treeVersion: number
    deletion: { batchId: string; rootId: string; deletedAt: number }
  }> {
    return this.snapshot('content', async (tx) => {
      const row = await findDocumentWithContent(tx, documentId)
      if (
        row === undefined ||
        row.deletedAt === null ||
        row.deletionBatchId === null ||
        row.deletionRootId === null
      ) {
        throw new DocsError('DOCS_NOT_FOUND')
      }
      assertStoredContent(row)
      const space = await findSpace(tx, row.spaceId)
      if (space === undefined) throw docsCorrupted()
      return {
        document: documentView(row, (await hasActiveChildren(tx, [row.id])).has(row.id)),
        treeVersion: space.treeVersion,
        deletion: {
          batchId: row.deletionBatchId,
          rootId: row.deletionRootId,
          deletedAt: row.deletedAt,
        },
      }
    })
  }

  // ---------------------------------------------------------------- 写入

  async createDocument(
    spaceId: string,
    input: {
      expectedTreeVersion: number
      parentId: string | null
      beforeDocumentId: string | null
      title: string
      content: DocsContentNode
    },
    actorId: string,
  ): Promise<{ document: DocsDocumentView; treeVersion: number }> {
    const normalized = validateDocsContent(input.content)
    const title = normalizeName(input.title, 200)
    const expectedTreeVersion = requireVersion(input.expectedTreeVersion)
    const id = this.createId()
    return this.command('tree', async (tx) => {
      await lockSpaces(tx, [spaceId])
      const space = await findSpace(tx, spaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      if (space.treeVersion !== expectedTreeVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      const parent =
        input.parentId === null
          ? null
          : await this.requireActiveParent(tx, spaceId, input.parentId, null)
      const depth = parent === null ? 1 : (await loadPhysicalAncestors(tx, parent.id)).length + 2
      if (depth > DOCS_LIMITS.treeDepth) throw new DocsError('DOCS_LIMIT_EXCEEDED')
      const count = await countSpaceDocuments(tx, spaceId)
      if (count + 1 > DOCS_LIMITS.documentsPerSpace) throw new DocsError('DOCS_LIMIT_EXCEEDED')
      const siblings = await listActiveSiblings(tx, spaceId, input.parentId)
      await lockDocuments(
        tx,
        siblings.map((row) => row.id),
      )
      const index = this.anchorIndex(siblings, input.beforeDocumentId)
      const at = this.now()
      await insertDocument(tx, {
        id,
        spaceId,
        parentId: input.parentId,
        position: index,
        title,
        content: normalized.content,
        textContent: normalized.textContent,
        at,
        actorId,
      })
      const affected = new Set<string>([id])
      const ordered = siblings.slice()
      ordered.splice(index, 0, { ...siblings[0], id, position: index } as DocsDocumentRow)
      await this.rewritePositions(tx, ordered, at, actorId, affected)
      const treeVersion = await this.bumpTreeVersion(tx, spaceId)
      const created = await findDocumentWithContent(tx, id)
      if (created === undefined) throw docsCorrupted()
      return { document: documentView(created, false), treeVersion }
    })
  }

  async saveDocument(
    documentId: string,
    input: {
      expectedSpaceId: string
      expectedVersion: number
      title: string
      content: DocsContentNode
    },
    actorId: string,
  ): Promise<{ document: DocsDocumentView; treeVersion: number }> {
    const normalized = validateDocsContent(input.content)
    const title = normalizeName(input.title, 200)
    const expectedVersion = requireVersion(input.expectedVersion)
    return this.command('content', async (tx) => {
      await lockSpaces(tx, [input.expectedSpaceId])
      const space = await findSpace(tx, input.expectedSpaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      const row = await findDocument(tx, documentId)
      if (row === undefined || row.spaceId !== input.expectedSpaceId)
        throw new DocsError('DOCS_NOT_FOUND')
      await lockDocuments(tx, [documentId])
      const locked = await findDocument(tx, documentId)
      if (locked === undefined) throw new DocsError('DOCS_NOT_FOUND')
      if (locked.deletedAt !== null) throw new DocsError('DOCS_ALREADY_TRASHED')
      if (locked.version !== expectedVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      const at = this.now()
      await saveDocumentContent(tx, {
        id: documentId,
        title,
        content: normalized.content,
        textContent: normalized.textContent,
        at,
        actorId,
      })
      const treeVersion = await this.bumpTreeVersion(tx, locked.spaceId)
      const saved = await findDocumentWithContent(tx, documentId)
      if (saved === undefined) throw docsCorrupted()
      return {
        document: documentView(saved, (await hasActiveChildren(tx, [documentId])).has(documentId)),
        treeVersion,
      }
    })
  }

  async moveDocument(
    documentId: string,
    input: {
      sourceSpaceId: string
      targetSpaceId: string
      expectedVersion: number
      expectedSourceTreeVersion: number
      expectedTargetTreeVersion: number
      parentId: string | null
      beforeDocumentId: string | null
    },
    actorId: string,
  ): Promise<{
    documentId: string
    version: number
    source: { spaceId: string; treeVersion: number }
    target: { spaceId: string; treeVersion: number }
    affectedCount: number
  }> {
    const expectedVersion = requireVersion(input.expectedVersion)
    const expectedSource = requireVersion(input.expectedSourceTreeVersion)
    const expectedTarget = requireVersion(input.expectedTargetTreeVersion)
    const crossSpace = input.sourceSpaceId !== input.targetSpaceId
    return this.command('tree', async (tx) => {
      await lockSpaces(tx, orderedSpaceIds(input.sourceSpaceId, input.targetSpaceId))
      const sourceSpace = await this.requireSpace(tx, input.sourceSpaceId)
      const targetSpace = await this.requireSpace(tx, input.targetSpaceId)
      if (
        sourceSpace.treeVersion !== expectedSource ||
        targetSpace.treeVersion !== expectedTarget
      ) {
        throw new DocsError('DOCS_VERSION_CONFLICT')
      }
      if (!crossSpace && expectedSource !== expectedTarget)
        throw new DocsError('DOCS_VERSION_CONFLICT')

      const root = await findDocument(tx, documentId)
      if (root === undefined || root.spaceId !== input.sourceSpaceId)
        throw new DocsError('DOCS_NOT_FOUND')
      if (root.deletedAt !== null) throw new DocsError('DOCS_ALREADY_TRASHED')
      if (root.version !== expectedVersion) throw new DocsError('DOCS_VERSION_CONFLICT')

      const subtree = await loadPhysicalSubtree(tx, root.spaceId, root.id)
      const subtreeIds = subtree.map((row) => row.id)
      const parent =
        input.parentId === null
          ? null
          : await this.requireActiveParent(
              tx,
              input.targetSpaceId,
              input.parentId,
              root.id,
              subtreeIds,
            )
      const ancestors = parent === null ? [] : await loadPhysicalAncestors(tx, parent.id)
      if (ancestors.some((ancestor) => subtreeIds.includes(ancestor.id)))
        throw new DocsError('DOCS_INVALID_MOVE')
      if (ancestors.length + 1 + subtreeHeight(subtree, root.id) > DOCS_LIMITS.treeDepth)
        throw new DocsError('DOCS_LIMIT_EXCEEDED')

      if (crossSpace) {
        const targetCount = await countSpaceDocuments(tx, input.targetSpaceId)
        if (targetCount + subtree.length > DOCS_LIMITS.documentsPerSpace)
          throw new DocsError('DOCS_LIMIT_EXCEEDED')
      }

      const oldSiblings = (await listActiveSiblings(tx, root.spaceId, root.parentId)).filter(
        (row) => row.id !== root.id,
      )
      const newSiblings = (
        await listActiveSiblings(tx, input.targetSpaceId, input.parentId)
      ).filter((row) => row.id !== root.id && !subtreeIds.includes(row.id))
      const anchorIndex = this.anchorIndex(newSiblings, input.beforeDocumentId)

      // 空间锁先行；文档锁覆盖被移动集合与两侧受影响活动同级。
      await lockDocuments(tx, [
        ...new Set([
          ...subtreeIds,
          ...oldSiblings.map((row) => row.id),
          ...newSiblings.map((row) => row.id),
        ]),
      ])

      const at = this.now()
      const affected = new Set<string>([root.id])
      // 跨空间后代的 space_id 全部变化，因此它们也是本次实际更新的行。
      for (const id of await this.relocateRoot(tx, {
        root,
        subtreeIds,
        targetSpaceId: input.targetSpaceId,
        parentId: input.parentId,
        at,
        actorId,
        crossSpace,
      })) {
        affected.add(id)
      }

      const newOrdered = newSiblings.slice()
      newOrdered.splice(anchorIndex, 0, {
        ...root,
        spaceId: input.targetSpaceId,
        parentId: input.parentId,
      })
      await this.rewritePositions(tx, oldSiblings, at, actorId, affected)
      await this.rewritePositions(tx, newOrdered, at, actorId, affected)

      const sourceTreeVersion = await this.bumpTreeVersion(tx, input.sourceSpaceId)
      const targetTreeVersion = crossSpace
        ? await this.bumpTreeVersion(tx, input.targetSpaceId)
        : sourceTreeVersion
      return {
        documentId: root.id,
        version: root.version + 1,
        source: { spaceId: input.sourceSpaceId, treeVersion: sourceTreeVersion },
        target: { spaceId: input.targetSpaceId, treeVersion: targetTreeVersion },
        affectedCount: affected.size,
      }
    })
  }

  async trashDocument(
    documentId: string,
    input: { expectedSpaceId: string; expectedVersion: number; expectedTreeVersion: number },
    actorId: string,
  ): Promise<{
    documentId: string
    version: number
    spaceId: string
    treeVersion: number
    deletionBatchId: string
    trashedCount: number
  }> {
    const expectedVersion = requireVersion(input.expectedVersion)
    const expectedTreeVersion = requireVersion(input.expectedTreeVersion)
    return this.command('tree', async (tx) => {
      await lockSpaces(tx, [input.expectedSpaceId])
      const space = await this.requireSpace(tx, input.expectedSpaceId)
      if (space.treeVersion !== expectedTreeVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      const root = await findDocument(tx, documentId)
      if (root === undefined || root.spaceId !== input.expectedSpaceId)
        throw new DocsError('DOCS_NOT_FOUND')
      if (root.deletedAt !== null) throw new DocsError('DOCS_ALREADY_TRASHED')
      if (root.version !== expectedVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      const subtree = await loadPhysicalSubtree(tx, root.spaceId, root.id)
      await lockDocuments(
        tx,
        subtree.map((row) => row.id),
      )
      const at = this.now()
      const batchId = this.createId()
      // 只给当前活动行写入新批次；先前已回收行的四项归属不修改，也不合并批次。
      const active = subtree.filter((row) => row.deletedAt === null)
      await markTrashed(
        tx,
        active.map((row) => row.id),
        { batchId, rootId: root.id, at, actorId },
      )
      const siblings = await listActiveSiblings(tx, root.spaceId, root.parentId)
      const affected = new Set<string>(active.map((row) => row.id))
      await this.rewritePositions(tx, siblings, at, actorId, affected)
      const treeVersion = await this.bumpTreeVersion(tx, root.spaceId)
      return {
        documentId: root.id,
        version: root.version + 1,
        spaceId: root.spaceId,
        treeVersion,
        deletionBatchId: batchId,
        trashedCount: active.length,
      }
    })
  }

  async listTrash(
    spaceId: string,
    query: PageQuery,
  ): Promise<{ items: DocsTrashGroupView[]; treeVersion: number; nextCursor: string | null }> {
    const limit = clampLimit(query.limit)
    return this.snapshot('tree', async (tx) => {
      const space = await findSpace(tx, spaceId)
      if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
      let after: { deletedAt: number; id: string } | undefined
      if (query.cursor !== undefined) {
        const cursor = decodeCursor(query.cursor)
        if (cursor.kind !== 'docs-trash' || cursorString(cursor.spaceId) !== spaceId)
          throw docsBadRequest()
        if (cursorInteger(cursor.treeVersion) !== space.treeVersion)
          throw new DocsError('DOCS_TREE_CHANGED')
        after = { deletedAt: cursorInteger(cursor.deletedAt), id: cursorString(cursor.id) }
      }
      const result =
        after === undefined
          ? await tx.query<Record<string, unknown> & { document_count: string }>(
              `SELECT r.id, r.space_id, r.parent_id, r.title, r.version, r.deletion_batch_id, r.deleted_at,
             (SELECT count(*) FROM docs_documents m
               WHERE m.space_id = r.space_id AND m.deletion_batch_id = r.deletion_batch_id) AS document_count
           FROM docs_documents r
           WHERE r.space_id = $1 AND r.deleted_at IS NOT NULL AND r.deletion_root_id = r.id
           ORDER BY r.deleted_at DESC, r.id LIMIT $2`,
              [spaceId, limit + 1],
            )
          : await tx.query<Record<string, unknown> & { document_count: string }>(
              `SELECT r.id, r.space_id, r.parent_id, r.title, r.version, r.deletion_batch_id, r.deleted_at,
             (SELECT count(*) FROM docs_documents m
               WHERE m.space_id = r.space_id AND m.deletion_batch_id = r.deletion_batch_id) AS document_count
           FROM docs_documents r
           WHERE r.space_id = $1 AND r.deleted_at IS NOT NULL AND r.deletion_root_id = r.id
             AND (r.deleted_at, r.id) < ($2, $3)
           ORDER BY r.deleted_at DESC, r.id LIMIT $4`,
              [spaceId, after.deletedAt, after.id, limit + 1],
            )
      const items = result.rows.map((row) => ({
        documentId: String(row.id),
        spaceId: String(row.space_id),
        parentId: row.parent_id === null ? null : String(row.parent_id),
        title: String(row.title),
        version: Number(row.version),
        deletionBatchId: String(row.deletion_batch_id),
        deletedAt: Number(row.deleted_at),
        documentCount: Number(row.document_count),
      }))
      const page = items.slice(0, limit)
      const last = page[page.length - 1]
      return {
        items: page,
        treeVersion: space.treeVersion,
        nextCursor:
          items.length > limit && last !== undefined
            ? encodeCursor({
                kind: 'docs-trash',
                spaceId,
                treeVersion: space.treeVersion,
                deletedAt: last.deletedAt,
                id: last.documentId,
              })
            : null,
      }
    })
  }

  async restoreDocument(
    documentId: string,
    input: {
      expectedSpaceId: string
      expectedVersion: number
      expectedTreeVersion: number
      deletionBatchId: string
    },
    actorId: string,
  ): Promise<{
    documentId: string
    version: number
    spaceId: string
    treeVersion: number
    restoredCount: number
    retainedTrashedCount: number
    placement: 'original-parent' | 'space-root'
  }> {
    const expectedVersion = requireVersion(input.expectedVersion)
    const expectedTreeVersion = requireVersion(input.expectedTreeVersion)
    return this.command('tree', async (tx) => {
      await lockSpaces(tx, [input.expectedSpaceId])
      const space = await this.requireSpace(tx, input.expectedSpaceId)
      if (space.treeVersion !== expectedTreeVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      const root = await findDocument(tx, documentId)
      if (root === undefined || root.spaceId !== input.expectedSpaceId)
        throw new DocsError('DOCS_NOT_FOUND')
      if (root.deletedAt === null) throw new DocsError('DOCS_VERSION_CONFLICT')
      if (root.deletionBatchId !== input.deletionBatchId)
        throw new DocsError('DOCS_VERSION_CONFLICT')
      if (root.version !== expectedVersion) throw new DocsError('DOCS_VERSION_CONFLICT')
      // 恢复入口只接受当前批次根。
      if (root.deletionRootId !== root.id) throw new DocsError('DOCS_RESTORE_ROOT_REQUIRED')

      const members = await tx.query<Record<string, unknown>>(
        `SELECT ${DOCUMENT_METADATA_COLUMNS} FROM docs_documents
         WHERE space_id = $1 AND deletion_batch_id = $2 AND deletion_root_id = $3`,
        [root.spaceId, root.deletionBatchId, root.id],
      )
      const batch = members.rows.map(decodeDocument)
      const batchIds = batch.map((row) => row.id)
      if (batch.length === 0 || !batchIds.includes(root.id)) throw docsCorrupted()
      const subtree = await loadPhysicalSubtree(tx, root.spaceId, root.id)
      const subtreeIds = new Set(subtree.map((row) => row.id))
      // 批次结构损坏按内部错误处理，不能用 fallback 隐藏数据错误。
      if (batch.some((row) => !subtreeIds.has(row.id))) throw docsCorrupted()

      await lockDocuments(tx, [...new Set([...batchIds, ...subtree.map((row) => row.id)])])

      const at = this.now()
      // 安置：原父为空、已回收或不可用时，本批根脱离原父并追加到空间根层。
      const originalParent =
        root.parentId === null ? undefined : await findDocument(tx, root.parentId)
      const useOriginalParent =
        originalParent !== undefined &&
        originalParent.spaceId === root.spaceId &&
        originalParent.deletedAt === null &&
        !batchIds.includes(originalParent.id)
      if (!useOriginalParent)
        await setDocumentPlacement(tx, root.id, { spaceId: root.spaceId, parentId: null })
      await clearTrashed(tx, batchIds, { at, actorId })

      // 每个受影响父层：先保留当前活动同级顺序，再把本批待恢复同级按保留的旧 (position,id) 升序追加到末尾，
      // 最后连续重排为 0..n-1。其他删除批次不参与此重排，仍保持回收状态。
      const affected = new Set<string>(batchIds)
      const byParent = new Map<string | null, DocsDocumentRow[]>()
      for (const row of batch) {
        const key = row.id === root.id ? (useOriginalParent ? root.parentId : null) : row.parentId
        const list = byParent.get(key) ?? []
        list.push(row)
        byParent.set(key, list)
      }
      for (const [parentId, rows] of byParent) {
        const existing = (await listActiveSiblings(tx, root.spaceId, parentId)).filter(
          (row) => !batchIds.includes(row.id),
        )
        const appended = rows
          .slice()
          .sort((left, right) => left.position - right.position || compareId(left.id, right.id))
        await this.rewritePositions(tx, [...existing, ...appended], at, actorId, affected)
      }

      const treeVersion = await this.bumpTreeVersion(tx, root.spaceId)
      const restoredIds = new Set(batchIds)
      const retainedTrashedCount = subtree.filter(
        (row) => row.deletedAt !== null && !restoredIds.has(row.id),
      ).length
      return {
        documentId: root.id,
        version: root.version + 1,
        spaceId: root.spaceId,
        treeVersion,
        restoredCount: batchIds.length,
        retainedTrashedCount,
        placement: useOriginalParent ? 'original-parent' : 'space-root',
      }
    })
  }

  // ------------------------------------------------------------ B 类预留

  /** 全部 B 类 operation 在本期明确返回 501，不访问数据库、存储或模型。 */
  notImplemented(): never {
    throw docsNotImplemented()
  }

  // ---------------------------------------------------------------- 内部

  private async requireSpace(tx: SqlExecutor, spaceId: string): Promise<DocsSpaceRow> {
    const space = await findSpace(tx, spaceId)
    if (space === undefined) throw new DocsError('DOCS_NOT_FOUND')
    return space
  }

  private async requireActiveParent(
    tx: SqlExecutor,
    spaceId: string,
    parentId: string,
    movingRootId: string | null,
    subtreeIds?: readonly string[],
  ): Promise<DocsDocumentRow> {
    const parent = await findDocument(tx, parentId)
    if (parent === undefined || parent.spaceId !== spaceId) throw new DocsError('DOCS_NOT_FOUND')
    if (parent.deletedAt !== null) throw new DocsError('DOCS_INVALID_MOVE')
    if (parent.id === movingRootId || (subtreeIds?.includes(parent.id) ?? false))
      throw new DocsError('DOCS_INVALID_MOVE')
    return parent
  }

  private anchorIndex(
    siblings: readonly DocsDocumentRow[],
    beforeDocumentId: string | null,
  ): number {
    if (beforeDocumentId === null) return siblings.length
    const index = siblings.findIndex((row) => row.id === beforeDocumentId)
    if (index < 0) throw new DocsError('DOCS_INVALID_MOVE')
    return index
  }

  /**
   * 跨空间移动把物理集合整体改到目标空间；根单独处理以便同时改父节点。
   * 复合自外键在提交时核验，遗漏任何物理后代都会整事务失败。
   */
  private async relocateRoot(
    tx: SqlExecutor,
    args: {
      root: DocsDocumentRow
      subtreeIds: readonly string[]
      targetSpaceId: string
      parentId: string | null
      at: number
      actorId: string
      crossSpace: boolean
    },
  ): Promise<string[]> {
    if (args.crossSpace) {
      await tx.query(
        `UPDATE docs_documents SET space_id = $2, parent_id = $3, version = version + 1, updated_at = $4, updated_by_user_id = $5
         WHERE id = $1`,
        [args.root.id, args.targetSpaceId, args.parentId, args.at, args.actorId],
      )
      const result = await tx.query<{ id: string }>(
        `UPDATE docs_documents SET space_id = $1, version = version + 1, updated_at = $3, updated_by_user_id = $4
         WHERE id = ANY($5::uuid[]) AND id <> $2
         RETURNING id`,
        [args.targetSpaceId, args.root.id, args.at, args.actorId, args.subtreeIds],
      )
      return result.rows.map((row) => row.id)
    }
    await tx.query(
      `UPDATE docs_documents SET parent_id = $2, version = version + 1, updated_at = $3, updated_by_user_id = $4
       WHERE id = $1`,
      [args.root.id, args.parentId, args.at, args.actorId],
    )
    return []
  }

  /**
   * 活动受影响同级连续重排为 `0..n-1`。
   * 只有位置真正变化的行递增版本；这是服务不变量，不是数据库唯一约束。
   */
  private async rewritePositions(
    tx: SqlExecutor,
    ordered: readonly DocsDocumentRow[],
    at: number,
    actorId: string,
    affected: Set<string>,
  ): Promise<void> {
    if (ordered.length === 0) return
    const ids = ordered.map((row) => row.id)
    const positions = ordered.map((_row, index) => index)
    const result = await tx.query<{ id: string }>(
      `UPDATE docs_documents AS d
       SET position = v.ord, version = d.version + 1, updated_at = $3, updated_by_user_id = $4
       FROM unnest($1::uuid[], $2::integer[]) AS v(id, ord)
       WHERE d.id = v.id AND d.position <> v.ord
       RETURNING d.id`,
      [ids, positions, at, actorId],
    )
    for (const row of result.rows) affected.add(row.id)
  }

  private async bumpTreeVersion(tx: SqlExecutor, spaceId: string): Promise<number> {
    const result = await tx.query<{ tree_version: string }>(
      'UPDATE docs_spaces SET tree_version = tree_version + 1 WHERE id = $1 RETURNING tree_version',
      [spaceId],
    )
    return Number(result.rows[0]?.tree_version ?? 0)
  }

  /** 按稳定 ID 读取时同样核验祖先活动链，不能绕过树导航暴露回收祖先下的活动行。 */
  private async assertReadable(tx: SqlExecutor, row: DocsDocumentContentRow): Promise<void> {
    if (row.parentId !== null) {
      const ancestors = await loadPhysicalAncestors(tx, row.id)
      if (ancestors.some((ancestor) => ancestor.deletedAt !== null))
        throw new DocsError('DOCS_NOT_FOUND')
    }
    // 存量 profile 1 内容真实损坏时读取失败，不静默修补或回写。
    assertStoredContent(row)
  }
}

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizeDescription(value: string, max: number): string {
  if ([...value].length > max) throw new DocsError('DOCS_INVALID_CONTENT')
  return value
}

function freezeTimeouts(
  value: Readonly<Record<TimeoutCategory, CommandTimeouts>>,
): Readonly<Record<TimeoutCategory, CommandTimeouts>> {
  const result = {} as Record<TimeoutCategory, CommandTimeouts>
  for (const category of ['metadata', 'content', 'tree'] as const) {
    const entry = value[category]
    if (entry === undefined) throw new Error(`Docs 缺少 ${category} 类别的超时配置。`)
    const { lockTimeoutMs, statementTimeoutMs } = entry
    const valid =
      Number.isSafeInteger(lockTimeoutMs) &&
      Number.isSafeInteger(statementTimeoutMs) &&
      lockTimeoutMs >= 1 &&
      lockTimeoutMs <= 2_147_483_647 &&
      statementTimeoutMs >= 1 &&
      statementTimeoutMs <= 2_147_483_647
    if (!valid) throw new Error(`Docs ${category} 超时配置超出 PostgreSQL 毫秒配置域。`)
    if (lockTimeoutMs > statementTimeoutMs)
      throw new Error(`Docs ${category} 的 lockTimeoutMs 不能大于 statementTimeoutMs。`)
    result[category] = Object.freeze({ lockTimeoutMs, statementTimeoutMs })
  }
  return Object.freeze(result)
}
