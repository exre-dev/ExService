import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, ChevronLeft } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useIsMobile,
} from '@exre/exui'
import {
  NotificationBody,
  hasRenderableNotificationBody,
} from '@components/src/notifications/NotificationBody'
import { NotificationItemList } from '@components/src/notifications/NotificationItemList'
import {
  formatNotificationTime,
  notificationActionReasonLabel,
  notificationCategoryLabel,
  notificationCopy,
  notificationStateLabel,
  type NotificationCountState,
  type NotificationDetailView,
  type NotificationHistoryFilter,
  type NotificationItemView,
} from '@components/src/notifications/notificationsView'
import styles from '@components/src/notifications/NotificationHistoryModal.module.scss'

export type NotificationAsyncStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface NotificationListSlice {
  status: NotificationAsyncStatus
  items: NotificationItemView[]
  hasMore: boolean
  canAutoLoad: boolean
  resetVersion: number
  nextPageStatus: 'idle' | 'loading' | 'error'
  filter: NotificationHistoryFilter
  onFilterChange: (filter: NotificationHistoryFilter) => void
  onLoadMore: () => void
  onRetryPage: () => void
  onRetry: () => void
}

export interface NotificationDetailSlice {
  status: NotificationAsyncStatus
  value: NotificationDetailView | null
  readPending: boolean
  readError: string | null
  onToggleRead: () => void
  onRetryRead: () => void
  onRetryDetail: () => void
  onNavigate: (path: string) => void
}

export interface NotificationBulkSlice {
  pending: 'read-all' | 'clear' | null
  preparing: 'read-all' | 'clear' | null
  error: string | null
  onReadAll: () => void
  onClearAll: () => void
}

export interface NotificationConfirmSlice {
  kind: 'clear' | 'read-all' | null
  count: number
  pending: boolean
  expired: boolean
  error: string | null
  onCancel: () => void
  onSubmit: () => void
}

export interface NotificationHistoryModalProps {
  open: boolean
  onClose: () => void
  countState: NotificationCountState
  selectedId: string | null
  onSelect: (receiptId: string) => void
  list: NotificationListSlice
  detail: NotificationDetailSlice
  bulk: NotificationBulkSlice
  confirm: NotificationConfirmSlice
  finalFocusRef?: React.RefObject<HTMLElement | null>
}

/** Shared UI owns geometry and focus; the Website controller owns requests and count authority. */
export function NotificationHistoryModal(props: NotificationHistoryModalProps) {
  const narrow = useIsMobile()
  const [detailMode, setDetailMode] = useState(props.selectedId !== null)
  const listScroll = useRef<HTMLDivElement>(null)
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null)
  const bindListScroll = useCallback((element: HTMLDivElement | null) => {
    listScroll.current = element
    setListElement(element)
  }, [])
  const sentinel = useRef<HTMLDivElement>(null)
  const tabList = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)
  const savedFilter = useRef(props.list.filter)
  const restoreList = useRef(false)
  const lastPreparation = useRef<'read-all' | 'clear' | null>(null)
  const listVisible = !narrow || !detailMode

  useLayoutEffect(() => {
    if (!props.open) {
      setDetailMode(false)
      savedScrollTop.current = 0
    } else if (props.selectedId !== null) setDetailMode(true)
    else setDetailMode(false)
  }, [props.open, props.selectedId])

  useLayoutEffect(() => {
    if (listScroll.current) listScroll.current.scrollTop = 0
    // Background writes replace the page while the phone body is open;
    // preserve its return position until Back, but reset on a filter change.
    if (savedFilter.current !== props.list.filter || !detailMode) savedScrollTop.current = 0
    savedFilter.current = props.list.filter
  }, [props.list.filter, props.list.resetVersion])

  useLayoutEffect(() => {
    if (!listVisible || !restoreList.current) return
    restoreList.current = false
    if (listScroll.current) listScroll.current.scrollTop = savedScrollTop.current
    const row = Array.from(
      listScroll.current?.querySelectorAll<HTMLElement>('[data-notification-select]') ?? [],
    ).find((element) => element.dataset.notificationSelect === props.selectedId)
    const target = row ?? tabList.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    target?.focus({ preventScroll: true })
  }, [listVisible, props.selectedId])

  useEffect(() => {
    const root = listElement,
      target = sentinel.current
    if (
      !props.open ||
      !listVisible ||
      !props.list.canAutoLoad ||
      !props.list.hasMore ||
      props.list.nextPageStatus !== 'idle' ||
      props.confirm.kind !== null ||
      props.bulk.preparing !== null ||
      props.bulk.pending !== null ||
      !root ||
      !target
    )
      return
    let fired = false
    let active = true
    let frame = 0
    const load = () => {
      if (!active || fired) return
      fired = true
      props.list.onLoadMore()
    }
    const check = () => {
      const container = root.getBoundingClientRect(),
        end = target.getBoundingClientRect()
      if (container.height > 0 && end.top <= container.bottom && end.bottom >= container.top) load()
    }
    const schedule = () => {
      if (!active) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(check)
    }
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) load()
            },
            { root, rootMargin: '0px' },
          )
    observer?.observe(target)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resize?.observe(root)
    root.addEventListener('scroll', schedule)
    // Recheck each accepted page, even if a short page never changes intersection.
    schedule()
    return () => {
      active = false
      observer?.disconnect()
      resize?.disconnect()
      cancelAnimationFrame(frame)
      root.removeEventListener('scroll', schedule)
    }
  }, [
    listElement,
    props.open,
    listVisible,
    props.list.items,
    props.list.filter,
    props.list.resetVersion,
    props.list.canAutoLoad,
    props.list.hasMore,
    props.list.nextPageStatus,
    props.list.onLoadMore,
    props.confirm.kind,
    props.bulk.preparing,
    props.bulk.pending,
  ])

  const select = (receiptId: string) => {
    savedScrollTop.current = listScroll.current?.scrollTop ?? 0
    setDetailMode(true)
    props.onSelect(receiptId)
  }
  const backToList = () => {
    restoreList.current = true
    setDetailMode(false)
  }
  const operation = props.confirm.kind ?? props.bulk.preparing ?? props.bulk.pending
  useEffect(() => {
    if (!props.open) lastPreparation.current = null
    else if (operation !== null) lastPreparation.current = operation
  }, [operation, props.open])
  const count = props.countState.kind === 'ready' ? props.countState.count : null
  const ready = count !== null
  const readAll = operation === 'read-all' || (operation === null && count !== null && count > 0)
  const knownEmptyHistory =
    props.list.filter === 'all' &&
    props.list.status === 'ready' &&
    props.list.items.length === 0 &&
    !props.list.hasMore &&
    props.list.nextPageStatus === 'idle'
  const disabled = !ready || operation !== null || (!readAll && knownEmptyHistory)
  const label = operation === null && !ready ? '加载中…' : readAll ? '已读全部' : '清理全部'
  const retryKind = lastPreparation.current ?? (ready ? (readAll ? 'read-all' : 'clear') : null)

  const blockClose = props.bulk.pending !== null || props.confirm.kind !== null

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && !blockClose) props.onClose()
      }}
    >
      <DialogContent
        className={styles.modal}
        responsiveFullscreen
        closeLabel="关闭通知历史"
        style={narrow ? { width: '100vw', maxWidth: '100vw' } : undefined}
        closeButtonDisabled={props.bulk.pending !== null}
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (blockClose) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (blockClose) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          props.finalFocusRef?.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>通知历史</DialogTitle>
        </DialogHeader>
        <DialogBody className={styles.modalBody}>
          <div
            className={styles.grid}
            data-layout={narrow ? 'narrow' : 'wide'}
            data-detail-mode={detailMode || undefined}
          >
            <section className={styles.listColumn} aria-label="通知列表">
              <Tabs
                className={styles.listTabs}
                value={props.list.filter}
                onValueChange={(value) => {
                  if (value !== 'all' && value !== 'unread') return
                  setDetailMode(false)
                  props.list.onFilterChange(value)
                }}
              >
                <div className={styles.listTools}>
                  <TabsList
                    ref={tabList}
                    variant="default"
                    aria-label="通知筛选"
                    className={styles.tabList}
                  >
                    <TabsTrigger value="all" className={styles.tabTrigger}>
                      全部
                    </TabsTrigger>
                    <TabsTrigger value="unread" className={styles.tabTrigger}>
                      未读
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    type="button"
                    variant={readAll ? 'outline' : 'ghost'}
                    size="sm"
                    disabled={disabled}
                    className={readAll ? undefined : styles.clearAllButton}
                    onClick={readAll ? props.bulk.onReadAll : props.bulk.onClearAll}
                  >
                    {label}
                  </Button>
                </div>
                {props.bulk.error && (
                  <div role="alert" className={styles.pageError}>
                    <p>{props.bulk.error}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={operation !== null || retryKind === null}
                      onClick={
                        retryKind === 'read-all' ? props.bulk.onReadAll : props.bulk.onClearAll
                      }
                    >
                      重新准备
                    </Button>
                  </div>
                )}
                <TabsContent
                  ref={bindListScroll}
                  value={props.list.filter}
                  className={styles.listScroll}
                >
                  {props.list.status === 'error' ? (
                    <div className={styles.notice} role="alert">
                      <p>通知暂时无法加载，计数未更新。</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={props.list.onRetry}
                      >
                        重试加载
                      </Button>
                    </div>
                  ) : props.list.status !== 'ready' ? (
                    <div role="status" aria-label="正在加载通知" className={styles.skeletons}>
                      <Skeleton className={styles.skeleton} />
                      <Skeleton className={styles.skeleton} />
                      <Skeleton className={styles.skeleton} />
                    </div>
                  ) : (
                    <>
                      <NotificationItemList
                        items={props.list.items}
                        selectedId={props.selectedId}
                        onSelect={select}
                        empty={listEmptyState(props.list.filter)}
                      />
                      {props.list.nextPageStatus === 'loading' && (
                        <p className={styles.pageRetrying} role="status">
                          {props.list.hasMore ? '正在加载…' : notificationCopy.pageRetrying}
                        </p>
                      )}
                      {props.list.nextPageStatus === 'error' && (
                        <div role="alert" className={styles.pageError}>
                          <p>{notificationCopy.nextPageError}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={props.list.onRetryPage}
                          >
                            {notificationCopy.retryNextPage}
                          </Button>
                        </div>
                      )}
                      {props.list.hasMore && (
                        <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </section>
            <section className={styles.detailColumn} aria-label="通知正文">
              {detailMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={styles.backButton}
                  onClick={backToList}
                >
                  <ChevronLeft aria-hidden="true" />
                  返回列表
                </Button>
              )}
              <DetailPane {...props} narrow={narrow} />
            </section>
          </div>
        </DialogBody>
        <ConfirmDialog {...props.confirm} />
      </DialogContent>
    </Dialog>
  )
}

function DetailPane(props: NotificationHistoryModalProps & { narrow: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { detail, list, selectedId } = props
  const item = list.items.find((entry) => entry.receiptId === selectedId) ?? null
  const value = detail.value !== null && detail.value.receiptId === selectedId ? detail.value : null

  useEffect(() => {
    if (selectedId !== null && props.narrow) heading.current?.focus()
  }, [selectedId, props.narrow])

  if (selectedId === null) {
    return (
      <div className={styles.detailEmpty}>
        <Bell aria-hidden="true" className={styles.emptyIcon} />
        <p className={styles.emptyBody}>点击通知查看内容</p>
      </div>
    )
  }

  // 标题与元信息优先取列表条目：正文还在加载时右侧也已经可用，焦点目标因此稳定。
  const meta: NotificationItemView | null =
    item ??
    (value === null
      ? null
      : {
          receiptId: value.receiptId,
          title: value.title,
          summaryText: '',
          scope: value.scope,
          category: value.category,
          necessity: value.necessity,
          sequence: value.sequence,
          deliveredAt: value.deliveredAt,
          readAt: value.readAt,
          expired: value.lifecycle === 'expired',
          stateRevision: value.stateRevision,
        })
  const retryDetail = (
    <div className={styles.notice} role="alert">
      <p>正文暂时无法加载。</p>
      <Button type="button" variant="outline" size="sm" onClick={detail.onRetryDetail}>
        重试正文
      </Button>
    </div>
  )

  return (
    <article className={styles.detail}>
      {meta && <span className={styles.typeTag}>{notificationCategoryLabel(meta.category)}</span>}
      <h2 ref={heading} tabIndex={-1} className={styles.detailTitle}>
        {meta?.title ?? ''}
      </h2>
      {meta && (
        <div className={styles.detailMeta}>
          <time dateTime={new Date(meta.deliveredAt).toISOString()}>
            {formatNotificationTime(meta.deliveredAt)}
          </time>
          <span>{notificationStateLabel(meta)}</span>
          {meta.necessity === 'necessary' && <Badge variant="secondary">必要通知</Badge>}
        </div>
      )}

      {detail.status === 'loading' && (
        <div role="status" aria-label="正在加载正文">
          <Skeleton className={styles.bodySkeleton} />
        </div>
      )}
      {detail.status === 'error' && retryDetail}
      {detail.status === 'ready' && value !== null && (
        <>
          {value.lifecycle === 'expired' && (
            <p className={styles.expiredBanner}>这条通知已过期，保留正文供查阅。</p>
          )}
          {hasRenderableNotificationBody(value.content, value.contentFallbackText) ? (
            <NotificationBody content={value.content} fallbackText={value.contentFallbackText} />
          ) : (
            retryDetail
          )}
          <ActionRow
            detail={detail}
            disabled={
              props.bulk.pending !== null ||
              props.bulk.preparing !== null ||
              props.confirm.kind !== null
            }
          />
          <div className={styles.readTools}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                detail.readPending ||
                props.bulk.pending !== null ||
                props.bulk.preparing !== null ||
                props.confirm.kind !== null
              }
              onClick={detail.onToggleRead}
            >
              {value.readAt === null ? '标为已读' : '标为未读'}
            </Button>
            {value.lifecycle === 'expired' && (
              <span className={styles.hint}>过期通知不计入未读。</span>
            )}
          </div>
          {detail.readError && (
            <div className={styles.notice} role="alert">
              <p>{detail.readError}</p>
              <Button type="button" variant="ghost" size="sm" onClick={detail.onRetryRead}>
                重试标为已读
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  )
}

/**
 * Action 按钮只执行导航，不冒泡为「选中条目」「标已读」或「清理」。
 *
 * `enabled: false` 的按钮一律禁用并给出固定原因文案；当前没有真实业务 adapter，
 * 因此不存在任何会写业务状态的 Action。
 */
function ActionRow({ detail, disabled }: { detail: NotificationDetailSlice; disabled: boolean }) {
  const value = detail.value
  if (value === null || !value.actionsAvailable || value.actions.length === 0) return null
  return (
    <div className={styles.actionRow}>
      <div className={styles.actionButtons}>
        {value.actions.map((action) => {
          const reason = notificationActionReasonLabel(action.unavailableReason)
          return (
            <Button
              key={action.actionId}
              type="button"
              variant={action.emphasis === 'primary' ? 'default' : 'outline'}
              size="sm"
              disabled={!action.enabled || disabled || action.navigationTarget === null}
              title={action.enabled ? undefined : reason || undefined}
              onClick={() => {
                if (action.navigationTarget !== null)
                  detail.onNavigate(action.navigationTarget.path)
              }}
            >
              {action.label}
            </Button>
          )
        })}
      </div>
      {value.actions
        .filter((action) => !action.enabled)
        .map((action) => (
          <p key={`${action.actionId}-reason`} className={styles.actionReason}>
            {action.label}：{notificationActionReasonLabel(action.unavailableReason)}
          </p>
        ))}
    </div>
  )
}

function ConfirmDialog(props: NotificationConfirmSlice) {
  if (props.kind === null) return null
  const clear = props.kind === 'clear'
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !props.pending) props.onCancel()
      }}
    >
      <AlertDialogContent className={styles.confirm} aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {clear ? `清理这 ${props.count} 条通知？` : '全部标为已读？'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className={styles.confirmBody}>
              <p>
                {clear
                  ? `将清理预览时的 ${props.count} 条通知，包括未读、已读和过期历史，覆盖所有分页。`
                  : `将预览上界内的 ${props.count} 条未读通知标为已读，包含未加载的分页。新到通知保留未读。`}
              </p>
              {clear && (
                <>
                  <p>清理后无法恢复。之后到达的通知会保留。</p>
                  <p className={styles.confirmNote}>清理消息不会取消活动参与。</p>
                </>
              )}
              {props.error && (
                <p role="alert" className={styles.confirmExpired}>
                  {props.error}
                </p>
              )}
              {props.expired && (
                <p className={styles.confirmExpired} role="alert">
                  预览已过期，请重新预览。
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.pending}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={props.pending || props.expired}
            onClick={(event) => {
              event.preventDefault()
              props.onSubmit()
            }}
          >
            {props.pending ? '正在提交' : clear ? '确认清理' : '确认全部已读'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function listEmptyState(filter: NotificationHistoryFilter): ReactNode {
  if (filter === 'unread') {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>暂时没有未读通知</h3>
        <p className={styles.emptyBody}>当前历史均已读或已过期。可以切回全部历史。</p>
      </div>
    )
  }
  return (
    <div className={styles.empty}>
      <h3 className={styles.emptyTitle}>还没有通知历史</h3>
      <p className={styles.emptyBody}>收到的公告与个人通知会显示在这里。</p>
    </div>
  )
}
