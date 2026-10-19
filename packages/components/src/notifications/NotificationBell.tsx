import { useId, useRef, type RefObject, type ReactNode } from 'react'
import { Bell } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger, Skeleton } from '@exre/exui'
import { NotificationItemList } from '@components/src/notifications/NotificationItemList'
import {
  formatUnreadBadge,
  type NotificationCountState,
  type NotificationItemView,
} from '@components/src/notifications/notificationsView'
import styles from '@components/src/notifications/NotificationBell.module.scss'

export type NotificationPopupStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface NotificationBellProps {
  countState: NotificationCountState
  status: NotificationPopupStatus
  items: NotificationItemView[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewAll: () => void
  onSelect: (receiptId: string) => void
  onRetry: () => void
  /**
   * Popup 关闭后是否把焦点交回铃铛。
   *
   * Esc 与外部点击都需要回到铃铛；但从 Popup 打开历史 Modal 时必须关掉，
   * 否则两个交互层会争抢焦点。
   */
  restoreFocusOnClose?: boolean
  /**
   * 铃铛按钮的引用，供历史 Modal 关闭时把焦点交回这里。
   *
   * 顶栏是唯一的铃铛宿主，跨层关闭必须回到同一个元素。
   */
  bellRef?: RefObject<HTMLButtonElement | null>
}

/** 顶栏铃铛与**仅未读** Popup。打开不改状态、不把计数归零。 */
export function NotificationBell({
  countState,
  status,
  items,
  open,
  onOpenChange,
  onViewAll,
  onSelect,
  onRetry,
  restoreFocusOnClose = true,
  bellRef,
}: NotificationBellProps) {
  const titleId = useId()
  const viewAll = useRef<HTMLButtonElement>(null)
  const fallbackBell = useRef<HTMLButtonElement>(null)
  const bell = bellRef ?? fallbackBell

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={bell as RefObject<HTMLButtonElement | null>}
          type="button"
          variant="ghost"
          size="icon"
          className={styles.bell}
          aria-label={bellLabel(countState)}
        >
          <Bell aria-hidden="true" />
          {(countState.kind === 'loading' ||
            countState.kind === 'error' ||
            (countState.kind === 'ready' && countState.count > 0)) && (
            <span className={styles.badge} data-tone={badgeTone(countState)} aria-hidden="true">
              {badgeText(countState)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={styles.popup}
        aria-labelledby={titleId}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          // 打开后落在「查看全部」：空态也保留这个入口，因此它始终存在。
          event.preventDefault()
          viewAll.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (restoreFocusOnClose) {
            bell.current?.focus()
          }
        }}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            未读通知
          </h2>
          <Button ref={viewAll} type="button" variant="ghost" size="sm" onClick={onViewAll}>
            查看全部
          </Button>
        </div>
        <div className={styles.scroll}>
          {status === 'error' ? (
            <div className={styles.notice} role="alert">
              <p>{'通知暂时无法加载，计数未更新。'}</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                重试加载
              </Button>
            </div>
          ) : status === 'loading' || (status === 'idle' && items.length === 0) ? (
            <div role="status" aria-label="正在加载通知" className={styles.skeletons}>
              <Skeleton className={styles.skeleton} />
              <Skeleton className={styles.skeleton} />
              <Skeleton className={styles.skeleton} />
            </div>
          ) : (
            <NotificationItemList
              items={items}
              selectedId={null}
              onSelect={onSelect}
              limit={5}
              empty={
                <div className={styles.empty}>
                  <h3 className={styles.emptyTitle}>暂时没有未读通知</h3>
                  <p className={styles.emptyBody}>有新通知时会显示在这里，历史仍可查看。</p>
                </div>
              }
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function bellLabel(state: NotificationCountState): string {
  if (state.kind === 'ready') return `未读通知，${state.count} 条`
  if (state.kind === 'hidden') return '未读通知'
  return '未读通知，计数未更新'
}

function badgeText(state: NotificationCountState): string {
  if (state.kind === 'error') return '!'
  if (state.kind === 'loading') return '…'
  if (state.kind === 'ready') return formatUnreadBadge(state.count)
  return ''
}

function badgeTone(state: NotificationCountState): string {
  return state.kind === 'error' ? 'error' : 'default'
}
