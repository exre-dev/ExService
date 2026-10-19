import { proxy } from 'valtio'
import type { components } from '@workspace/sdk/types'
import { sessionScopeRevision } from '@web/src/auth/storage'

export type NotificationItem = components['schemas']['NotificationItem']
export type NotificationDetail = components['schemas']['NotificationDetail']
export type NotificationSummary = components['schemas']['NotificationSummary']
export type NotificationPreferences = components['schemas']['NotificationPreferences']

export type NotificationPageStatus = 'idle' | 'loading' | 'ready' | 'error'
export type NotificationNextPageStatus = 'idle' | 'loading' | 'error'

export interface NotificationPageSlice {
  status: NotificationPageStatus
  items: NotificationItem[]
  nextCursor: string | null
  upperSequence: number
  readThroughToken: string | null
  nextPageStatus: NotificationNextPageStatus
  error: string | null
}

/**
 * 通知的全局状态。
 *
 * 与 `settingsConfig` 一样独立于 `AuthContext`：认证只负责「你是谁」，通知数据按
 * **身份代次**绑定，换号/退出/会话失效时整片清空，不落 localStorage。
 *
 * 通知切片与资料切片互不共享代次：一边的读取或保存失败不得阻塞另一边。
 */
export const notificationsConfig = proxy({
  /**
   * 身份代次，随 `bindNotificationsToken` 递增。
   *
   * 放进 proxy 是为了让 React 侧能感知换号/退出：valtio 的 `snapshot` 能清掉服务器数据，
   * 但清不掉 React Hook Form 里的**草稿**。消费方必须把它当身份输入，变化时丢弃草稿。
   */
  epoch: 0,
  summary: {
    status: 'idle' as NotificationPageStatus,
    unreadCount: 0,
    /** 仅用于「全部已读」的签名上界令牌；与清理预览令牌用途独立，不可互换。 */
    readThroughToken: null as string | null,
    error: null as string | null,
  },
  unread: emptyPage(),
  history: emptyPage(),
  preferences: {
    status: 'idle' as NotificationPageStatus,
    snapshot: null as NotificationPreferences | null,
    error: null as string | null,
    saving: false,
    conflict: false,
  },
})

function emptyPage(): NotificationPageSlice {
  return {
    status: 'idle',
    items: [],
    nextCursor: null,
    upperSequence: 0,
    readThroughToken: null,
    nextPageStatus: 'idle',
    error: null,
  }
}

/*
 * 代次（generation）规则
 * ----------------------
 * `epoch`   —— 身份代次。换号、退出、明确会话失效都会递增，之后所有在途响应一律丢弃。
 * `seq`     —— 写代次。任何批量/单项写操作开始时递增；它之前发起的读响应即视为过期，
 *              因为读到的快照已经不能描述「写之后」的状态。
 *
 * 写响应只在自己仍是最新写时代次时落地：因此迟到的清理响应不会覆盖之后的清理，
 * 迟到的已读响应不会覆盖之后另一设备标未读的结果。
 */

export interface NotificationGeneration {
  epoch: number
  seq: number
}

let ownerToken: string | null = null
let ownerScope = sessionScopeRevision()
let epoch = 0
let seq = 0

export function bindNotificationsToken(token: string | null) {
  const scope = sessionScopeRevision()
  if (ownerToken === token && ownerScope === scope) return
  ownerToken = token
  ownerScope = scope
  epoch += 1
  notificationsConfig.epoch = epoch
  notificationsConfig.summary.status = token === null ? 'idle' : 'loading'
  notificationsConfig.summary.unreadCount = 0
  notificationsConfig.summary.readThroughToken = null
  notificationsConfig.summary.error = null
  notificationsConfig.unread = emptyPage()
  notificationsConfig.history = emptyPage()
  notificationsConfig.preferences.status = 'idle'
  notificationsConfig.preferences.snapshot = null
  notificationsConfig.preferences.error = null
  notificationsConfig.preferences.saving = false
  notificationsConfig.preferences.conflict = false
}

/** 读请求：记录当前身份代次与写代次。 */
export function captureNotificationRead(): NotificationGeneration {
  return { epoch, seq }
}

/** 写请求：递增写代次，让此前所有在途读响应立即过期。 */
export function captureNotificationWrite(): NotificationGeneration {
  seq += 1
  return { epoch, seq }
}

export function isCurrentNotificationGeneration(generation: NotificationGeneration): boolean {
  return ownerScope === sessionScopeRevision() && generation.epoch === epoch && generation.seq === seq
}

/** 未读计数的展示态：失败时是「未更新」，绝不画成 0。 */
export function notificationCountState():
  { kind: 'hidden' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; count: number } {
  const summary = notificationsConfig.summary
  if (ownerToken === null) return { kind: 'hidden' }
  if (summary.status === 'error') return { kind: 'error' }
  if (summary.status !== 'ready') return { kind: 'loading' }
  return { kind: 'ready', count: summary.unreadCount }
}

/** 合并一页到既有列表：按 receiptId 去重，服务端不保证后续页不重复。 */
export function mergeNotificationPage(
  page: NotificationPageSlice,
  result: {
    items: NotificationItem[]
    nextCursor: string | null
    upperSequence: number
    readThroughToken: string
  },
): NotificationItem[] {
  const seen = new Set(page.items.map((item) => item.receiptId))
  const merged = [...page.items]
  for (const item of result.items) {
    if (seen.has(item.receiptId)) continue
    seen.add(item.receiptId)
    merged.push(item)
  }
  return merged
}

/** 应用已接受的全局 summary 读取；命令重放结果不得作为当前计数。 */
export function applyUnreadCount(count: number, readThroughToken?: string | null) {
  notificationsConfig.summary.unreadCount = count
  notificationsConfig.summary.status = 'ready'
  notificationsConfig.summary.error = null
  if (readThroughToken !== undefined && readThroughToken !== null) {
    notificationsConfig.summary.readThroughToken = readThroughToken
  }
}
