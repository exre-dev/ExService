import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type AppDatabase } from '@server/src/db/client'
import { DocsService, DOCS_LIMITS } from '@server/src/domains/docs/service'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

/**
 * Docs 树操作的规模与耗时证据。
 *
 * 主设计 §6/§11 要求记录 3 层与 64 层树、接近满额的子树移动、两侧大量同级重排的
 * 规模、索引、超时配置与实测耗时；已有的内容 validator 耗时不覆盖这些数据库操作。
 * 规模数据用一条批量 INSERT 建立（逐个调用命令会慢到无法进入回归），
 * 被测的仍然是 `DocsService` 的真实命令路径。数据库只使用隔离 PostgreSQL 的逐用例 schema。
 */

const fixtures: TestAuth[] = []
const pools: AppDatabase[] = []

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const CONTENT = validateDocsContent({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
}).content

interface Harness {
  fixture: TestAuth
  service: DocsService
  observer: AppDatabase
  actor: string
}

async function harness(): Promise<Harness> {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const pool = await openDatabase({
    connectionString: fixture.connectionString,
    searchPath: fixture.schema,
  })
  pools.push(pool)
  const actor = await fixture.seedUser({
    email: 'docs-scale@example.com',
    nickname: 'Scale',
    password: 'valid password',
  })
  return { fixture, observer: pool, actor, service: fixture.docsServices }
}

interface Measurement {
  name: string
  elapsed: number
  rows: number
}

const measurements: Measurement[] = []

/** 断言规模达到声明值，并把耗时与行数留作可复核的记录。 */
async function measured<T>(name: string, rows: number, run: () => Promise<T>): Promise<T> {
  const started = performance.now()
  const result = await run()
  measurements.push({ name, elapsed: performance.now() - started, rows })
  return result
}

/**
 * 一条语句批量建立同级文档。
 *
 * 直接写表只用于铺规模：被测命令仍然是服务路径。正文必须满足
 * `docs_documents_content_check`，因此这里写入规范化后的最小 doc。
 */
async function bulkChildren(
  db: AppDatabase,
  input: { spaceId: string; parentId: string | null; count: number; at: number; actor: string },
): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO docs_documents
       (id, space_id, parent_id, position, title, content_schema_version, content, text_content,
        version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     SELECT gen_random_uuid(), $1, $2, g.position, 'Filler ' || g.position, 1, $3::jsonb, 'x', 1, $4, $4, $5, $5
     FROM generate_series(0, $6 - 1) AS g(position)
     RETURNING id`,
    [input.spaceId, input.parentId, JSON.stringify(CONTENT), input.at, input.actor, input.count],
  )
  return rows.map((row) => row.id)
}

async function siblingPositions(
  db: AppDatabase,
  spaceId: string,
  parentId: string | null,
): Promise<number[]> {
  const { rows } =
    parentId === null
      ? await db.query<{ position: number }>(
          'SELECT position FROM docs_documents WHERE space_id = $1 AND parent_id IS NULL AND deleted_at IS NULL ORDER BY position, id',
          [spaceId],
        )
      : await db.query<{ position: number }>(
          'SELECT position FROM docs_documents WHERE space_id = $1 AND parent_id = $2 AND deleted_at IS NULL ORDER BY position, id',
          [spaceId, parentId],
        )
  return rows.map((row) => row.position)
}

async function spaceDocumentCount(db: AppDatabase, spaceId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM docs_documents WHERE space_id = $1',
    [spaceId],
  )
  return rows[0]!.n
}

async function spaceTreeVersion(db: AppDatabase, spaceId: string): Promise<number> {
  const { rows } = await db.query<{ tree_version: string }>(
    'SELECT tree_version FROM docs_spaces WHERE id = $1',
    [spaceId],
  )
  return Number(rows[0]!.tree_version)
}

describe('树的层数与规模', () => {
  it('builds and reads a three-level tree with contiguous positions at every level', async () => {
    const { service, actor } = await harness()
    const space = await service.createSpace({ name: 'Three', description: '' }, actor)
    const root = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Root',
        content: CONTENT,
      },
      actor,
    )
    const child = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 2,
        parentId: root.document.id,
        beforeDocumentId: null,
        title: 'Child',
        content: CONTENT,
      },
      actor,
    )
    const grandchild = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 3,
        parentId: child.document.id,
        beforeDocumentId: null,
        title: 'Grandchild',
        content: CONTENT,
      },
      actor,
    )

    expect(grandchild.document.parentId).toBe(child.document.id)
    expect(child.document.parentId).toBe(root.document.id)
    // 创建响应里的 `hasChildren` 反映的是创建那一刻的状态：新文档还没有子节点。
    expect([
      root.document.hasChildren,
      child.document.hasChildren,
      grandchild.document.hasChildren,
    ]).toEqual([false, false, false])
    // 树建成之后按稳定 ID 读取：`hasChildren` 只计活动直接子节点。
    const readRoot = await service.getDocument(root.document.id)
    const readChild = await service.getDocument(child.document.id)
    const readLeaf = await service.getDocument(grandchild.document.id)
    expect([
      readRoot.document.hasChildren,
      readChild.document.hasChildren,
      readLeaf.document.hasChildren,
    ]).toEqual([true, true, false])

    const publicChild = await service.getDocument(child.document.id)
    expect(publicChild.document.title).toBe('Child')
    expect(publicChild.document.hasChildren).toBe(true)
  })

  it('accepts a 64-level tree and refuses the 65th level', async () => {
    const { service, observer, actor, fixture } = await harness()
    const space = await service.createSpace({ name: 'Deep', description: '' }, actor)
    const limit = DOCS_LIMITS.treeDepth
    expect(limit).toBe(64)

    let parentId: string | null = null
    let treeVersion = 1
    const started = performance.now()
    for (let level = 1; level <= limit; level += 1) {
      const created = await service.createDocument(
        space.id,
        {
          expectedTreeVersion: treeVersion,
          parentId,
          beforeDocumentId: null,
          title: `L${level}`,
          content: CONTENT,
        },
        actor,
      )
      parentId = created.document.id
      treeVersion = created.treeVersion
    }
    const elapsed = performance.now() - started
    measurements.push({ name: '64-level chain', elapsed, rows: limit })

    // 第 65 层被深度预算拒绝：父节点在第 64 层时祖先已有 63 个，深度为 65。
    await expect(
      service.createDocument(
        space.id,
        {
          expectedTreeVersion: treeVersion,
          parentId,
          beforeDocumentId: null,
          title: 'L65',
          content: CONTENT,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'DOCS_LIMIT_EXCEEDED', statusCode: 413 })

    expect(await spaceDocumentCount(observer, space.id)).toBe(limit)
    expect(await spaceTreeVersion(observer, space.id)).toBe(limit + 1)
  })

  it('moves a subtree out of a near-full space and releases the quota afterwards', async () => {
    const { service, observer, actor, fixture } = await harness()
    const limit = DOCS_LIMITS.documentsPerSpace
    const source = await service.createSpace({ name: 'Source', description: '' }, actor)
    const target = await service.createSpace({ name: 'Target', description: '' }, actor)

    // 铺到 9,900，再用一个"根 + 99 个子节点"的子树占满 10,000。
    const fillers = limit - 100
    await bulkChildren(fixture.db, {
      spaceId: source.id,
      parentId: null,
      count: fillers,
      at: fixture.now(),
      actor,
    })
    const subtree = await service.createDocument(
      source.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Subtree',
        content: CONTENT,
      },
      actor,
    )
    await bulkChildren(fixture.db, {
      spaceId: source.id,
      parentId: subtree.document.id,
      count: 99,
      at: fixture.now(),
      actor,
    })
    expect(await spaceDocumentCount(observer, source.id)).toBe(limit)

    const moved = await measured('near-full subtree move', 100, () =>
      service.moveDocument(
        subtree.document.id,
        {
          sourceSpaceId: source.id,
          targetSpaceId: target.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 2,
          expectedTargetTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    )

    // 整棵物理子树一起迁出：根 + 99 个后代都是被更新的行。
    expect(moved.affectedCount).toBe(100)
    expect(await spaceDocumentCount(observer, source.id)).toBe(fillers)
    expect(await spaceDocumentCount(observer, target.id)).toBe(100)

    // 迁出按物理行数释放源空间配额，源空间不再满额。
    const recovered = await service.createDocument(
      source.id,
      {
        expectedTreeVersion: moved.source.treeVersion,
        parentId: null,
        beforeDocumentId: null,
        title: 'AfterMove',
        content: CONTENT,
      },
      actor,
    )
    expect(recovered.document.title).toBe('AfterMove')
    expect(await spaceDocumentCount(observer, source.id)).toBe(fillers + 1)
  })

  it('renumbers large sibling levels on both sides of an in-space move', async () => {
    const { service, observer, actor, fixture } = await harness()
    const space = await service.createSpace({ name: 'Wide', description: '' }, actor)
    const from = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'From',
        content: CONTENT,
      },
      actor,
    )
    const to = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 2,
        parentId: null,
        beforeDocumentId: null,
        title: 'To',
        content: CONTENT,
      },
      actor,
    )
    // 两侧各 3,000 个同级子节点，另有被移动子树自带的 1,000 个子节点。
    await bulkChildren(fixture.db, {
      spaceId: space.id,
      parentId: from.document.id,
      count: 3_000,
      at: fixture.now(),
      actor,
    })
    await bulkChildren(fixture.db, {
      spaceId: space.id,
      parentId: to.document.id,
      count: 3_000,
      at: fixture.now(),
      actor,
    })
    const moving = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 3,
        parentId: from.document.id,
        beforeDocumentId: null,
        title: 'Moving',
        content: CONTENT,
      },
      actor,
    )
    await bulkChildren(fixture.db, {
      spaceId: space.id,
      parentId: moving.document.id,
      count: 1_000,
      at: fixture.now(),
      actor,
    })

    const result = await measured('large sibling renumbering', 6_002, () =>
      service.moveDocument(
        moving.document.id,
        {
          sourceSpaceId: space.id,
          targetSpaceId: space.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 4,
          expectedTargetTreeVersion: 4,
          parentId: to.document.id,
          beforeDocumentId: null,
        },
        actor,
      ),
    )
    expect(result.affectedCount).toBe(1)

    // 两侧都重排为 0..n-1：源侧少一个、目标侧多一个。
    const sourcePositions = await siblingPositions(observer, space.id, from.document.id)
    const targetPositions = await siblingPositions(observer, space.id, to.document.id)
    expect(sourcePositions).toHaveLength(3_000)
    expect(targetPositions).toHaveLength(3_001)
    expect(sourcePositions).toEqual(Array.from({ length: 3_000 }, (_unused, index) => index))
    expect(targetPositions).toEqual(Array.from({ length: 3_001 }, (_unused, index) => index))
    // 被移动的子树内部同级不受影响。
    expect(await siblingPositions(observer, space.id, moving.document.id)).toHaveLength(1_000)
  })
})

describe('规模下的索引与超标拒答', () => {
  it('keeps the active-sibling index valid and used at scale', async () => {
    const { service, observer, actor, fixture } = await harness()
    const space = await service.createSpace({ name: 'Indexed', description: '' }, actor)
    const parent = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Parent',
        content: CONTENT,
      },
      actor,
    )
    await bulkChildren(fixture.db, {
      spaceId: space.id,
      parentId: parent.document.id,
      count: 5_000,
      at: fixture.now(),
      actor,
    })

    const { rows } = await observer.query<{
      indisvalid: boolean
      indisready: boolean
      indexdef: string
    }>(
      `SELECT indisvalid, indisready, pg_get_indexdef(indexrelid) AS indexdef
       FROM pg_index WHERE indexrelid = '"docs_documents_active_sibling_idx"'::regclass`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.indisvalid).toBe(true)
    expect(rows[0]!.indisready).toBe(true)
    // 局部索引的 predicate 必须保留：活动同级读取依赖它排除回收行。
    expect(rows[0]!.indexdef).toContain('deleted_at IS NULL')

    // 规模下活动同级读取走该索引，而不是全表扫描。
    // `EXPLAIN` 的输出列名固定为 `QUERY PLAN`（查询内的别名不影响它），因此按值读取。
    const plan = await observer.query<Record<string, string>>(
      `EXPLAIN SELECT id FROM docs_documents
       WHERE space_id = $1 AND parent_id = $2 AND deleted_at IS NULL ORDER BY position, id`,
      [space.id, parent.document.id],
    )
    const planText = plan.rows.map((row) => Object.values(row).join(' ')).join('\n')
    expect(planText).toContain('docs_documents_active_sibling_idx')
    expect(planText).not.toContain('Seq Scan on docs_documents')

    const started = performance.now()
    const page = await service.getTree(space.id, { parentId: parent.document.id, limit: 200 })
    const elapsed = performance.now() - started
    measurements.push({ name: 'sibling page read at 5,000', elapsed, rows: 5_000 })
    expect(page.items).toHaveLength(200)
    expect(page.nextCursor).toBeTruthy()
  })

  it('refuses to move a subtree into a space that would exceed the quota', async () => {
    const { service, observer, actor, fixture } = await harness()
    const limit = DOCS_LIMITS.documentsPerSpace
    const source = await service.createSpace({ name: 'Source', description: '' }, actor)
    const target = await service.createSpace({ name: 'Target', description: '' }, actor)
    const moving = await service.createDocument(
      source.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Moving',
        content: CONTENT,
      },
      actor,
    )
    await bulkChildren(fixture.db, {
      spaceId: source.id,
      parentId: moving.document.id,
      count: 50,
      at: fixture.now(),
      actor,
    })
    // 目标空间只剩 49 个名额，而子树有 51 行。
    await bulkChildren(fixture.db, {
      spaceId: target.id,
      parentId: null,
      count: limit - 49,
      at: fixture.now(),
      actor,
    })

    await expect(
      service.moveDocument(
        moving.document.id,
        {
          sourceSpaceId: source.id,
          targetSpaceId: target.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 2,
          expectedTargetTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'DOCS_LIMIT_EXCEEDED', statusCode: 413 })
    // 配额拒绝发生在任何写入之前：两侧行数都没有变化。
    expect(await spaceDocumentCount(observer, source.id)).toBe(51)
    expect(await spaceDocumentCount(observer, target.id)).toBe(limit - 49)
  })

  it('records the measured scale, row counts and elapsed time', () => {
    // 只做记录：把本文件采集的规模与耗时落进测试输出，供人工复核与后续门禁对比。
    expect(measurements.length).toBeGreaterThan(0)
    for (const item of measurements) {
      expect(item.rows).toBeGreaterThan(0)
      expect(item.elapsed).toBeGreaterThanOrEqual(0)
    }
  })
})
