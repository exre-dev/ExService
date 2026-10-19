/**
 * 通知共享 UI 的视图模型与文案。
 *
 * `packages/components` 不访问 API、不定义路由，因此这里的类型只描述**组件需要的形状**，
 * 由 `apps/web` 把 `@workspace/sdk/types` 的 Contract 生成 DTO 映射过来。字段与 Contract
 * 同名同义，任何漂移都会在 `apps/web` 的赋值处被 TypeScript 拒绝。
 *
 * 文案集中在一处：同一句提示在 Popup、历史 Modal 与设置分区里必须是同一句话。
 */

import type { NotificationContentInput } from '@components/src/notifications/notificationContent'

export type NotificationScope = 'community' | 'personal'
export type NotificationCategory = 'announcement' | 'personal_update' | 'service_notice'
export type NotificationNecessity = 'optional' | 'necessary'
export type NotificationHistoryFilter = 'all' | 'unread'
export type NotificationLifecycle = 'active' | 'expired'
export type NotificationActionUnavailableReason =
  'unsupported' | 'expired' | 'forbidden' | 'state_changed'

export interface NotificationItemView {
  receiptId: string
  title: string
  summaryText: string
  scope: NotificationScope
  category: NotificationCategory
  necessity: NotificationNecessity
  sequence: number
  deliveredAt: number
  readAt: number | null
  expired: boolean
  stateRevision: number
}

export interface NotificationActionView {
  actionId: string
  label: string
  emphasis: 'primary' | 'secondary'
  enabled: boolean
  unavailableReason: NotificationActionUnavailableReason | null
  navigationTarget: { kind: 'internal'; path: string } | null
}

export interface NotificationDetailView {
  receiptId: string
  title: string
  scope: NotificationScope
  category: NotificationCategory
  necessity: NotificationNecessity
  sequence: number
  deliveredAt: number
  readAt: number | null
  clearedAt: number | null
  lifecycle: NotificationLifecycle
  stateRevision: number
  clearRevision: number
  contentAvailable: boolean
  content: NotificationContentInput | null
  contentFallbackText: string | null
  actions: NotificationActionView[]
  actionsAvailable: boolean
}

/** 未读计数的展示状态；计数来源失败时展示「未更新」，绝不画成 0。 */
export type NotificationCountState =
  { kind: 'hidden' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; count: number }

export interface NotificationCopy {
  bell: string
  popupTitle: string
  viewAll: string
  historyTitle: string
  historyClose: string
  listColumn: string
  detailColumn: string
  clearAll: string
  readAll: string
  filterLabel: string
  filterAll: string
  filterUnread: string
  retryNextPage: string
  pageRetrying: string
  nextPageError: string
  listLoading: string
  listError: string
  detailLoading: string
  detailError: string
  retryList: string
  retryDetail: string
  markRead: string
  markUnread: string
  expiredBanner: string
  expiredNotCounted: string
  bodyUnavailable: string
  selectPlaceholderBody: string
  emptyUnreadTitle: string
  emptyUnreadBody: string
  emptyUnreadFilteredTitle: string
  emptyUnreadFilteredBody: string
  emptyHistoryTitle: string
  emptyHistoryBody: string
  confirmClearTitle: string
  confirmClearBody: (count: number) => string
  confirmClearExtra: string
  confirmClearNote: string
  confirmReadAllTitle: string
  confirmReadAllBody: (count: number) => string
  confirmSubmit: string
  confirmClearSubmit: string
  confirmReadAllSubmit: string
  cancel: string
  submitting: string
  operationFailed: string
  clearedResult: (affected: number, skipped: number) => string
  readAllResult: string
  previewExpired: string
  cursorExpired: string
  backToList: string
  reasonUnsupported: string
  reasonExpired: string
  reasonForbidden: string
  reasonStateChanged: string
  scopeCommunity: string
  scopePersonal: string
  categoryAnnouncement: string
  categoryPersonalUpdate: string
  categoryServiceNotice: string
  stateUnread: string
  stateRead: string
  stateExpired: string
  necessaryTag: string
  countUnread: (count: number) => string
  countUnknown: string
}

export const notificationCopy: NotificationCopy = {
  bell: '未读通知',
  popupTitle: '未读通知',
  viewAll: '查看全部',
  historyTitle: '通知历史',
  historyClose: '关闭通知历史',
  listColumn: '通知列表',
  detailColumn: '通知正文',
  clearAll: '清理全部',
  readAll: '已读全部',
  filterLabel: '显示',
  filterAll: '全部',
  filterUnread: '未读',
  retryNextPage: '重新加载通知',
  pageRetrying: '正在重新加载…',
  nextPageError: '通知暂时无法继续加载',
  listLoading: '正在加载通知',
  listError: '通知暂时无法加载，计数未更新。',
  detailLoading: '正在加载正文',
  detailError: '正文暂时无法加载。',
  retryList: '重试加载',
  retryDetail: '重试正文',
  markRead: '标为已读',
  markUnread: '标为未读',
  expiredBanner: '这条通知已过期，保留正文供查阅。',
  expiredNotCounted: '过期通知不计入未读。',
  bodyUnavailable: '正文格式暂不可用，以下为完整文字。',
  selectPlaceholderBody: '点击通知查看内容',
  emptyUnreadTitle: '暂时没有未读通知',
  emptyUnreadBody: '有新通知时会显示在这里，历史仍可查看。',
  emptyUnreadFilteredTitle: '暂时没有未读通知',
  emptyUnreadFilteredBody: '当前历史均已读或已过期。可以切回全部历史。',
  emptyHistoryTitle: '还没有通知历史',
  emptyHistoryBody: '收到的公告与个人通知会显示在这里。',
  confirmClearTitle: '清除全部通知？',
  confirmClearBody: (count) =>
    `将清理预览时的 ${count} 条通知，包括未读、已读和过期历史，覆盖所有分页。`,
  confirmClearExtra: '清理后无法恢复。之后到达的通知会保留。',
  confirmClearNote: '清理消息不会取消活动参与。',
  confirmReadAllTitle: '全部标为已读？',
  confirmReadAllBody: (count) =>
    `将预览上界内的 ${count} 条未读通知标为已读，包含未加载的分页。新到通知保留未读。`,
  confirmSubmit: '确认',
  confirmClearSubmit: '确认清理',
  confirmReadAllSubmit: '确认全部已读',
  cancel: '取消',
  submitting: '正在提交，请稍候。',
  operationFailed: '操作失败，原状态已保留。请重试。',
  clearedResult: (affected, skipped) =>
    `已清理 ${affected} 条，跳过 ${skipped} 条；新到通知仍保留。`,
  readAllResult: '已标记本次选定通知，新到通知仍未读。',
  previewExpired: '预览已过期，请重新预览。',
  cursorExpired: '分页游标已过期，已刷新第一页。',
  backToList: '返回列表',
  reasonUnsupported: '此操作尚未接入。',
  reasonExpired: '通知已过期。',
  reasonForbidden: '权限已变化。',
  reasonStateChanged: '状态已变化，请刷新后核对。',
  scopeCommunity: '社区',
  scopePersonal: '个人',
  categoryAnnouncement: '全站公告',
  categoryPersonalUpdate: '个人通知',
  categoryServiceNotice: '服务通知',
  stateUnread: '未读',
  stateRead: '已读',
  stateExpired: '已过期',
  necessaryTag: '必要通知',
  countUnread: (count) => `未读通知，${count} 条`,
  countUnknown: '未读通知，计数未更新',
}

export function notificationCategoryLabel(category: NotificationCategory): string {
  if (category === 'announcement') return notificationCopy.categoryAnnouncement
  if (category === 'personal_update') return notificationCopy.categoryPersonalUpdate
  return notificationCopy.categoryServiceNotice
}

export function notificationStateLabel(item: { readAt: number | null; expired: boolean }): string {
  if (item.expired) return notificationCopy.stateExpired
  return item.readAt === null ? notificationCopy.stateUnread : notificationCopy.stateRead
}

export function notificationActionReasonLabel(
  reason: NotificationActionUnavailableReason | null,
): string {
  if (reason === 'unsupported') return notificationCopy.reasonUnsupported
  if (reason === 'expired') return notificationCopy.reasonExpired
  if (reason === 'forbidden') return notificationCopy.reasonForbidden
  if (reason === 'state_changed') return notificationCopy.reasonStateChanged
  return ''
}

/** 未读徽标：`99+` 封顶，与服务端「返回安全整数」的约定一致。 */
export function formatUnreadBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/**
 * 通知时间：同一年内只显示「M 月 D 日」，跨年补上年份。
 *
 * 用固定格式而不是 `toLocaleString`，避免不同 locale 下宽度差异把 320px 布局撑破。
 */
export function formatNotificationTime(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const reference = new Date(now)
  if (date.getFullYear() === reference.getFullYear()) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
  }
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function isNotificationUnread(item: { readAt: number | null; expired: boolean }): boolean {
  return item.readAt === null && !item.expired
}
