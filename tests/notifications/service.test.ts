import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  createNotificationModule,
  type NotificationModule,
} from '@server/src/modules/notifications/factory'
import { normalizeDigest } from '@server/src/modules/notifications/producer.js'
import { NotificationError } from '@server/src/modules/notifications/errors'
import { isolatedPostgres } from '@tests/helpers/postgres'
import type { AppDatabase } from '@server/src/db/client.js'

/**
 * 真实 PostgreSQL（Testcontainers，逐用例 schema）上的通知行为验证。
 * 这里不 mock 数据库，也不回退本机开发库。
 */

let db: AppDatabase
let close: () => Promise<void>
let currentTime = 1_800_000_000_000
let notifications: NotificationModule
const now = () => currentTime

const RICH_HTML =
  '<h2>社区公告</h2><p>本周维护窗口已确定，详见 <a href="/communities/rifling-911">社区主页</a>。</p>' +
  '<ul><li>窗口：周六 02:00</li><li>影响：登录与文档</li></ul>'

beforeEach(async () => {
  const isolated = await isolatedPostgres()
  db = isolated.db
  close = isolated.close
  currentTime = 1_800_000_000_000
  notifications = createNotificationModule({ db, tokenKey: Buffer.alloc(32, 3), now })
}, 120_000)

afterEach(async () => {
  await close()
}, 120_000)

async function seedUser(nickname = 'member'): Promise<string> {
  const id = randomUUID()
  await db.query(
    'INSERT INTO auth_users (id, email, nickname, password_hash, created_at) VALUES ($1,$2,$3,$4,$5)',
    [id, `${id}@example.com`, nickname, 'x', now()],
  )
  return id
}

async function grantAdmin(userId: string): Promise<void> {
  await db.query(
    `INSERT INTO community_group_memberships (user_id, group_code) VALUES ($1, 'admin')`,
    [userId],
  )
}

/** 直接数库里的 preview 批次行：预览是否被反复点开累积，只能在这里看到。 */
async function countPreviewBatches(userId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM notification_clear_batches
      WHERE user_id = $1 AND status = 'preview'`,
    [userId],
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function countPreviewBatchItems(userId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM notification_clear_batch_items i
       JOIN notification_clear_batches b ON b.batch_id = i.batch_id
      WHERE b.user_id = $1 AND b.status = 'preview'`,
    [userId],
  )
  return Number(result.rows[0]?.count ?? 0)
}

/** 停用账号：投影必须把它当作不活跃，而不是照常投递。 */
async function disableUser(userId: string, at: number): Promise<void> {
  await db.query('UPDATE auth_users SET disabled_at = $2 WHERE id = $1', [userId, at])
}

async function publishAnnouncement(
  overrides: {
    title?: string
    html?: string
    audience?: { kind: 'users'; userIds: readonly string[] }
    availableAt?: number | null
  } = {},
  actor: string | null = null,
  requireAdmin = false,
) {
  return notifications.producer.publish(
    {
      eventType: 'community.announcement.published',
      dedupeKey: overrides.title ?? randomUUID(),
      actorUserId: actor,
      audience: overrides.audience ?? { kind: 'all_active_users' },
      content: {
        title: overrides.title ?? '维护通知',
        html: overrides.html ?? RICH_HTML,
        templateId: 'community.announcement',
        templateVersion: 1,
        sourceRevision: 1,
        actionsJson: '[]',
        availableAt: overrides.availableAt ?? null,
        expiresAt: null,
      },
      sourceType: 'internal',
      sourceId: 'test',
    },
    { requireAdmin },
  )
}

async function project(): Promise<void> {
  // 单轮不够时多跑几轮，直到没有事件被认领。
  for (let index = 0; index < 10; index += 1) {
    const round = await notifications.worker.runRound()
    if (round.eventsClaimed === 0) return
  }
}

describe('publication and projection', () => {
  it('projects one receipt per audience member and assigns a stable personal sequence', async () => {
    const [a, b] = [await seedUser('a'), await seedUser('b')]
    await publishAnnouncement({ audience: { kind: 'users', userIds: [a, b] } })
    await project()

    const listA = await notifications.service.list({
      userId: a,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(listA.items).toHaveLength(1)
    expect(listA.items[0]!.sequence).toBe(1)
    expect(listA.unreadCount).toBe(1)

    const listB = await notifications.service.list({
      userId: b,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(listB.items[0]!.sequence).toBe(1)
    // 序列是每人独立的：两人都是 1，互不影响。
    expect(listB.items[0]!.receiptId).not.toBe(listA.items[0]!.receiptId)
  })

  it('is idempotent per dedupe key and refuses a conflicting replay', async () => {
    const user = await seedUser()
    const audience = { kind: 'users' as const, userIds: [user] }
    const first = await publishAnnouncement({ title: '同一条', audience })
    const replay = await publishAnnouncement({ title: '同一条', audience })
    expect(replay.eventId).toBe(first.eventId)
    expect(replay.replayed).toBe(true)
    await project()
    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(list.items).toHaveLength(1)

    await expect(
      publishAnnouncement({ title: '同一条', audience, html: '<p>改了正文</p>' }),
    ).rejects.toThrowError(/NOTIFICATION_EVENT_CONFLICT/)
  })

  it('requires a real admin membership when the caller asks for it', async () => {
    const plain = await seedUser('plain')
    await expect(publishAnnouncement({}, plain, true)).rejects.toThrowError(
      /NOTIFICATION_PUBLISH_FORBIDDEN/,
    )
    const admin = await seedUser('admin')
    await grantAdmin(admin)
    await expect(publishAnnouncement({ title: 'admin-ok' }, admin, true)).resolves.toMatchObject({
      replayed: false,
    })
  })

  it('rejects an unknown or disabled audience atomically', async () => {
    const user = await seedUser()
    await expect(
      publishAnnouncement({ title: 'bad', audience: { kind: 'users', userIds: [randomUUID()] } }),
    ).rejects.toThrowError(/NOTIFICATION_AUDIENCE_INVALID/)
    const events = await db.query('SELECT 1 FROM notification_events')
    expect(events.rows).toHaveLength(0)

    await db.query('UPDATE auth_users SET disabled_at = $2 WHERE id = $1', [user, now()])
    await expect(
      publishAnnouncement({ title: 'bad2', audience: { kind: 'users', userIds: [user] } }),
    ).rejects.toThrowError(/NOTIFICATION_AUDIENCE_INVALID/)
  })

  it('rejects unsafe content before any row is written', async () => {
    const user = await seedUser()
    await expect(
      publishAnnouncement({
        title: 'unsafe',
        html: '<script>alert(1)</script>',
        audience: { kind: 'users', userIds: [user] },
      }),
    ).rejects.toThrowError(/CONTENT_UNSAFE/)
    const contents = await db.query('SELECT 1 FROM notification_contents')
    expect(contents.rows).toHaveLength(0)
  })

  it('suppresses optional categories the user switched off and never suppresses necessary ones', async () => {
    const user = await seedUser()
    await notifications.service.updatePreferences(user, 0, {
      announcement: false,
      personal_update: true,
    })
    await publishAnnouncement({ title: '被关闭', audience: { kind: 'users', userIds: [user] } })
    await project()
    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(list.items).toHaveLength(0)

    const recipients = await db.query<{ state: string }>(
      'SELECT state FROM notification_event_recipients',
    )
    expect(recipients.rows[0]!.state).toBe('suppressed_preference')
  })

  it('does not deliver before the content becomes available', async () => {
    const user = await seedUser()
    await notifications.producer.publish({
      eventType: 'community.announcement.published',
      dedupeKey: 'future',
      actorUserId: null,
      audience: { kind: 'users', userIds: [user] },
      content: {
        title: '稍后生效',
        html: RICH_HTML,
        templateId: 'community.announcement',
        templateVersion: 1,
        sourceRevision: 1,
        actionsJson: '[]',
        availableAt: now() + 60_000,
        expiresAt: null,
      },
      sourceType: 'internal',
      sourceId: 'test',
    })
    await project()
    expect((await notifications.service.summary(user)).unreadCount).toBe(0)
    // 未生效的内容会释放 lease 并推迟，不会让 worker 每轮重复认领同一事件。
    const idle = await notifications.worker.runRound()
    expect(idle.eventsClaimed).toBe(0)
    currentTime += 60_000
    await project()
    expect((await notifications.service.summary(user)).unreadCount).toBe(1)
  })
})

describe('history, unread and detail', () => {
  it('keeps expired notifications readable in history but out of the unread count', async () => {
    const user = await seedUser()
    await notifications.producer.publish({
      eventType: 'community.announcement.published',
      dedupeKey: 'expiring',
      actorUserId: null,
      audience: { kind: 'users', userIds: [user] },
      content: {
        title: '过期公告',
        html: RICH_HTML,
        templateId: 'community.announcement',
        templateVersion: 1,
        sourceRevision: 1,
        actionsJson: '[]',
        availableAt: null,
        expiresAt: now() + 1_000,
      },
      sourceType: 'internal',
      sourceId: 'test',
    })
    await project()
    currentTime += 2_000

    const summary = await notifications.service.summary(user)
    expect(summary.unreadCount).toBe(0)
    const history = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(history.items).toHaveLength(1)
    expect(history.items[0]!.expired).toBe(true)
    const detail = await notifications.service.detail(user, history.items[0]!.receiptId)
    expect(detail.lifecycle).toBe('expired')
    expect(detail.contentAvailable).toBe(true)
  })

  it('skips an account disabled after publication but before projection', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: '停用后投影', audience: { kind: 'users', userIds: [user] } })
    // 发布之后、投影之前被停用：投影必须记成 skipped_disabled，而不是照常投递。
    await disableUser(user, now())
    await project()

    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(list.items).toHaveLength(0)
    const recipients = await db.query<{ state: string }>(
      'SELECT state FROM notification_event_recipients WHERE user_id = $1',
      [user],
    )
    // 存在性不等于活跃：账号行还在，所以这里不能退化成「已删除才算停用」。
    expect(recipients.rows[0]?.state).toBe('skipped_disabled')
  })

  it('defers a publication that is not available yet', async () => {
    const user = await seedUser()
    // 推迟走的是 deferEventProjection，它必须复用事务连接：走默认连接会在事务外
    // 另起一条连接改同一行，一旦本事务持有该行锁就是自锁。
    await publishAnnouncement({
      title: '定时',
      audience: { kind: 'users', userIds: [user] },
      availableAt: now() + 60_000,
    })
    await project()
    const before = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(before.items).toHaveLength(0)

    currentTime += 61_000
    await project()
    const after = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(after.items).toHaveLength(1)
    expect(after.items[0]!.title).toBe('定时')
  })

  it('requires the same admin check for withdraw as for publish', async () => {
    const admin = await seedUser('admin2')
    await grantAdmin(admin)
    const plain = await seedUser('plain2')
    const published = await publishAnnouncement({ title: '待撤回' }, admin, true)

    await expect(
      notifications.producer.withdraw(
        {
          dedupeKey: 'withdraw-no-admin',
          contentId: published.contentId,
          actorUserId: plain,
          sourceType: 'internal',
          sourceId: 'test',
        },
        { requireAdmin: true },
      ),
    ).rejects.toThrowError(/NOTIFICATION_PUBLISH_FORBIDDEN/)

    // 没要求 admin 时行为不变：撤回同样能让内容消失。
    await notifications.producer.withdraw({
      dedupeKey: 'withdraw-plain',
      contentId: published.contentId,
      actorUserId: null,
      sourceType: 'internal',
      sourceId: 'test',
    })
    const list = await notifications.service.list({
      userId: admin,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(list.items).toHaveLength(0)
  })

  it('removes a withdrawn notification from list and count and returns a neutral 404', async () => {
    const user = await seedUser()
    const published = await publishAnnouncement({
      title: '将撤回',
      audience: { kind: 'users', userIds: [user] },
    })
    await project()
    const before = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    const receiptId = before.items[0]!.receiptId

    await notifications.producer.withdraw({
      dedupeKey: 'withdraw-1',
      contentId: published.contentId,
      actorUserId: null,
      sourceType: 'internal',
      sourceId: 'test',
    })
    const summary = await notifications.service.summary(user)
    expect(summary.unreadCount).toBe(0)
    const after = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(after.items).toHaveLength(0)
    await expect(notifications.service.detail(user, receiptId)).rejects.toThrowError(
      /NOTIFICATION_NOT_FOUND/,
    )
  })

  it('never exposes another user receipt', async () => {
    const [owner, other] = [await seedUser('owner'), await seedUser('other')]
    await publishAnnouncement({ title: '私人', audience: { kind: 'users', userIds: [owner] } })
    await project()
    const list = await notifications.service.list({
      userId: owner,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    const receiptId = list.items[0]!.receiptId
    await expect(notifications.service.detail(other, receiptId)).rejects.toThrowError(
      /NOTIFICATION_NOT_FOUND/,
    )
    await expect(notifications.service.updateState(other, receiptId, true, 0)).rejects.toThrowError(
      /NOTIFICATION_NOT_FOUND/,
    )
  })

  it('falls back to the safe text when stored HTML no longer satisfies the current policy', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: '策略回退', audience: { kind: 'users', userIds: [user] } })
    await project()
    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    // 模拟旧字节不再满足当前策略：正文被替换成不安全内容。
    await db.query('UPDATE notification_contents SET html = $1, text = $2', [
      '<p onclick="x">旧正文</p>',
      '旧正文',
    ])
    const detail = await notifications.service.detail(user, list.items[0]!.receiptId)
    expect(detail.contentAvailable).toBe(false)
    expect(detail.content).toBeNull()
    expect(detail.contentFallbackText).toContain('旧正文')
  })

  it('paginates with a signed cursor and deduplicates by receipt id', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    for (let index = 0; index < 4; index += 1) {
      await publishAnnouncement({
        title: `更多-${index}`,
        audience: { kind: 'users', userIds: [user] },
      })
    }
    await project()

    const first = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: 2,
      cursor: null,
    })
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    const second = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: 2,
      cursor: first.nextCursor,
    })
    const ids = [...first.items, ...second.items].map((item) => item.receiptId)
    expect(new Set(ids).size).toBe(4)
    // 序列按降序：后发布的先出现。
    expect(first.items[0]!.sequence).toBeGreaterThan(second.items.at(-1)!.sequence)
  })

  it('refuses a cursor minted for another view or user', async () => {
    const [a, b] = [await seedUser('a'), await seedUser('b')]
    await publishAnnouncement({ title: 'x1', audience: { kind: 'users', userIds: [a, b] } })
    await publishAnnouncement({ title: 'x2', audience: { kind: 'users', userIds: [a, b] } })
    await project()
    const first = await notifications.service.list({
      userId: a,
      view: 'history',
      scope: null,
      category: null,
      limit: 1,
      cursor: null,
    })
    expect(first.nextCursor).not.toBeNull()
    await expect(
      notifications.service.list({
        userId: a,
        view: 'unread',
        scope: null,
        category: null,
        limit: 1,
        cursor: first.nextCursor,
      }),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_INVALID/)
    await expect(
      notifications.service.list({
        userId: b,
        view: 'history',
        scope: null,
        category: null,
        limit: 1,
        cursor: first.nextCursor,
      }),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_INVALID/)
  })
})

describe('read state', () => {
  it('marks read, refuses a stale revision and treats a repeat as a no-op', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    await project()
    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    const receiptId = list.items[0]!.receiptId

    const read = await notifications.service.updateState(user, receiptId, true, 0)
    expect(read.read).toBe(true)
    expect(read.stateRevision).toBe(1)
    expect(read.unreadCount).toBe(0)

    await expect(notifications.service.updateState(user, receiptId, true, 0)).rejects.toThrowError(
      /NOTIFICATION_STATE_CONFLICT/,
    )
    const again = await notifications.service.updateState(user, receiptId, true, 1)
    expect(again.stateRevision).toBe(1)
  })

  it('marks read through a signed bound and leaves later arrivals unread', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: 'a', audience: { kind: 'users', userIds: [user] } })
    await project()
    const summary = await notifications.service.summary(user)

    await publishAnnouncement({ title: 'b', audience: { kind: 'users', userIds: [user] } })
    await project()

    const result = await notifications.service.readThrough(
      user,
      randomUUID(),
      summary.readThroughToken,
    )
    expect(result.affectedCount).toBe(1)
    expect(result.unreadCount).toBe(1)
  })

  it('replays the same request id and rejects a conflicting one', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    await project()
    const summary = await notifications.service.summary(user)
    const requestId = randomUUID()

    const first = await notifications.service.readThrough(user, requestId, summary.readThroughToken)
    const replay = await notifications.service.readThrough(
      user,
      requestId,
      summary.readThroughToken,
    )
    expect(replay.replayed).toBe(true)
    expect(replay.affectedCount).toBe(first.affectedCount)

    // 同 key 换令牌（不同上界）＝ 不同意图，必须冲突而不是静默覆盖。
    await publishAnnouncement({ title: 'later', audience: { kind: 'users', userIds: [user] } })
    await project()
    const later = await notifications.service.summary(user)
    await expect(
      notifications.service.readThrough(user, requestId, later.readThroughToken),
    ).rejects.toThrowError(/NOTIFICATION_REQUEST_CONFLICT/)
  })

  it('refuses an expired read-through token', async () => {
    const user = await seedUser()
    const summary = await notifications.service.summary(user)
    currentTime += 11 * 60 * 1000
    await expect(
      notifications.service.readThrough(user, randomUUID(), summary.readThroughToken),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_EXPIRED/)
  })
})

describe('precise clear', () => {
  it('clears exactly the previewed set and keeps a later arrival', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: '一', audience: { kind: 'users', userIds: [user] } })
    await publishAnnouncement({ title: '二', audience: { kind: 'users', userIds: [user] } })
    await project()

    const preview = await notifications.service.previewClear(user)
    expect(preview.itemCount).toBe(2)

    await publishAnnouncement({ title: '迟到', audience: { kind: 'users', userIds: [user] } })
    await project()

    const cleared = await notifications.service.clearSnapshot(
      user,
      randomUUID(),
      preview.clearSnapshotToken,
    )
    expect(cleared.affectedCount).toBe(2)
    expect(cleared.skippedCount).toBe(0)
    const clearedStates = await db.query<{ read_at: number | null; clear_revision: number }>(
      'SELECT read_at, clear_revision FROM notification_receipts WHERE user_id = $1 AND cleared_at IS NOT NULL',
      [user],
    )
    expect(clearedStates.rows).toEqual([
      { read_at: null, clear_revision: 1 },
      { read_at: null, clear_revision: 1 },
    ])
    const history = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(history.items).toHaveLength(1)
    expect(history.items[0]!.title).toBe('迟到')
    // 清理不写 readAt：迟到项仍然未读。
    expect(history.unreadCount).toBe(1)
  })

  it('replays the same clear request without changing its clear facts', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: '一', audience: { kind: 'users', userIds: [user] } })
    await publishAnnouncement({ title: '二', audience: { kind: 'users', userIds: [user] } })
    await project()

    const preview = await notifications.service.previewClear(user)
    const requestId = randomUUID()
    const first = await notifications.service.clearSnapshot(
      user,
      requestId,
      preview.clearSnapshotToken,
    )
    const replay = await notifications.service.clearSnapshot(
      user,
      requestId,
      preview.clearSnapshotToken,
    )
    expect(replay.replayed).toBe(true)
    expect(replay.affectedCount).toBe(first.affectedCount)

    const facts = await db.query<{
      status: string
      affected_count: number
      applied_clear_revision: number
    }>(
      `SELECT b.status, b.affected_count, i.applied_clear_revision FROM notification_clear_batches b
        JOIN notification_clear_batch_items i ON i.batch_id = b.batch_id WHERE b.batch_id = $1`,
      [preview.batchId],
    )
    expect(facts.rows).toHaveLength(2)
    expect(
      facts.rows.every(
        (row) =>
          row.status === 'applied' && row.affected_count === 2 && row.applied_clear_revision === 1,
      ),
    ).toBe(true)
    const history = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(history.items).toHaveLength(0)
  })

  it('skips a receipt whose clear revision changed after the preview', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: '一', audience: { kind: 'users', userIds: [user] } })
    await project()

    const stale = await notifications.service.previewClear(user)
    // 隔离数据库夹具模拟历史状态变化，旧预览不能覆盖更新后的 clear revision。
    await db.query(
      'UPDATE notification_receipts SET clear_revision = 2, state_revision = 2 WHERE user_id = $1',
      [user],
    )

    const again = await notifications.service.clearSnapshot(
      user,
      randomUUID(),
      stale.clearSnapshotToken,
    )
    expect(again.skippedCount).toBe(1)
    expect(again.affectedCount).toBe(0)

    // 旧 preview 提交后会被拒绝，不能继续消费同一个预览令牌。
    await expect(
      notifications.service.clearSnapshot(user, randomUUID(), stale.clearSnapshotToken),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_INVALID/)
  })

  it('sweeps a preview that can no longer be submitted and keeps the live one', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    await project()

    const first = await notifications.service.previewClear(user)
    expect(await countPreviewBatches(user)).toBe(1)

    // 同一时刻的第二份预览仍在有效期内，必须保留：设计 9.2 要求两份预览各自独立，
    // 旧预览要能提交并对已变化的项记 skipped。
    const second = await notifications.service.previewClear(user)
    expect(await countPreviewBatches(user)).toBe(2)
    expect(second.batchId).not.toBe(first.batchId)

    // 越过 10 分钟预览有效期后，旧批次的 token 在 verifyToken 就已经 410，
    // 它的行再也不会被读到；重新预览时顺手清掉。
    currentTime += 11 * 60 * 1000
    const third = await notifications.service.previewClear(user)
    expect(await countPreviewBatches(user)).toBe(1)

    // 过期 token 报的是「已过期」而不是「不存在」：清理只发生在重新预览时，
    // 且只清 verifyToken 已经会拒绝的那些行，用户可见错误码不变。
    await expect(
      notifications.service.clearSnapshot(user, randomUUID(), first.clearSnapshotToken),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_EXPIRED/)
    const cleared = await notifications.service.clearSnapshot(
      user,
      randomUUID(),
      third.clearSnapshotToken,
    )
    expect(cleared.affectedCount).toBe(1)
  })

  it('keeps live previews independent and preserves executed batches during expiry cleanup', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    await project()
    const first = await notifications.service.previewClear(user)
    const second = await notifications.service.previewClear(user)
    expect(first.batchId).not.toBe(second.batchId)
    const cleared = await notifications.service.clearSnapshot(
      user,
      randomUUID(),
      first.clearSnapshotToken,
    )
    expect(cleared.affectedCount).toBe(1)
    const skipped = await notifications.service.clearSnapshot(
      user,
      randomUUID(),
      second.clearSnapshotToken,
    )
    expect(skipped.affectedCount).toBe(0)
    expect(skipped.skippedCount).toBe(1)

    // 历史恢复允许值保持可读取，过期预览回收不触碰历史执行事实。
    await db.query(
      "UPDATE notification_clear_batches SET status = 'restored', restored_at = $2 WHERE batch_id = $1",
      [second.batchId, now()],
    )
    currentTime += 11 * 60 * 1000
    await notifications.service.previewClear(user)
    const batches = await db.query<{ batch_id: string; status: string }>(
      'SELECT batch_id, status FROM notification_clear_batches WHERE user_id = $1 AND status <> $2 ORDER BY batch_id',
      [user, 'preview'],
    )
    expect(batches.rows).toEqual(
      [
        { batch_id: first.batchId, status: 'applied' },
        { batch_id: second.batchId, status: 'restored' },
      ].sort((left, right) => left.batch_id.localeCompare(right.batch_id)),
    )
    expect(await countPreviewBatchItems(user)).toBe(0)
    const items = await db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM notification_clear_batch_items WHERE batch_id IN ($1, $2)',
      [first.batchId, second.batchId],
    )
    expect(items.rows[0]!.count).toBe('2')
  })

  it('does not let abandoned previews accumulate across repeated windows', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    await project()

    // 20 次点开、跨 10 个预览有效期：残留只等于**最后一个窗口**的点开次数（2），
    // 而不是等于点开总次数（20）—— 不扫的话这里就是 20。
    for (let round = 0; round < 10; round += 1) {
      await notifications.service.previewClear(user)
      await notifications.service.previewClear(user)
      currentTime += 11 * 60 * 1000
    }
    expect(await countPreviewBatches(user)).toBe(2)

    // 再点开一次：上一个窗口的两份都已过期，随这次预览一并扫掉。
    await notifications.service.previewClear(user)
    expect(await countPreviewBatches(user)).toBe(1)
  })

  it('previews an empty history without writing batch items', async () => {
    const user = await seedUser()
    const preview = await notifications.service.previewClear(user)
    expect(preview.itemCount).toBe(0)
    expect(await countPreviewBatchItems(user)).toBe(0)
  })

  it('keeps a cleared receipt out of single reads and state writes', async () => {
    const user = await seedUser()
    await publishAnnouncement({ title: '将清理', audience: { kind: 'users', userIds: [user] } })
    await project()
    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    const receiptId = list.items[0]!.receiptId

    const preview = await notifications.service.previewClear(user)
    await notifications.service.clearSnapshot(user, randomUUID(), preview.clearSnapshotToken)

    // 已清理项在列表里已经不可见，单条 GET 与 PATCH 必须与它一致 —— 否则清理就不是真的移除访问路径。
    await expect(notifications.service.detail(user, receiptId)).rejects.toThrowError(
      /NOTIFICATION_NOT_FOUND/,
    )
    await expect(notifications.service.updateState(user, receiptId, true, 0)).rejects.toThrowError(
      /NOTIFICATION_NOT_FOUND/,
    )
  })

  it.each(['clear', 'read_through'] as const)(
    'refuses to reuse a %s request id for the other kind',
    async (firstKind) => {
      const user = await seedUser()
      await publishAnnouncement({ title: '跨 kind', audience: { kind: 'users', userIds: [user] } })
      await project()
      const summary = await notifications.service.summary(user)
      const preview = await notifications.service.previewClear(user)
      const requestId = randomUUID()
      const read = () =>
        notifications.service.readThrough(user, requestId, summary.readThroughToken)
      const clear = () =>
        notifications.service.clearSnapshot(user, requestId, preview.clearSnapshotToken)
      await (firstKind === 'clear' ? clear() : read())
      await expect(firstKind === 'clear' ? read() : clear()).rejects.toThrowError(
        /NOTIFICATION_REQUEST_CONFLICT/,
      )
      const history = await notifications.service.list({
        userId: user,
        view: 'history',
        scope: null,
        category: null,
        limit: null,
        cursor: null,
      })
      expect(history.items).toHaveLength(firstKind === 'clear' ? 0 : 1)
      const records = await db.query<{ kind: string }>(
        'SELECT kind FROM notification_mutations WHERE user_id = $1 AND request_id = $2',
        [user, requestId],
      )
      expect(records.rows).toEqual([{ kind: firstKind }])
    },
  )

  it.each(['clear', 'read_through'] as const)(
    'refuses a historical restore record when submitting %s with the same digest',
    async (kind) => {
      const user = await seedUser()
      await publishAnnouncement({ title: '历史命令', audience: { kind: 'users', userIds: [user] } })
      await project()
      const summary = await notifications.service.summary(user)
      const preview = await notifications.service.previewClear(user)
      const requestId = randomUUID()
      // 同摘要、不同 kind 单独验证 kind 核验，历史行必须被查出并明确冲突。
      const digest =
        kind === 'clear'
          ? normalizeDigest({ kind: 'clear', batchId: preview.batchId })
          : normalizeDigest({ kind: 'read_through', upperSequence: summary.upperSequence })
      await db.query(
        `INSERT INTO notification_mutations (user_id, request_id, kind, digest, result_json,
      clear_batch_id, created_at) VALUES ($1, $2, 'restore', $3, '{}', NULL, $4)`,
        [user, requestId, digest, now()],
      )
      await expect(
        kind === 'clear'
          ? notifications.service.clearSnapshot(user, requestId, preview.clearSnapshotToken)
          : notifications.service.readThrough(user, requestId, summary.readThroughToken),
      ).rejects.toThrowError(/NOTIFICATION_REQUEST_CONFLICT/)
      const history = await notifications.service.list({
        userId: user,
        view: 'history',
        scope: null,
        category: null,
        limit: null,
        cursor: null,
      })
      expect(history.items).toHaveLength(1)
      expect(history.unreadCount).toBe(1)
      const records = await db.query<{ kind: string }>(
        'SELECT kind FROM notification_mutations WHERE user_id = $1 AND request_id = $2',
        [user, requestId],
      )
      expect(records.rows).toEqual([{ kind: 'restore' }])
    },
  )

  it.each(['clear', 'read_through'] as const)(
    'serialises concurrent %s submissions of the same request id',
    async (kind) => {
      const user = await seedUser()
      await publishAnnouncement({ title: '并发', audience: { kind: 'users', userIds: [user] } })
      await project()
      const preview = await notifications.service.previewClear(user)
      const summary = await notifications.service.summary(user)
      const requestId = randomUUID()
      const submit = () =>
        kind === 'clear'
          ? notifications.service.clearSnapshot(user, requestId, preview.clearSnapshotToken)
          : notifications.service.readThrough(user, requestId, summary.readThroughToken)
      const results = await Promise.all([submit(), submit()])
      expect(results.map((result) => result.replayed).sort()).toEqual([false, true])
      expect(results.map((result) => result.affectedCount)).toEqual([1, 1])
      const records = await db.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM notification_mutations WHERE user_id = $1 AND request_id = $2',
        [user, requestId],
      )
      expect(records.rows[0]!.count).toBe('1')
    },
  )

  it('refuses an expired preview token', async () => {
    const user = await seedUser()
    await publishAnnouncement({ audience: { kind: 'users', userIds: [user] } })
    await project()
    const preview = await notifications.service.previewClear(user)

    currentTime += 11 * 60 * 1000
    await expect(
      notifications.service.clearSnapshot(user, randomUUID(), preview.clearSnapshotToken),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_EXPIRED/)
  })

  it('never lets a clear touch another user receipts', async () => {
    const [owner, other] = [await seedUser('owner'), await seedUser('other')]
    await publishAnnouncement({ title: 'owner-1', audience: { kind: 'users', userIds: [owner] } })
    await publishAnnouncement({ title: 'other-1', audience: { kind: 'users', userIds: [other] } })
    await project()

    const preview = await notifications.service.previewClear(owner)
    expect(preview.itemCount).toBe(1)
    const cleared = await notifications.service.clearSnapshot(
      owner,
      randomUUID(),
      preview.clearSnapshotToken,
    )
    expect(cleared.affectedCount).toBe(1)

    const otherHistory = await notifications.service.list({
      userId: other,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    expect(otherHistory.items).toHaveLength(1)

    await expect(
      notifications.service.clearSnapshot(other, randomUUID(), preview.clearSnapshotToken),
    ).rejects.toThrowError(/NOTIFICATION_TOKEN_INVALID/)
  })
})

describe('preferences', () => {
  it('returns defaults for a user with no stored row', async () => {
    const user = await seedUser()
    const preferences = await notifications.service.getPreferences(user)
    expect(preferences.revision).toBe(0)
    expect(preferences.optionalCategories).toEqual({ announcement: true, personal_update: true })
    expect(preferences.necessaryCategories).toEqual(['service_notice'])
  })

  it('stores an update and refuses a stale revision', async () => {
    const user = await seedUser()
    const saved = await notifications.service.updatePreferences(user, 0, {
      announcement: false,
      personal_update: true,
    })
    expect(saved.revision).toBe(1)
    const read = await notifications.service.getPreferences(user)
    expect(read.optionalCategories.announcement).toBe(false)
    await expect(
      notifications.service.updatePreferences(user, 0, {
        announcement: true,
        personal_update: true,
      }),
    ).rejects.toThrowError(/NOTIFICATION_PREFERENCES_CONFLICT/)
  })
})

describe('action registry', () => {
  it('reports business commands as unsupported instead of pretending they work', async () => {
    const user = await seedUser()
    await notifications.producer.publish({
      eventType: 'community.announcement.published',
      dedupeKey: 'actions',
      actorUserId: null,
      audience: { kind: 'users', userIds: [user] },
      content: {
        title: '带按钮',
        html: RICH_HTML,
        templateId: 'community.announcement',
        templateVersion: 1,
        sourceRevision: 1,
        actionsJson: JSON.stringify([
          {
            kind: 'command',
            actionId: 'join',
            actionType: 'activity.join',
            commandVersion: 1,
            emphasis: 'primary',
          },
          {
            kind: 'navigate',
            actionId: 'go',
            targetKey: 'account.settings',
            emphasis: 'secondary',
          },
        ]),
        availableAt: null,
        expiresAt: null,
      },
      sourceType: 'internal',
      sourceId: 'test',
    })
    await project()
    const list = await notifications.service.list({
      userId: user,
      view: 'history',
      scope: null,
      category: null,
      limit: null,
      cursor: null,
    })
    const detail = await notifications.service.detail(user, list.items[0]!.receiptId)
    expect(detail.actionsAvailable).toBe(true)
    const command = detail.actions.find((action) => action.actionId === 'join')!
    expect(command.enabled).toBe(false)
    expect(command.unavailableReason).toBe('unsupported')
    const navigate = detail.actions.find((action) => action.actionId === 'go')!
    expect(navigate.enabled).toBe(true)
    expect(navigate.navigationTarget).toEqual({ kind: 'internal', path: '/account/profile' })
  })

  it('rejects a publication whose action descriptors are not closed', async () => {
    const user = await seedUser()
    await expect(
      notifications.producer.publish({
        eventType: 'community.announcement.published',
        dedupeKey: 'bad-actions',
        actorUserId: null,
        audience: { kind: 'users', userIds: [user] },
        content: {
          title: '坏按钮',
          html: RICH_HTML,
          templateId: 'community.announcement',
          templateVersion: 1,
          sourceRevision: 1,
          actionsJson: JSON.stringify([
            { kind: 'navigate', actionId: 'go', targetKey: 'https://evil.example.com' },
          ]),
          availableAt: null,
          expiresAt: null,
        },
        sourceType: 'internal',
        sourceId: 'test',
      }),
    ).rejects.toThrowError(NotificationError)
  })
})
