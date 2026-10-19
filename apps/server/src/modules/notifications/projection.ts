import { randomUUID } from 'node:crypto'
import type { AppDatabase, SqlExecutor } from '@server/src/db/client.js'
import type { NotificationRepository } from './repository.js'
import { DEFAULT_PREFERENCES, OPTIONAL_CATEGORIES, isNotificationCategory } from './catalog.js'

/**
 * 持久站内投影 worker。
 *
 * 只消费已提交的事件事实，不扩大受众：受众快照在源事务里就固定了。
 * 每人一次短事务，锁 stream 后分配稳定的个人 sequence 并创建唯一 receipt；
 * 崩溃不会重复投影（receipt 唯一约束 + 受众终态都在同一事务里）。
 *
 * 有界批次、lease token、稳定排序、有限退避与 poison 隔离；suppressed 不算
 * delivered，事件只在全部受众到达终态时才 completed。单实例：Server 关闭时
 * 停止认领并有界等待正在执行的短事务，未完成 lease 由后续运行恢复。
 *
 * **事务回调里的所有 repository 调用都必须显式传 `tx`。** 用默认参数会走连接池里的
 * 另一条连接；一旦本事务已经持有目标行的锁，那条连接会阻塞在锁上，而本事务又在等
 * 它的结果 —— 自锁。`completeEventProjection` 那种**事务提交之后**的调用不在此列。
 */

export interface ProjectionWorkerOptions {
  repository: NotificationRepository
  db: AppDatabase
  now: () => number
  /** 实例标识，用于 lease 归属。 */
  leaseOwner?: string
  leaseMs?: number
  /** 每轮最多处理的事件数。 */
  eventsPerRound?: number
  /** 每个事件每轮最多处理的受众数。 */
  recipientsPerEvent?: number
  /** 失败后的退避基数（毫秒）。 */
  retryBaseDelayMs?: number
  maxAttempts?: number
  createId?: () => string
}

export interface ProjectionRoundResult {
  eventsClaimed: number
  delivered: number
  suppressed: number
  skippedDisabled: number
  expired: number
  withdrawn: number
  eventsCompleted: number
  eventsFailed: number
}

const DEFAULTS = {
  leaseMs: 30_000,
  eventsPerRound: 10,
  recipientsPerEvent: 100,
  retryBaseDelayMs: 1_000,
  maxAttempts: 8,
}

export class NotificationProjectionWorker {
  private readonly options: Required<Omit<ProjectionWorkerOptions, 'leaseOwner'>> & {
    leaseOwner: string
  }

  constructor(options: ProjectionWorkerOptions) {
    this.options = {
      repository: options.repository,
      db: options.db,
      now: options.now,
      leaseOwner: options.leaseOwner ?? `server:${randomUUID()}`,
      leaseMs: options.leaseMs ?? DEFAULTS.leaseMs,
      eventsPerRound: options.eventsPerRound ?? DEFAULTS.eventsPerRound,
      recipientsPerEvent: options.recipientsPerEvent ?? DEFAULTS.recipientsPerEvent,
      retryBaseDelayMs: options.retryBaseDelayMs ?? DEFAULTS.retryBaseDelayMs,
      maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
      createId: options.createId ?? (() => randomUUID()),
    }
  }

  get leaseOwner(): string {
    return this.options.leaseOwner
  }

  async runRound(): Promise<ProjectionRoundResult> {
    const now = this.options.now()
    const result: ProjectionRoundResult = {
      eventsClaimed: 0,
      delivered: 0,
      suppressed: 0,
      skippedDisabled: 0,
      expired: 0,
      withdrawn: 0,
      eventsCompleted: 0,
      eventsFailed: 0,
    }
    const events = await this.options.repository.claimDueEvents(
      this.options.eventsPerRound,
      now,
      this.options.leaseOwner,
      this.options.leaseMs,
    )
    result.eventsClaimed = events.length

    for (const event of events) {
      try {
        const round = await this.projectEvent(event, now)
        result.delivered += round.delivered
        result.suppressed += round.suppressed
        result.skippedDisabled += round.skippedDisabled
        result.expired += round.expired
        result.withdrawn += round.withdrawn
        if (round.completed) result.eventsCompleted += 1
      } catch {
        // 只记录安全分类：异常可能携带 SQL 或连接信息，不得进入日志或响应。
        const attempts = event.projection_attempts + 1
        const delay = Math.min(this.options.retryBaseDelayMs * 2 ** (attempts - 1), 60 * 60 * 1000)
        await this.options.repository.failEventProjection(
          event.event_id,
          this.options.now(),
          attempts,
          'projection_failed',
          delay,
        )
        result.eventsFailed += 1
      }
    }
    return result
  }

  private async projectEvent(
    event: Awaited<ReturnType<NotificationRepository['claimDueEvents']>>[number],
    now: number,
  ): Promise<{
    delivered: number
    suppressed: number
    skippedDisabled: number
    expired: number
    withdrawn: number
    completed: boolean
  }> {
    const totals = {
      delivered: 0,
      suppressed: 0,
      skippedDisabled: 0,
      expired: 0,
      withdrawn: 0,
      completed: false,
    }

    for (;;) {
      const round = await this.options.db.transaction(async (tx) => {
        const counts = {
          delivered: 0,
          suppressed: 0,
          skippedDisabled: 0,
          expired: 0,
          withdrawn: 0,
          remaining: 0,
        }
        const userIds = await this.options.repository.pendingRecipients(
          event.event_id,
          this.options.recipientsPerEvent,
          tx,
        )
        if (userIds.length === 0) return counts

        const content =
          event.content_id === null
            ? undefined
            : await this.options.repository.findContent(event.content_id, tx)
        if (content === undefined || content.withdrawn_at !== null) {
          for (const userId of userIds) {
            await this.options.repository.markRecipient(
              event.event_id,
              userId,
              'withdrawn',
              null,
              now,
              tx,
            )
            counts.withdrawn += 1
          }
          counts.remaining = await remainingPending(event.event_id, tx)
          return counts
        }
        if (content.available_at > now) {
          // 尚未生效：释放 lease 并推迟到生效时刻，不消耗失败预算，避免每轮空转。
          // 必须走事务连接：走默认连接会在事务外另起一条连接改同一行，
          // 一旦本事务也持有该行的锁就是自锁。
          await this.options.repository.deferEventProjection(
            event.event_id,
            content.available_at,
            tx,
          )
          counts.remaining = userIds.length
          return counts
        }

        for (const userId of userIds.sort()) {
          const active = await this.options.repository.lockUser(userId, tx)
          if (!active) {
            await this.options.repository.markRecipient(
              event.event_id,
              userId,
              'skipped_disabled',
              null,
              now,
              tx,
            )
            counts.skippedDisabled += 1
            continue
          }
          if (content.expires_at !== null && content.expires_at <= now) {
            await this.options.repository.markRecipient(
              event.event_id,
              userId,
              'expired',
              null,
              now,
              tx,
            )
            counts.expired += 1
            continue
          }
          if (!(await preferenceAllows(this.options.repository, userId, content.category, tx))) {
            await this.options.repository.markRecipient(
              event.event_id,
              userId,
              'suppressed_preference',
              null,
              now,
              tx,
            )
            counts.suppressed += 1
            continue
          }

          const stream = await this.options.repository.lockStream(userId, tx)
          const sequence = stream.lastSequence + 1
          const receiptId = this.options.createId()
          await this.options.repository.insertReceipt(
            {
              receiptId,
              userId,
              contentId: content.content_id,
              eventId: event.event_id,
              sequence,
              scope: content.scope,
              deliveredAt: now,
            },
            tx,
          )
          await tx.query(
            'UPDATE notification_user_streams SET last_sequence = $2 WHERE user_id = $1',
            [userId, sequence],
          )
          await this.options.repository.markRecipient(
            event.event_id,
            userId,
            'delivered',
            receiptId,
            now,
            tx,
          )
          counts.delivered += 1
        }

        counts.remaining = await remainingPending(event.event_id, tx)
        return counts
      })

      totals.delivered += round.delivered
      totals.suppressed += round.suppressed
      totals.skippedDisabled += round.skippedDisabled
      totals.expired += round.expired
      totals.withdrawn += round.withdrawn

      if (round.remaining === 0) {
        await this.options.repository.completeEventProjection(event.event_id, this.options.now())
        totals.completed = true
        return totals
      }
      // 本轮只处理有界批次，剩余受众留给下一轮，不在一个事务里做大规模 fanout。
      if (
        round.delivered +
          round.suppressed +
          round.skippedDisabled +
          round.expired +
          round.withdrawn ===
        0
      ) {
        return totals
      }
    }
  }
}

async function remainingPending(eventId: string, tx: SqlExecutor): Promise<number> {
  const result = await tx.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM notification_event_recipients WHERE event_id = $1 AND state = 'pending'`,
    [eventId],
  )
  return Number(result.rows[0]?.count ?? 0)
}

/** 必要类别不能被偏好关闭；可选类别按本人偏好裁决，无行按默认开启。 */
async function preferenceAllows(
  repository: NotificationRepository,
  userId: string,
  category: string,
  tx: SqlExecutor,
): Promise<boolean> {
  if (!isNotificationCategory(category)) return false
  if (!OPTIONAL_CATEGORIES.includes(category)) return true
  const stored = await repository.getPreferences(userId, tx)
  if (stored === undefined) return DEFAULT_PREFERENCES[category]
  if (category === 'announcement') return stored.announcementEnabled
  if (category === 'personal_update') return stored.personalUpdateEnabled
  return true
}
