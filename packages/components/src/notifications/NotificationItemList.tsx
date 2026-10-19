import type { ReactNode } from 'react'
import { Item, ItemContent, ItemDescription, ItemGroup } from '@exre/exui'
import {
  formatNotificationTime,
  isNotificationUnread,
  notificationCategoryLabel,
  notificationStateLabel,
  type NotificationItemView,
} from '@components/src/notifications/notificationsView'
import styles from '@components/src/notifications/NotificationItemList.module.scss'

export interface NotificationItemListProps {
  items: NotificationItemView[]
  selectedId: string | null
  onSelect: (receiptId: string) => void
  /** 空态由调用方决定：未读、历史与不同筛选下的文案都不同。 */
  empty?: ReactNode
  /** 截断显示条数（Popup 只展示前几条），不传则展示全部。 */
  limit?: number
  id?: string
}

/**
 * 通知列表：由 ExUI 的 `ItemGroup` / `Item` / `ItemContent` / `ItemDescription` 组合而成。
 *
 * 约束（与设计要求一致）：
 *
 * - 标题是一个独立原生按钮，与任何动作按钮是**兄弟**关系，不嵌套交互元素；
 * - 不使用 `listbox` / `option`，避免把多个交互控件塞进一个 option；
 * - 未读不靠颜色单独表达：meta 行同时给出可读的「未读 / 已读 / 已过期」文本；
 * - 选中项通过 `aria-current` 表达，供屏幕阅读器与样式共用。
 */
export function NotificationItemList({
  items,
  selectedId,
  onSelect,
  empty,
  limit,
  id,
}: NotificationItemListProps) {
  const visible = limit === undefined ? items : items.slice(0, limit)

  if (visible.length === 0) {
    return <div className={styles.emptySlot}>{empty ?? null}</div>
  }

  return (
    <ItemGroup id={id} className={styles.group} aria-label="通知条目">
      {visible.map((item) => {
        const unread = isNotificationUnread(item)
        const selected = item.receiptId === selectedId
        return (
          <Item
            key={item.receiptId}
            role="listitem"
            className={`${styles.item}${unread ? ` ${styles.unread}` : ''}${selected ? ` ${styles.selected}` : ''}`}
          >
            <ItemContent className={styles.content}>
              <button
                type="button"
                className={styles.titleButton}
                data-notification-select={item.receiptId}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(item.receiptId)}
              >
                <span className={styles.title}>{item.title}</span>
              </button>
              {item.summaryText.length > 0 && (
                <ItemDescription className={styles.summary}>{item.summaryText}</ItemDescription>
              )}
              <div className={styles.meta}>
                <span className={styles.tag}>{notificationCategoryLabel(item.category)}</span>
                <span className={unread ? styles.unreadState : styles.state}>
                  {notificationStateLabel(item)}
                </span>
                <time className={styles.time} dateTime={new Date(item.deliveredAt).toISOString()}>
                  {formatNotificationTime(item.deliveredAt)}
                </time>
              </div>
            </ItemContent>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
