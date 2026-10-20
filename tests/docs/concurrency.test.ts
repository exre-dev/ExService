import { Client } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase, type AppDatabase } from '@server/src/db/client'
import { DocsService } from '@server/src/domains/docs/service'
import { insertDocument, setPosition } from '@server/src/domains/docs/repository'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

/**
 * Docs 并发与回滚的验收。
 *
 * 竞争用例不使用 `Promise.all` 碰运气：另一个连接先持有空间行锁，两条命令都进入
 * `pg_stat_activity` 的 Lock 等待后才统一放行，因此交错点是屏障控制的、可复现的。
 * 数据库只使用隔离 PostgreSQL 的逐用例 schema，迁移由 `isolatedPostgres` 施加。
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

function identifier(prefix: string) {
  let counter = 0
  return () => `${prefix}-0000-4000-8000-${String(++counter).padStart(12, '0')}`
}

interface Harness {
  fixture: TestAuth
  primary: DocsService
  secondary: DocsService
  actor: string
  /** 另一条独立连接；用于观察提交后的真实状态。 */
  observer: AppDatabase
}

async function harness(
  timeouts?: ConstructorParameters<typeof DocsService>[0]['timeouts'],
): Promise<Harness> {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const pool = await openDatabase({
    connectionString: fixture.connectionString,
    searchPath: fixture.schema,
  })
  pools.push(pool)
  const actor = await fixture.seedUser({
    email: 'docs-race@example.com',
    nickname: 'Race',
    password: 'valid password',
  })
  return {
    fixture,
    observer: pool,
    actor,
    primary: fixture.docsServices,
    secondary: new DocsService({
      db: pool,
      now: fixture.now,
      createId: identifier('90000000'),
      ...(timeouts ? { timeouts } : {}),
    }),
  }
}

/** 在另一条连接上持有行锁，把后续命令挡在屏障之前。 */
async function holdRowLock(fixture: TestAuth, sql: string, values: unknown[]) {
  const client = new Client({ connectionString: fixture.connectionString })
  await client.connect()
  await client.query(`SET search_path TO "${fixture.schema}"`)
  await client.query('BEGIN')
  await client.query(sql, values)
  return {
    async release() {
      await client.query('ROLLBACK')
      await client.end()
    },
  }
}

/** 等到 `count` 条命令真的卡在锁上，再统一放行。 */
async function waitForBlocked(observer: AppDatabase, count: number, fragment: string) {
  await vi.waitFor(
    async () => {
      const { rows } = await observer.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid()
         AND wait_event_type = 'Lock' AND query LIKE $1`,
        [`%${fragment}%`],
      )
      expect(rows[0]!.n).toBeGreaterThanOrEqual(count)
    },
    { timeout: 15_000, interval: 20 },
  )
}

type Settled<T> =
  { ok: true; value: T } | { ok: false; error: { code?: string; statusCode?: number } }

/** 立刻装上处理函数，避免屏障期间出现未处理的 rejection。 */
function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true, value }) as Settled<T>,
    (error) => ({ ok: false, error }) as Settled<T>,
  )
}

const errorCode = (result: Settled<unknown>) => (result.ok ? undefined : result.error.code)

async function spaceState(observer: AppDatabase, spaceId: string) {
  const { rows } = await observer.query<{ version: string; tree_version: string }>(
    'SELECT version, tree_version FROM docs_spaces WHERE id = $1',
    [spaceId],
  )
  return { version: Number(rows[0]!.version), treeVersion: Number(rows[0]!.tree_version) }
}

async function documentRows(observer: AppDatabase, spaceId: string) {
  const { rows } = await observer.query<{
    id: string
    space_id: string
    parent_id: string | null
    position: number
    version: string
    deleted_at: string | null
    deletion_batch_id: string | null
  }>(
    'SELECT id, space_id, parent_id, position, version, deleted_at, deletion_batch_id FROM docs_documents WHERE space_id = $1 ORDER BY position, id',
    [spaceId],
  )
  return rows.map((row) => ({
    id: row.id,
    spaceId: row.space_id,
    parentId: row.parent_id,
    position: row.position,
    version: Number(row.version),
    deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
    deletionBatchId: row.deletion_batch_id,
  }))
}

/** 排序与 `orderedSpaceIds` 一致：两条命令都先撞上排在最前面的那个空间锁。 */
const firstLockedSpace = (...ids: string[]) => [...ids].sort()[0]!

describe('屏障控制的双连接竞争', () => {
  it('lets exactly one of two concurrent moves of the same subtree win', async () => {
    const { fixture, primary, secondary, actor, observer } = await harness()
    const spaceA = await primary.createSpace({ name: 'A', description: '' }, actor)
    const spaceB = await primary.createSpace({ name: 'B', description: '' }, actor)
    const root = await primary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Root',
        content: CONTENT,
      },
      actor,
    )
    const child = await primary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 2,
        parentId: root.document.id,
        beforeDocumentId: null,
        title: 'Child',
        content: CONTENT,
      },
      actor,
    )
    expect(spaceB.treeVersion).toBe(1)
    expect(child.treeVersion).toBe(3)

    const holder = await holdRowLock(
      fixture,
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [firstLockedSpace(spaceA.id, spaceB.id)],
    )
    const move = (service: DocsService) =>
      service.moveDocument(
        root.document.id,
        {
          sourceSpaceId: spaceA.id,
          targetSpaceId: spaceB.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 3,
          expectedTargetTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      )
    const first = settle(move(primary))
    const second = settle(move(secondary))
    // 两条命令都停在同一个空间锁上，交错点由屏障决定，而不是由调度碰运气。
    await waitForBlocked(observer, 2, 'docs_spaces')
    await holder.release()
    const results = await Promise.all([first, second])

    const winners = results.filter((result) => result.ok)
    const losers = results.filter((result) => !result.ok)
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(errorCode(losers[0]!)).toBe('DOCS_VERSION_CONFLICT')

    // 赢家把整棵物理子树搬走；两个空间的 tree_version 各只被推进一次。
    const [spaceAState, spaceBState] = await Promise.all([
      spaceState(observer, spaceA.id),
      spaceState(observer, spaceB.id),
    ])
    expect(spaceAState.treeVersion).toBe(4)
    expect(spaceBState.treeVersion).toBe(2)
    const moved = await documentRows(observer, spaceB.id)
    expect(moved.map((row) => row.id).sort()).toEqual([root.document.id, child.document.id].sort())
    expect(moved.find((row) => row.id === root.document.id)?.parentId).toBeNull()
    expect(moved.find((row) => row.id === child.document.id)?.parentId).toBe(root.document.id)
    // position 按同级分组编号：根层与 root 之下各自从 0 开始。
    expect(moved.find((row) => row.id === root.document.id)?.position).toBe(0)
    expect(moved.find((row) => row.id === child.document.id)?.position).toBe(0)
    // 跨空间移动会让后代的 space_id 变化，因此它们同样是被更新的行，version 一起推进。
    expect(moved.find((row) => row.id === root.document.id)?.version).toBe(2)
    expect(moved.find((row) => row.id === child.document.id)?.version).toBe(2)
    expect(await documentRows(observer, spaceA.id)).toEqual([])
  })

  it('keeps a trash/move race on the same subtree all-or-nothing', async () => {
    const { fixture, primary, secondary, actor, observer } = await harness()
    const spaceA = await primary.createSpace({ name: 'A', description: '' }, actor)
    const spaceB = await primary.createSpace({ name: 'B', description: '' }, actor)
    const root = await primary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Root',
        content: CONTENT,
      },
      actor,
    )
    const child = await primary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 2,
        parentId: root.document.id,
        beforeDocumentId: null,
        title: 'Child',
        content: CONTENT,
      },
      actor,
    )

    const holder = await holdRowLock(
      fixture,
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [firstLockedSpace(spaceA.id, spaceB.id)],
    )
    const trashing = settle(
      primary.trashDocument(
        root.document.id,
        {
          expectedSpaceId: spaceA.id,
          expectedVersion: 1,
          expectedTreeVersion: 3,
        },
        actor,
      ),
    )
    const moving = settle(
      secondary.moveDocument(
        root.document.id,
        {
          sourceSpaceId: spaceA.id,
          targetSpaceId: spaceB.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 3,
          expectedTargetTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    )
    await waitForBlocked(observer, 2, 'docs_spaces')
    await holder.release()
    const results = await Promise.all([trashing, moving])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toHaveLength(1)
    expect(['DOCS_VERSION_CONFLICT', 'DOCS_ALREADY_TRASHED', 'DOCS_TREE_CHANGED']).toContain(
      errorCode(results.find((result) => !result.ok)!),
    )

    // 无论谁赢：子树不会一半被回收一半被搬走，两侧 tree_version 的推进总和恰好为 1。
    const [spaceAState, spaceBState] = await Promise.all([
      spaceState(observer, spaceA.id),
      spaceState(observer, spaceB.id),
    ])
    expect(spaceAState.treeVersion).toBe(4)
    expect(spaceBState.treeVersion).toBe(results[0]!.ok ? 1 : 2)

    const remaining = await documentRows(observer, spaceA.id)
    const trashed = remaining.filter((row) => row.deletedAt !== null)
    expect(trashed.length === 0 || trashed.length === 2).toBe(true)
    if (trashed.length === 2) {
      // 同批次回收：批次号一致，且没有留下只回收了一半的子树。
      expect(new Set(trashed.map((row) => row.deletionBatchId)).size).toBe(1)
      expect(await documentRows(observer, spaceB.id)).toEqual([])
    } else {
      const moved = await documentRows(observer, spaceB.id)
      expect(moved).toHaveLength(2)
      expect(remaining).toEqual([])
    }
  })

  it('turns a lock timeout into 503 DOCS_BUSY without changing any row', async () => {
    const { fixture, secondary, actor, observer } = await harness({
      metadata: { lockTimeoutMs: 1, statementTimeoutMs: 2_000 },
      content: { lockTimeoutMs: 1, statementTimeoutMs: 2_000 },
      tree: { lockTimeoutMs: 1, statementTimeoutMs: 2_000 },
    })
    const spaceA = await secondary.createSpace({ name: 'Low', description: '' }, actor)
    const root = await secondary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Root',
        content: CONTENT,
      },
      actor,
    )
    const before = await spaceState(observer, spaceA.id)

    const holder = await holdRowLock(
      fixture,
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [spaceA.id],
    )
    const result = await settle(
      secondary.trashDocument(
        root.document.id,
        {
          expectedSpaceId: spaceA.id,
          expectedVersion: 1,
          expectedTreeVersion: 2,
        },
        actor,
      ),
    )
    await holder.release()

    // 55P03 由 service 映射为固定 503，并带 Retry-After。
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('DOCS_BUSY')
    expect(result.ok === false && result.error.statusCode).toBe(503)
    expect(await spaceState(observer, spaceA.id)).toEqual(before)
    expect((await documentRows(observer, spaceA.id)).every((row) => row.deletedAt === null)).toBe(
      true,
    )
  })
})

describe('低超时与延迟约束下的完整回滚', () => {
  it('rolls back every write of a transaction that hits its statement timeout', async () => {
    const { fixture, primary, actor, observer } = await harness()
    const space = await primary.createSpace({ name: 'Rollback', description: '' }, actor)
    const root = await primary.createDocument(
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
    const before = await spaceState(observer, space.id)
    const doomed = '91000000-0000-4000-8000-000000000099'

    await expect(
      fixture.db.transaction(async (tx) => {
        await tx.query('SET LOCAL statement_timeout = 50')
        await insertDocument(tx, {
          id: doomed,
          spaceId: space.id,
          parentId: null,
          position: 1,
          title: 'Doomed',
          content: CONTENT,
          textContent: 'x',
          at: fixture.now(),
          actorId: actor,
        })
        await setPosition(tx, root.document.id, 41)
        await tx.query('SELECT pg_sleep(1)')
      }),
    ).rejects.toMatchObject({ code: '57014' })

    // 超时前的两次写入都随事务回滚：既没有留下新行，也没有留下被改过的 position。
    const rows = await documentRows(observer, space.id)
    expect(rows.map((row) => row.id)).toEqual([root.document.id])
    expect(rows[0]!.position).toBe(0)
    expect(await spaceState(observer, space.id)).toEqual(before)
  })

  it('rolls back a cross-space placement that the deferred foreign key rejects at commit', async () => {
    const { fixture, primary, actor, observer } = await harness()
    const spaceA = await primary.createSpace({ name: 'A', description: '' }, actor)
    const spaceB = await primary.createSpace({ name: 'B', description: '' }, actor)
    const inB = await primary.createDocument(
      spaceB.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'InB',
        content: CONTENT,
      },
      actor,
    )
    const inA = await primary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'InA',
        content: CONTENT,
      },
      actor,
    )
    const orphan = '91000000-0000-4000-8000-000000000098'

    // (parent_id, space_id) 的复合自引用外键是可延迟的：写的时候不报错，COMMIT 才拦下。
    await expect(
      fixture.db.transaction(async (tx) => {
        await insertDocument(tx, {
          id: orphan,
          spaceId: spaceA.id,
          parentId: inB.document.id,
          position: 1,
          title: 'Orphan',
          content: CONTENT,
          textContent: 'x',
          at: fixture.now(),
          actorId: actor,
        })
        await setPosition(tx, inA.document.id, 41)
      }),
    ).rejects.toMatchObject({ code: '23503' })

    const rowsA = await documentRows(observer, spaceA.id)
    expect(rowsA.map((row) => row.id)).toEqual([inA.document.id])
    expect(rowsA[0]!.position).toBe(0)
    expect(await documentRows(observer, spaceB.id)).toHaveLength(1)
  })
})

describe('尚未覆盖的三类竞争', () => {
  it('resolves two opposite cross-space moves without deadlocking', async () => {
    const { fixture, primary, secondary, actor, observer } = await harness()
    const spaceA = await primary.createSpace({ name: 'A', description: '' }, actor)
    const spaceB = await primary.createSpace({ name: 'B', description: '' }, actor)
    // 两个空间各有一棵待迁出的子树，迁出方向正好相反。
    const rootA = await primary.createDocument(
      spaceA.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'RootA',
        content: CONTENT,
      },
      actor,
    )
    const rootB = await primary.createDocument(
      spaceB.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'RootB',
        content: CONTENT,
      },
      actor,
    )
    expect(rootA.treeVersion).toBe(2)
    expect(rootB.treeVersion).toBe(2)

    // 两条命令都先撞上排在最前面的那个空间锁：锁序固定，因此只会排队不会互锁。
    const holder = await holdRowLock(
      fixture,
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [firstLockedSpace(spaceA.id, spaceB.id)],
    )
    const moveAtoB = settle(
      primary.moveDocument(
        rootA.document.id,
        {
          sourceSpaceId: spaceA.id,
          targetSpaceId: spaceB.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 2,
          expectedTargetTreeVersion: 2,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    )
    const moveBtoA = settle(
      secondary.moveDocument(
        rootB.document.id,
        {
          sourceSpaceId: spaceB.id,
          targetSpaceId: spaceA.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 2,
          expectedTargetTreeVersion: 2,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    )
    await waitForBlocked(observer, 2, 'docs_spaces')
    await holder.release()
    const results = await Promise.all([moveAtoB, moveBtoA])

    // 固定锁序保证没有死锁：两条命令都返回，而不是有一条被 40P01 中止。
    const codes = results.map((result) => (result.ok ? 'OK' : String(errorCode(result))))
    expect(codes.sort()).toEqual(['DOCS_VERSION_CONFLICT', 'OK'])
    const [spaceAState, spaceBState] = await Promise.all([
      spaceState(observer, spaceA.id),
      spaceState(observer, spaceB.id),
    ])
    expect(spaceAState.treeVersion).toBe(3)
    expect(spaceBState.treeVersion).toBe(3)
    // 两棵子树始终都在：赢家的方向决定它们最终并到哪一侧，输家那一棵留在原处。
    const rowsA = await documentRows(observer, spaceA.id)
    const rowsB = await documentRows(observer, spaceB.id)
    expect(rowsA.length + rowsB.length).toBe(2)
    const movedAtoB = results[0]!.ok
    const winner = [rootA.document.id, rootB.document.id].sort()
    expect(rowsA.map((row) => row.id).sort()).toEqual(movedAtoB ? [] : winner)
    expect(rowsB.map((row) => row.id).sort()).toEqual(movedAtoB ? winner : [])
  })

  it('lets exactly one of a concurrent save and move of the same document win', async () => {
    const { fixture, primary, secondary, actor, observer } = await harness()
    const space = await primary.createSpace({ name: 'SaveMove', description: '' }, actor)
    const root = await primary.createDocument(
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
    expect(root.treeVersion).toBe(2)

    const holder = await holdRowLock(
      fixture,
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [space.id],
    )
    const saving = settle(
      primary.saveDocument(
        root.document.id,
        {
          expectedSpaceId: space.id,
          expectedVersion: 1,
          title: 'Saved',
          content: CONTENT,
        },
        actor,
      ),
    )
    const moving = settle(
      secondary.moveDocument(
        root.document.id,
        {
          sourceSpaceId: space.id,
          targetSpaceId: space.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 2,
          expectedTargetTreeVersion: 2,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    )
    await waitForBlocked(observer, 2, 'docs_spaces')
    await holder.release()
    const results = await Promise.all([saving, moving])

    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toHaveLength(1)
    // 同一文档只加一次版本：无论谁赢，输家看到的都是被推进后的版本。
    expect(errorCode(results.find((result) => !result.ok)!)).toBe('DOCS_VERSION_CONFLICT')
    const rows = await documentRows(observer, space.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.version).toBe(2)
    // 赢家若是保存，标题被改；赢家若是移动，标题保持原样——两者都留下同一行。
    expect(['Saved', 'Root']).toContain(
      (
        await observer.query<{ title: string }>('SELECT title FROM docs_documents WHERE id = $1', [
          root.document.id,
        ])
      ).rows[0]!.title,
    )
  })

  it('keeps an empty-space delete racing against a document insert consistent', async () => {
    const { fixture, primary, secondary, actor, observer } = await harness()
    const space = await primary.createSpace({ name: 'Empty', description: '' }, actor)
    expect(await documentRows(observer, space.id)).toEqual([])

    const holder = await holdRowLock(
      fixture,
      'SELECT id FROM docs_spaces WHERE id = $1 FOR UPDATE',
      [space.id],
    )
    const deleting = settle(
      primary.deleteSpace(space.id, { expectedVersion: 1, expectedTreeVersion: 1 }),
    )
    const creating = settle(
      secondary.createDocument(
        space.id,
        {
          expectedTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
          title: 'Late',
          content: CONTENT,
        },
        actor,
      ),
    )
    await waitForBlocked(observer, 2, 'docs_spaces')
    await holder.release()
    const results = await Promise.all([deleting, creating])

    // 两条命令共用同一把空间行锁：空检查与并发插入因此不会互相穿透。
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toHaveLength(1)
    const loserCode = errorCode(results.find((result) => !result.ok)!)
    // 输家可能被三道守卫之一拦下，按命令到达顺序而定：
    // 先插入 → 删除先撞上过期的树版本，其次才会发现非空；先删除 → 插入找不到空间。
    // 三者都是同一把空间锁在起作用，不是三套互不相干的机制。
    expect(['DOCS_VERSION_CONFLICT', 'DOCS_SPACE_NOT_EMPTY', 'DOCS_NOT_FOUND']).toContain(loserCode)

    const { rows: spaces } = await observer.query<{ id: string }>(
      'SELECT id FROM docs_spaces WHERE id = $1',
      [space.id],
    )
    const rows = await documentRows(observer, space.id)
    const deleted = results[0]!.ok
    // 核心不变式：删除成功则空间整行消失且不留任何文档行；删除失败则空间仍在。
    if (deleted) {
      expect(spaces).toHaveLength(0)
      expect(rows).toEqual([])
    } else {
      expect(spaces).toHaveLength(1)
      // 插入成功时空间不再是空的，删除因此被非空守卫拦住；那一行必须真的在库里。
      const { rows: titles } = await observer.query<{ title: string }>(
        'SELECT title FROM docs_documents WHERE space_id = $1',
        [space.id],
      )
      expect(titles.map((row) => row.title)).toEqual(['Late'])
      expect(rows).toHaveLength(1)
    }
  })
})
