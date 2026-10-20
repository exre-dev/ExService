import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSnapshot } from 'valtio'
import { toast } from '@exre/exui'
import { instance, ExAxiosError } from '@workspace/sdk'
import { useAuth } from '@web/src/auth/AuthContext'
import { readToken, subscribeSessionChanges } from '@web/src/auth/storage'
import {
  applyUnreadCount,
  bindNotificationsToken,
  captureNotificationRead,
  captureNotificationWrite,
  isCurrentNotificationGeneration,
  mergeNotificationPage,
  notificationsConfig,
  type NotificationDetail,
  type NotificationItem,
} from '@web/src/notifications/notificationsConfig'
import { createSummaryScheduler } from '@web/src/notifications/summaryPolling'
import { hasRenderableNotificationBody } from '@workspace/components'
import type {
  NotificationBulkSlice,
  NotificationConfirmSlice,
  NotificationCountState,
  NotificationDetailSlice,
  NotificationHistoryFilter,
  NotificationListSlice,
} from '@workspace/components'

const PAGE_LIMIT = 20
type BulkKind = 'read-all' | 'clear'
interface ClearPreview {
  token: string
  itemCount: number
  expiresAt: number
  clockOffset: number
  requestId: string
}
interface ReadAllIntent {
  requestId: string
  readThroughToken: string
  count: number
}
interface PageRun {
  generation: number
  requestId: number
  inFlight: { requestId: number; cursor: string | null; promise: Promise<void> } | null
  completed: Set<string>
}
function emptyRun(): PageRun {
  return { generation: 0, requestId: 0, inFlight: null, completed: new Set() }
}

/** 通知请求按身份、写代次、视图代次和请求标识接受；确认保留固定命令意图。 */
export function useNotificationsController() {
  const auth = useAuth()
  const navigate = useNavigate()
  const snapshot = useSnapshot(notificationsConfig)
  const authenticated = auth.state.status === 'authenticated'
  const [popupOpen, setPopupOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedReceipt = useRef<string | null>(null)
  const [filter, setFilter] = useState<NotificationHistoryFilter>('all')
  const currentView = useRef({ open: false, filter: 'all' as NotificationHistoryFilter })
  currentView.current = { open: modalOpen, filter }
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const detailStatusRef = useRef(detailStatus)
  detailStatusRef.current = detailStatus
  const [detail, setDetail] = useState<NotificationDetail | null>(null)
  const [readPending, setReadPending] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [bulkPending, setBulkPending] = useState<BulkKind | null>(null)
  const [bulkPreparing, setBulkPreparing] = useState<BulkKind | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: BulkKind; count: number } | null>(null)
  const [previewClock, setPreviewClock] = useState(0)
  const [resetVersions, setResetVersions] = useState({ all: 0, unread: 0 })
  const clearPreview = useRef<ClearPreview | null>(null)
  const readAllIntent = useRef<ReadAllIntent | null>(null)
  const bulkPhase = useRef<'idle' | 'preparing' | 'confirming' | 'submitting'>('idle')
  const failedPreparationKind = useRef<BulkKind | null>(null)
  const pageRuns = useRef({ all: emptyRun(), unread: emptyRun() })
  const uiGeneration = useRef(0)
  const detailRequestId = useRef(0)
  const readRequestId = useRef(0)
  const readInFlight = useRef(false)
  const mounted = useRef(true)
  const ownedEpoch = useRef(snapshot.epoch)
  const scheduler = useMemo(() => createSummaryScheduler(), [])
  const summaryRequestId = useRef(0)
  const summaryInFlight = useRef<Promise<void> | null>(null)
  const autoReadSuppressed = useRef<string | null>(null)
  const bellRef = useRef<HTMLButtonElement | null>(null)

  const invalidatePages = useCallback((view?: NotificationHistoryFilter) => {
    for (const key of view ? [view] : (['all', 'unread'] as const)) {
      const run = pageRuns.current[key]
      run.generation += 1
      run.requestId += 1
      run.inFlight = null
      run.completed.clear()
      const slice = key === 'all' ? notificationsConfig.history : notificationsConfig.unread
      if (slice.status === 'loading') slice.status = slice.items.length ? 'ready' : 'idle'
      if (slice.nextPageStatus === 'loading') slice.nextPageStatus = 'idle'
    }
  }, [])
  const resetLocal = useCallback((resetWrites = false) => {
    uiGeneration.current += 1
    detailRequestId.current += 1
    // Closing a view cannot cancel a PATCH already submitted to the server.
    if (resetWrites) {
      readRequestId.current += 1
      readInFlight.current = false
    }
    autoReadSuppressed.current = null
    selectedReceipt.current = null
    clearPreview.current = null
    readAllIntent.current = null
    bulkPhase.current = 'idle'
    failedPreparationKind.current = null
    setSelectedId(null)
    setDetail(null)
    setDetailStatus('idle')
    setReadPending(readInFlight.current)
    setReadError(null)
    setBulkPending(null)
    setBulkPreparing(null)
    setBulkError(null)
    setConfirm(null)
    setConfirmError(null)
  }, [])
  const sessionInvalid = useCallback(
    (error: unknown) => {
      if (!(error instanceof ExAxiosError) || error.code !== 'SESSION_INVALID') return false
      const token = currentToken()
      if (token !== null) auth.invalidateSession(token)
      bindNotificationsToken(null)
      invalidatePages()
      resetLocal(true)
      summaryRequestId.current += 1
      summaryInFlight.current = null
      setPopupOpen(false)
      setModalOpen(false)
      currentView.current.open = false
      return true
    },
    [auth.invalidateSession, invalidatePages, resetLocal],
  )
  useEffect(() => {
    const sync = () => bindNotificationsToken(currentToken())
    sync()
    return subscribeSessionChanges(sync)
  }, [])
  useEffect(() => {
    if (auth.state.status === 'anonymous') bindNotificationsToken(null)
    if (ownedEpoch.current !== snapshot.epoch || !authenticated) {
      ownedEpoch.current = snapshot.epoch
      invalidatePages()
      resetLocal(true)
      summaryRequestId.current += 1
      summaryInFlight.current = null
      scheduler.reset()
      setPopupOpen(false)
      setModalOpen(false)
      setFilter('all')
      currentView.current = { open: false, filter: 'all' }
    }
  }, [authenticated, auth.state.status, snapshot.epoch, invalidatePages, resetLocal, scheduler])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      uiGeneration.current += 1
      detailRequestId.current += 1
      currentView.current.open = false
      readRequestId.current += 1
      summaryRequestId.current += 1
      invalidatePages()
    }
  }, [invalidatePages])

  const loadSummary = useCallback(async () => {
    if (!authenticated || currentToken() === null) return
    const generation = captureNotificationRead(),
      requestId = ++summaryRequestId.current
    const accepted = () =>
      mounted.current &&
      requestId === summaryRequestId.current &&
      isCurrentNotificationGeneration(generation)
    notificationsConfig.summary.status = 'loading'
    notificationsConfig.summary.error = null
    try {
      const result = await instance({ url: '/notifications/summary', method: 'GET', alert: false })
      if (!accepted()) return
      scheduler.recordSuccess()
      applyUnreadCount(result.unreadCount, result.readThroughToken)
    } catch (error) {
      if (!accepted() || sessionInvalid(error)) return
      scheduler.recordFailure()
      notificationsConfig.summary.status = 'error'
      notificationsConfig.summary.error = '未读计数暂时无法读取'
    }
  }, [authenticated, sessionInvalid, scheduler])
  const runSummaryIfIdle = useCallback((): Promise<void> => {
    if (summaryInFlight.current !== null) return summaryInFlight.current
    const task = Promise.resolve().then(loadSummary)
    summaryInFlight.current = task
    void task.finally(() => {
      if (summaryInFlight.current === task) summaryInFlight.current = null
    })
    return task
  }, [loadSummary])
  useEffect(() => {
    if (authenticated) void runSummaryIfIdle()
  }, [authenticated, snapshot.epoch, runSummaryIfIdle])

  // 聚焦与可见性刷新 + 可见时的轮询；隐藏或匿名时停止，不做实时承诺（设计 9.3）。
  useEffect(() => {
    if (!authenticated) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const clearTimer = () => {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
    }
    /** 只排下一次，间隔由当前退避决定：失败会越排越远，成功后回到基准。 */
    const schedule = () => {
      clearTimer()
      if (stopped || document.visibilityState !== 'visible') return
      timer = setTimeout(() => {
        timer = undefined
        if (stopped) return
        // 定时器这条路径不过节流窗口：它本身就是按间隔来的。
        // 等这一次读取**落地**再排下一次 —— 否则退避用的是上一次的失败数，慢一个周期。
        void runSummaryIfIdle().finally(schedule)
      }, scheduler.nextDelay())
    }
    /**
     * 确保有一个待触发的轮询：已有倒计时就**不动**。
     * 否则密集 focus 会不断把倒计时推后，反而永远等不到下一次轮询。
     */
    const ensureScheduled = () => {
      if (timer !== undefined) return
      schedule()
    }
    /**
     * 聚焦/可见性刷新：节流 + 在途去重，密集 focus 不该变成请求风暴。
     *
     * 两条分支都必须保证最后**有一个待触发的轮询**：
     * - 真发了请求 → 排程挂在 `.finally` 上，等本次落地再排。否则新排的定时器用的还是
     *   本次之前的失败数，复位就只落到了计数器上、落不到已经 `setTimeout` 出去的档位；
     * - 被节流挡掉 → 只补排（`ensureScheduled` 本来就只在没有倒计时时才排），按当前档位续。
     */
    const refreshNow = () => {
      if (stopped || document.visibilityState !== 'visible') return
      if (!scheduler.allowRefresh()) {
        ensureScheduled()
        return
      }
      void runSummaryIfIdle().finally(schedule)
    }

    const onFocus = () => refreshNow()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        // 隐藏：撤掉待触发的轮询，否则它会在隐藏期间再发一次；回到可见时重新起。
        clearTimer()
        return
      }
      refreshNow()
    }

    if (document.visibilityState === 'visible') schedule()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimer()
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      // 退出/换号：清掉退避、节流窗口与在途标记，下次登录从基准间隔重新开始。
      scheduler.reset()
      summaryInFlight.current = null
    }
  }, [authenticated, snapshot.epoch, runSummaryIfIdle, scheduler])

  const loadPage = useCallback(
    (
      view: NotificationHistoryFilter,
      cursor: string | null,
      options: { keepItems?: boolean; force?: boolean } = {},
    ): Promise<void> => {
      if (!authenticated || currentToken() === null) return Promise.resolve()
      const slice = view === 'unread' ? notificationsConfig.unread : notificationsConfig.history
      const run = pageRuns.current[view]
      if (!options.force && run.inFlight?.cursor === cursor) return run.inFlight.promise
      if (cursor === null) {
        run.generation += 1
        run.completed.clear()
        slice.nextCursor = null
      } else if (run.completed.has(cursor)) {
        slice.nextCursor = null
        slice.nextPageStatus = 'error'
        return Promise.resolve()
      }
      const generation = captureNotificationRead(),
        pageGeneration = run.generation,
        requestId = ++run.requestId
      const accepted = () =>
        mounted.current &&
        isCurrentNotificationGeneration(generation) &&
        run.generation === pageGeneration &&
        run.requestId === requestId
      if (cursor !== null || options.keepItems) slice.nextPageStatus = 'loading'
      else {
        slice.status = 'loading'
        slice.nextPageStatus = 'idle'
        slice.error = null
      }
      // Install the lock before HTTP or any await; finally releases only its own request.
      const promise = Promise.resolve().then(async () => {
        if (!accepted()) return
        try {
          const result = await instance({
            url: '/notifications',
            method: 'GET',
            alert: false,
            params: {
              view: view === 'unread' ? 'unread' : 'history',
              limit: PAGE_LIMIT,
              ...(cursor === null ? {} : { cursor }),
            },
          })
          if (!accepted()) return
          if (cursor !== null) run.completed.add(cursor)
          slice.items =
            cursor === null ? dedupe(result.items) : mergeNotificationPage(slice, result)
          const repeated = result.nextCursor !== null && run.completed.has(result.nextCursor)
          slice.nextCursor = repeated ? null : result.nextCursor
          slice.upperSequence = result.upperSequence
          slice.readThroughToken = result.readThroughToken
          slice.status = 'ready'
          slice.nextPageStatus = repeated ? 'error' : 'idle'
          slice.error = null
          if (cursor === null)
            setResetVersions((current) => ({ ...current, [view]: current[view] + 1 }))
        } catch (error) {
          if (!accepted() || sessionInvalid(error)) return
          slice.nextCursor = null
          if (cursor !== null || options.keepItems) slice.nextPageStatus = 'error'
          else {
            slice.status = 'error'
            slice.error = '通知暂时无法加载'
          }
        } finally {
          if (run.inFlight?.requestId === requestId) run.inFlight = null
        }
      })
      run.inFlight = { requestId, cursor, promise }
      return promise
    },
    [authenticated, sessionInvalid],
  )
  const loadUnread = useCallback(() => {
    if (modalOpen && filter === 'unread' && notificationsConfig.unread.status === 'ready')
      return Promise.resolve()
    return loadPage('unread', null)
  }, [modalOpen, filter, loadPage])
  useEffect(() => {
    if (popupOpen) void loadUnread()
  }, [popupOpen, loadUnread])
  useEffect(() => {
    if (modalOpen) void loadPage(filter, null)
  }, [modalOpen, filter, loadPage])
  const refreshAfterWrite = useCallback(
    (keepItems = false) => {
      invalidatePages()
      void loadSummary()
      for (const view of new Set<NotificationHistoryFilter>([
        'unread',
        currentView.current.filter,
      ])) {
        const slice = view === 'unread' ? notificationsConfig.unread : notificationsConfig.history
        void loadPage(view, null, { force: true, keepItems: keepItems && slice.items.length > 0 })
      }
    },
    [invalidatePages, loadSummary, loadPage],
  )

  const loadDetail = useCallback(
    async (receiptId: string) => {
      if (!authenticated || currentToken() === null) return
      const generation = captureNotificationRead(),
        local = uiGeneration.current,
        requestId = ++detailRequestId.current
      const accepted = () =>
        mounted.current &&
        uiGeneration.current === local &&
        detailRequestId.current === requestId &&
        isCurrentNotificationGeneration(generation)
      setDetail(null)
      setDetailStatus('loading')
      try {
        const result = await instance({
          url: '/notifications/{notificationId}',
          method: 'GET',
          alert: false,
          pathParams: { notificationId: receiptId },
        })
        if (!accepted()) return
        setDetail(result)
        setDetailStatus('ready')
      } catch (error) {
        if (!accepted() || sessionInvalid(error)) return
        setDetail(null)
        setDetailStatus('error')
      }
    },
    [authenticated, sessionInvalid],
  )
  const select = useCallback(
    (receiptId: string) => {
      selectedReceipt.current = receiptId
      autoReadSuppressed.current = null
      setSelectedId(receiptId)
      setReadError(null)
      void loadDetail(receiptId)
    },
    [loadDetail],
  )
  const markRead = useCallback(
    async (receiptId: string, read: boolean, expectedRevision: number) => {
      if (!authenticated || readInFlight.current || bulkPhase.current !== 'idle') return
      readInFlight.current = true
      const requestId = ++readRequestId.current,
        local = uiGeneration.current,
        generation = captureNotificationWrite()
      const accepted = () =>
        mounted.current &&
        requestId === readRequestId.current &&
        isCurrentNotificationGeneration(generation)
      setReadPending(true)
      setReadError(null)
      try {
        const result = await instance({
          url: '/notifications/{notificationId}/state',
          method: 'PATCH',
          alert: false,
          pathParams: { notificationId: receiptId },
          data: { read, expectedRevision },
        })
        if (!accepted()) return
        patchLocalItem(receiptId, result.stateRevision, result.read)
        setDetail((current) =>
          current?.receiptId !== receiptId
            ? current
            : {
                ...current,
                readAt: result.read ? current.deliveredAt : null,
                stateRevision: result.stateRevision,
              },
        )
        refreshAfterWrite()
        if (detailStatusRef.current === 'loading' && selectedReceipt.current !== null)
          void loadDetail(selectedReceipt.current)
      } catch (error) {
        if (!accepted() || sessionInvalid(error)) return
        autoReadSuppressed.current = receiptId
        refreshAfterWrite(true)
        if (uiGeneration.current === local && selectedReceipt.current === receiptId) {
          if (error instanceof ExAxiosError && error.status === 409) {
            void loadDetail(receiptId)
            setReadError('状态已变化（409），已刷新。请核对后再操作。')
          } else setReadError('状态保存失败，正文和未读状态已保留。')
        }
      } finally {
        if (requestId === readRequestId.current && mounted.current) {
          readInFlight.current = false
          setReadPending(false)
        }
      }
    },
    [authenticated, sessionInvalid, refreshAfterWrite, loadDetail],
  )
  const toggleRead = useCallback(() => {
    if (selectedId === null) return
    const revision =
      detail?.receiptId === selectedId
        ? detail.stateRevision
        : (
            findItem(notificationsConfig.history.items, selectedId) ??
            findItem(notificationsConfig.unread.items, selectedId)
          )?.stateRevision
    if (revision !== undefined) {
      const read = detail?.receiptId === selectedId ? detail.readAt === null : true
      if (!read) autoReadSuppressed.current = selectedId
      void markRead(selectedId, read, revision)
    }
  }, [selectedId, detail, markRead])
  useEffect(() => {
    if (
      modalOpen &&
      selectedId !== null &&
      detailStatus === 'ready' &&
      detail?.receiptId === selectedId &&
      detail.readAt === null &&
      autoReadSuppressed.current !== selectedId &&
      hasRenderableNotificationBody(detail.content, detail.contentFallbackText)
    )
      void markRead(selectedId, true, detail.stateRevision)
  }, [
    modalOpen,
    selectedId,
    detailStatus,
    detail,
    readPending,
    bulkPreparing,
    bulkPending,
    confirm,
    markRead,
  ])

  const prepare = useCallback(
    async (kind: BulkKind) => {
      const summary = notificationsConfig.summary
      const retry = failedPreparationKind.current === kind
      if (
        !authenticated ||
        currentToken() === null ||
        bulkPhase.current !== 'idle' ||
        readInFlight.current ||
        (!retry &&
          (summary.status !== 'ready' ||
            (kind === 'read-all' ? summary.unreadCount <= 0 : summary.unreadCount !== 0)))
      )
        return
      bulkPhase.current = 'preparing'
      setBulkPreparing(kind)
      setBulkError(null)
      setConfirmError(null)
      const generation = captureNotificationRead(),
        local = uiGeneration.current
      const accepted = () =>
        mounted.current &&
        uiGeneration.current === local &&
        isCurrentNotificationGeneration(generation)
      try {
        if (kind === 'read-all' || retry) {
          await loadSummary()
          if (!accepted()) return
          const fresh = notificationsConfig.summary
          if (fresh.status !== 'ready' || fresh.readThroughToken === null)
            throw new Error('summary unavailable')
        }
        if (kind === 'read-all') {
          const fresh = notificationsConfig.summary
          if (fresh.readThroughToken === null) throw new Error('summary unavailable')
          readAllIntent.current = {
            requestId: newRequestId(),
            readThroughToken: fresh.readThroughToken,
            count: fresh.unreadCount,
          }
          setConfirm({ kind, count: fresh.unreadCount })
        } else {
          const result = await instance({
            url: '/notifications/clear-preview',
            method: 'POST',
            alert: false,
            data: {},
          })
          if (!accepted()) return
          if (result.itemCount === 0) {
            void loadSummary()
            void loadPage('all', null, { force: true })
            toast.info('暂无可清理通知。')
            failedPreparationKind.current = null
            bulkPhase.current = 'idle'
            return
          }
          const receivedAt = Date.now()
          clearPreview.current = {
            requestId: newRequestId(),
            token: result.clearSnapshotToken,
            itemCount: result.itemCount,
            expiresAt: result.expiresAt,
            clockOffset: result.serverTime - receivedAt,
          }
          setPreviewClock(receivedAt)
          setConfirm({ kind, count: result.itemCount })
        }
        failedPreparationKind.current = null
        bulkPhase.current = 'confirming'
      } catch (error) {
        if (!accepted() || sessionInvalid(error)) return
        bulkPhase.current = 'idle'
        failedPreparationKind.current = kind
        setBulkError(
          failureMessage(
            error,
            kind === 'clear' ? '清理预览失败，请重试。' : '未读计数暂时无法读取，请重试。',
          ),
        )
      } finally {
        // Other notification modules may advance the write generation. Release this
        // local phase without accepting their superseded response or touching a new session.
        if (mounted.current && uiGeneration.current === local) {
          if (bulkPhase.current === 'preparing') {
            bulkPhase.current = 'idle'
            failedPreparationKind.current = kind
            setBulkError('状态已变化，请重新准备。')
          }
          setBulkPreparing(null)
        }
      }
    },
    [authenticated, sessionInvalid, loadSummary, loadPage],
  )
  const submit = useCallback(async () => {
    if (bulkPhase.current !== 'confirming' || confirm === null || !authenticated) return
    const kind = confirm.kind,
      readIntent = readAllIntent.current,
      preview = clearPreview.current
    if ((kind === 'read-all' && readIntent === null) || (kind === 'clear' && preview === null))
      return
    if (
      kind === 'clear' &&
      preview !== null &&
      preview.expiresAt <= Date.now() + preview.clockOffset
    ) {
      setPreviewClock(Date.now())
      setConfirmError('预览已过期，请取消后重新准备。')
      return
    }
    bulkPhase.current = 'submitting'
    const generation = captureNotificationWrite(),
      local = uiGeneration.current
    const accepted = () =>
      mounted.current &&
      uiGeneration.current === local &&
      isCurrentNotificationGeneration(generation)
    setBulkPending(kind)
    setConfirmError(null)
    try {
      if (kind === 'read-all' && readIntent !== null) {
        await instance({
          url: '/notifications/read-all',
          method: 'POST',
          alert: false,
          data: { requestId: readIntent.requestId, readThroughToken: readIntent.readThroughToken },
        })
        if (!accepted()) return
        toast.info('已标记本次选定通知，新到通知仍未读。')
      } else if (preview !== null) {
        const result = await instance({
          url: '/notifications/clear-all',
          method: 'POST',
          alert: false,
          data: { requestId: preview.requestId, clearSnapshotToken: preview.token },
        })
        if (!accepted()) return
        toast.info(
          `已清理 ${result.affectedCount} 条，跳过 ${result.skippedCount} 条；新到通知仍保留。`,
        )
        detailRequestId.current += 1
        setSelectedId(null)
        setDetail(null)
        setDetailStatus('idle')
      }
      clearPreview.current = null
      readAllIntent.current = null
      setConfirm(null)
      bulkPhase.current = 'idle'
      refreshAfterWrite()
      if (kind === 'read-all' && selectedReceipt.current !== null)
        void loadDetail(selectedReceipt.current)
    } catch (error) {
      if (!accepted() || sessionInvalid(error)) return
      bulkPhase.current = 'confirming'
      setConfirmError(failureMessage(error))
      refreshAfterWrite(true)
      if (detailStatus === 'loading' && selectedReceipt.current !== null)
        void loadDetail(selectedReceipt.current)
    } finally {
      if (mounted.current && uiGeneration.current === local) {
        if (bulkPhase.current === 'submitting') {
          bulkPhase.current = 'confirming'
          setConfirmError('状态已变化，请核对后重试。')
        }
        setBulkPending(null)
      }
    }
  }, [confirm, authenticated, sessionInvalid, refreshAfterWrite, detailStatus, loadDetail])

  const activePage = filter === 'unread' ? snapshot.unread : snapshot.history
  const list: NotificationListSlice = {
    status: activePage.status,
    items: activePage.items as NotificationItem[],
    hasMore: activePage.nextCursor !== null,
    canAutoLoad:
      modalOpen &&
      activePage.status === 'ready' &&
      activePage.nextCursor !== null &&
      activePage.nextPageStatus === 'idle' &&
      bulkPhase.current === 'idle' &&
      !readPending,
    resetVersion: resetVersions[filter],
    nextPageStatus: activePage.nextPageStatus,
    filter,
    onFilterChange: (next) => {
      if (next !== currentView.current.filter) {
        invalidatePages(currentView.current.filter)
        resetLocal()
        currentView.current.filter = next
        setFilter(next)
      }
    },
    onLoadMore: () => {
      const slice = filter === 'unread' ? notificationsConfig.unread : notificationsConfig.history
      if (
        currentView.current.open &&
        currentView.current.filter === filter &&
        bulkPhase.current === 'idle' &&
        slice.status === 'ready' &&
        slice.nextCursor !== null
      )
        void loadPage(filter, slice.nextCursor)
    },
    onRetryPage: () => {
      if (
        currentView.current.open &&
        currentView.current.filter === filter &&
        bulkPhase.current === 'idle'
      )
        void loadPage(filter, null, { keepItems: true, force: true })
    },
    onRetry: () => {
      if (
        currentView.current.open &&
        currentView.current.filter === filter &&
        bulkPhase.current === 'idle'
      )
        void loadPage(filter, null, { force: true })
    },
  }
  const detailSlice: NotificationDetailSlice = {
    status: detailStatus,
    value: detail,
    readPending,
    readError,
    onToggleRead: toggleRead,
    onRetryRead: toggleRead,
    onRetryDetail: () => {
      if (selectedId !== null) void loadDetail(selectedId)
    },
    onNavigate: (path) => navigate(path),
  }
  const bulkSlice: NotificationBulkSlice = {
    pending: bulkPending,
    preparing: bulkPreparing,
    error: bulkError,
    onReadAll: () => void prepare('read-all'),
    onClearAll: () => void prepare('clear'),
  }
  const preview = clearPreview.current
  const confirmSlice: NotificationConfirmSlice = {
    kind: confirm?.kind ?? null,
    count: confirm?.count ?? 0,
    pending: bulkPending !== null,
    expired: preview !== null && preview.expiresAt <= Date.now() + preview.clockOffset,
    error: confirmError,
    onCancel: () => {
      if (bulkPhase.current === 'submitting') return
      clearPreview.current = null
      readAllIntent.current = null
      bulkPhase.current = 'idle'
      setConfirm(null)
      setConfirmError(null)
    },
    onSubmit: () => void submit(),
  }
  const countState: NotificationCountState = !authenticated
    ? { kind: 'hidden' }
    : snapshot.summary.status === 'error'
      ? { kind: 'error' }
      : snapshot.summary.status !== 'ready'
        ? { kind: 'loading' }
        : { kind: 'ready', count: snapshot.summary.unreadCount }
  return {
    snapshot,
    countState,
    authenticated,
    popupOpen,
    setPopupOpen,
    modalOpen,
    selectedId,
    bellRef,
    unreadStatus: snapshot.unread.status,
    unreadItems: snapshot.unread.items as NotificationItem[],
    list,
    detail: detailSlice,
    bulk: bulkSlice,
    confirm: confirmSlice,
    previewClock,
    onSelect: select,
    onOpenModal: () => {
      currentView.current.open = true
      setPopupOpen(false)
      setModalOpen(true)
    },
    onCloseModal: () => {
      currentView.current.open = false
      invalidatePages()
      resetLocal()
      setModalOpen(false)
    },
    onRetryUnread: () => void loadUnread(),
    refreshSummary: () => void loadSummary(),
  }
}

function dedupe(items: NotificationItem[]): NotificationItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.receiptId)) return false
    seen.add(item.receiptId)
    return true
  })
}
function findItem(items: readonly NotificationItem[], receiptId: string) {
  return items.find((item) => item.receiptId === receiptId)
}
function patchLocalItem(receiptId: string, stateRevision: number, read: boolean) {
  for (const slice of [notificationsConfig.unread, notificationsConfig.history]) {
    const index = slice.items.findIndex((item) => item.receiptId === receiptId),
      current = slice.items[index]
    if (current)
      slice.items[index] = { ...current, readAt: read ? current.deliveredAt : null, stateRevision }
  }
}
function currentToken(): string | null {
  try {
    return readToken(window.localStorage)
  } catch {
    return null
  }
}
function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16)
    return (character === 'x' ? value : (value & 3) | 8).toString(16)
  })
}
function failureMessage(error: unknown, fallback = '操作失败，原状态已保留。请重试。') {
  if (error instanceof ExAxiosError) {
    if (error.status === 409) return '操作与当前状态冲突（409），已保留原状态。请核对后重试。'
    if (error.status === 410) return '预览或游标已过期，请重新预览。'
  }
  return fallback
}
