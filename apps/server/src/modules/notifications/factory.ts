import { randomUUID } from 'node:crypto'
import type { AppDatabase } from '@server/src/db/client.js'
import { assertActionRegistry } from './actions.js'
import { NotificationProducer } from './producer.js'
import { NotificationProjectionWorker, type ProjectionWorkerOptions } from './projection.js'
import { NotificationRepository } from './repository.js'
import { NotificationService } from './service.js'
import { deriveNotificationTokenKey } from './tokens.js'

export interface NotificationModuleOptions {
  db: AppDatabase
  tokenKey: Buffer
  now?: () => number
  leaseOwner?: string
  workers?: Pick<
    ProjectionWorkerOptions,
    'eventsPerRound' | 'recipientsPerEvent' | 'leaseMs' | 'retryBaseDelayMs'
  >
}

export interface NotificationModule {
  repository: NotificationRepository
  service: NotificationService
  producer: NotificationProducer
  worker: NotificationProjectionWorker
  /** 启动只核对准备状态，不造模型、不回填默认通知。 */
  assertReady(): Promise<void>
  startWorker(intervalMs?: number): () => void
}

export function createNotificationModule(options: NotificationModuleOptions): NotificationModule {
  // registry 缺实现是配置错误，必须在监听前暴露，而不是等到某条通知被读取。
  assertActionRegistry()

  const now = options.now ?? (() => Date.now())
  const repository = new NotificationRepository(options.db)
  const service = new NotificationService({
    repository,
    db: options.db,
    tokenKey: options.tokenKey,
    now,
    createId: () => randomUUID(),
  })
  const producer = new NotificationProducer({ repository, now, createId: () => randomUUID() })
  const worker = new NotificationProjectionWorker({
    repository,
    db: options.db,
    now,
    leaseOwner: options.leaseOwner,
    ...options.workers,
  })

  return {
    repository,
    service,
    producer,
    worker,
    async assertReady() {
      await assertNotificationSchemaAvailable(options.db)
    },
    startWorker(intervalMs = 5_000) {
      let stopped = false
      let timer: NodeJS.Timeout | undefined
      const tick = async () => {
        if (stopped) return
        try {
          const round = await worker.runRound()
          // 有进展时立刻再跑一轮，空闲时才等待，避免固定间隔带来的延迟。
          timer = setTimeout(tick, round.eventsClaimed > 0 ? 0 : intervalMs)
        } catch {
          timer = setTimeout(tick, intervalMs)
        }
      }
      timer = setTimeout(tick, 0)
      return () => {
        stopped = true
        if (timer !== undefined) clearTimeout(timer)
      }
    },
  }
}

export async function assertNotificationSchemaAvailable(db: AppDatabase): Promise<void> {
  const columns = await db.query<{
    table_name: string
    column_name: string
  }>(`SELECT table_name, column_name
    FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name LIKE 'notification_%'`)
  const available = new Map<string, Set<string>>()
  for (const column of columns.rows) {
    const set = available.get(column.table_name) ?? new Set()
    set.add(column.column_name)
    available.set(column.table_name, set)
  }
  const required: Record<string, string[]> = {
    notification_events: ['event_id', 'dedupe_key', 'digest', 'projection_status'],
    notification_event_recipients: ['event_id', 'user_id', 'state'],
    notification_contents: [
      'content_id',
      'html',
      'text',
      'summary_text',
      'category',
      'necessity',
      'withdrawn_at',
    ],
    notification_user_streams: ['user_id', 'last_sequence', 'state_version'],
    notification_receipts: [
      'receipt_id',
      'user_id',
      'content_id',
      'sequence',
      'cleared_at',
      'clear_revision',
    ],
    notification_preferences: [
      'user_id',
      'announcement_enabled',
      'personal_update_enabled',
      'revision',
    ],
    notification_mutations: ['user_id', 'request_id', 'kind', 'digest', 'result_json'],
    notification_clear_batches: ['batch_id', 'user_id', 'status', 'preview_expires_at'],
    notification_clear_batch_items: ['batch_id', 'receipt_id', 'expected_clear_revision'],
  }
  const missing: string[] = []
  for (const [table, names] of Object.entries(required)) {
    const set = available.get(table)
    if (set === undefined) {
      missing.push(table)
      continue
    }
    for (const name of names) {
      if (!set.has(name)) missing.push(`${table}.${name}`)
    }
  }
  if (missing.length > 0) {
    throw new Error(`持久通知数据表缺失（${missing.join(', ')}）；请运行 pnpm db:migrate。`)
  }
}

export { deriveNotificationTokenKey }
