import { createContext, useContext, type ReactNode } from 'react'
import { NotificationBell, NotificationHistoryModal } from '@workspace/components'
import { useNotificationsController } from '@web/src/notifications/useNotificationsController'

type NotificationsControllerValue = ReturnType<typeof useNotificationsController>

const NotificationsContext = createContext<NotificationsControllerValue | null>(null)

/**
 * 通知体验的宿主。
 *
 * 状态与 API 都在 `apps/web`，顶栏铃铛与历史 Modal 只是两个渲染出口：
 * 铃铛挂进 `SiteHeader` 的通知槽位，Modal 由 Radix 门户到 body，位置不影响结构。
 *
 * 与 `AuthProvider` 同样的取舍：放在 `RootLayout` 里一次，而不是给顶栏加一个
 * 隐藏的全局 DOM 或第二个通知容器。
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotificationsController()
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

function useNotifications(): NotificationsControllerValue {
  const context = useContext(NotificationsContext)
  if (context === null) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}

/** 顶栏铃铛槽位的内容；未登录时不渲染任何节点。 */
export function NotificationBellSlot() {
  const notifications = useNotifications()
  if (!notifications.authenticated) return null
  return (
    <NotificationBell
      bellRef={notifications.bellRef}
      countState={notifications.countState}
      status={notifications.unreadStatus}
      items={notifications.unreadItems}
      open={notifications.popupOpen}
      onOpenChange={notifications.setPopupOpen}
      onViewAll={notifications.onOpenModal}
      onSelect={(receiptId) => {
        notifications.onOpenModal()
        notifications.onSelect(receiptId)
      }}
      onRetry={notifications.onRetryUnread}
      // 从 Popup 打开 Modal 时不把焦点抢回铃铛：两个交互层不能同时持有焦点。
      restoreFocusOnClose={!notifications.modalOpen}
    />
  )
}

/** 双栏历史 Modal 的挂载点；不新增任何通知页面路由。 */
export function NotificationHistoryModalSlot() {
  const notifications = useNotifications()
  if (!notifications.authenticated) return null
  return (
    <NotificationHistoryModal
      open={notifications.modalOpen}
      onClose={notifications.onCloseModal}
      finalFocusRef={notifications.bellRef}
      selectedId={notifications.selectedId}
      onSelect={notifications.onSelect}
      list={notifications.list}
      detail={notifications.detail}
      bulk={notifications.bulk}
      countState={notifications.countState}
      confirm={notifications.confirm}
    />
  )
}
