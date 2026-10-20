// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { selectSessionScope, writeToken } from '@web/src/auth/storage'
import {
  bindNotificationsToken,
  captureNotificationWrite,
  notificationsConfig,
} from '@web/src/notifications/notificationsConfig'
import { SUMMARY_POLLING } from '@web/src/notifications/summaryPolling'
import { ExAxiosError } from '@workspace/sdk'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const patch = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const invalidateSession = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' }))
const info = vi.hoisted(() => vi.fn())
vi.mock('@exre/exui', async () => ({
  ...(await vi.importActual('@exre/exui')),
  toast: { info },
}))
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get, POST: post, PATCH: patch, PUT: put }
    return Promise.resolve(
      handlers[(config.method ?? 'GET') as keyof typeof handlers](config),
    ).then((data) => ({ msg: 'ok', data }))
  },
}))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({
    state: { status: authState.status },
    invalidateSession,
    refreshProfile: vi.fn(),
    retrySession: vi.fn(),
    logout: vi.fn(),
  }),
}))
vi.mock('react-router', () => ({ useNavigate: () => navigate }))

import { useNotificationsController } from '@web/src/notifications/useNotificationsController'

const summary = {
  unreadCount: 2,
  stateVersion: 1,
  upperSequence: 9,
  readThroughToken: 'read.through.token',
  serverTime: 0,
}
const page = {
  items: [
    {
      receiptId: 'receipt-1',
      title: '社区公告',
      summaryText: '摘要',
      scope: 'community',
      category: 'announcement',
      necessity: 'optional',
      sequence: 3,
      deliveredAt: 1_767_225_600_000,
      readAt: null,
      expired: false,
      stateRevision: 4,
    },
  ],
  nextCursor: null,
  unreadCount: 2,
  upperSequence: 9,
  readThroughToken: 'read.through.token',
  serverTime: 0,
}
const detail = {
  receiptId: 'receipt-1',
  title: '社区公告',
  scope: 'community',
  category: 'announcement',
  necessity: 'optional',
  sequence: 3,
  deliveredAt: 1_767_225_600_000,
  readAt: null,
  clearedAt: null,
  lifecycle: 'active',
  stateRevision: 4,
  clearRevision: 0,
  contentAvailable: true,
  content: {
    format: 'html',
    schemaVersion: 1,
    policyVersion: 'notification-html-v1',
    html: '<p>正文</p>',
    text: '正文',
  },
  contentFallbackText: '正文',
  actions: [],
  actionsAvailable: false,
  serverTime: 0,
}
const readAllResult = {
  requestId: 'ignored',
  affectedCount: 2,
  watermarkSequence: 9,
  unreadCount: 0,
  replayed: false,
  serverTime: 0,
}
const clearPreview = {
  batchId: 'batch-1',
  itemCount: 3,
  upperSequence: 9,
  clearSnapshotToken: 'clear.snapshot.token',
  expiresAt: 0,
  serverTime: 0,
}

/**
 * 一份「刚刚生成、还有 10 分钟」的预览，时间戳相对**调用时刻**计算。
 *
 * `serverTime` 与 `expiresAt` 都用 `Date.now()` 起算，即默认服务端时钟与本机一致；
 * 需要构造时钟偏移的用例通过 `overrides` 改写两者。
 */
/** 指定标题与游标的列表页：`nextCursor` 为 null 即没有下一页。 */
function pageOf(titles: string[], nextCursor: string | null) {
  return {
    ...page,
    items: titles.map((title, index) => ({
      ...page.items[0]!,
      receiptId: `receipt-${title}`,
      title,
      sequence: 100 - index,
    })),
    nextCursor,
  }
}

function livePreview(overrides: Partial<typeof clearPreview> = {}) {
  const serverTime = Date.now()
  return { ...clearPreview, serverTime, expiresAt: serverTime + 10 * 60 * 1000, ...overrides }
}
const clearResult = {
  requestId: 'ignored',
  batchId: 'batch-1',
  affectedCount: 2,
  skippedCount: 1,
  unreadCount: 0,
  replayed: false,
  serverTime: 0,
}

let deferred: { promise: Promise<unknown>; release: (value: unknown) => void } | null = null

function routeGet() {
  get.mockImplementation(({ url: path }: { url: string }) => {
    if (path === '/api/notifications/summary') return Promise.resolve(summary)
    if (path === '/api/notifications') return Promise.resolve(page)
    if (deferred !== null) return deferred.promise
    return Promise.resolve(detail)
  })
}

beforeEach(() => {
  writeToken(window.localStorage, 'session-token')
  bindNotificationsToken('session-token')
  routeGet()
})

afterEach(() => {
  cleanup()
  get.mockReset()
  post.mockReset()
  patch.mockReset()
  put.mockReset()
  navigate.mockClear()
  invalidateSession.mockClear()
  info.mockClear()
  deferred = null
  authState.status = 'authenticated'
  bindNotificationsToken(null)
  window.localStorage.clear()
  selectSessionScope('/')
})

describe('notifications controller', () => {
  it('reloads a ready unread detail after read-all success without patching its stale revision', async () => {
    const body = deferredResponse()
    let detailReads = 0
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : ++detailReads === 1
            ? body.promise
            : Promise.resolve({ ...detail, readAt: 123, stateRevision: 5 }),
    )
    post.mockResolvedValue(readAllResult)
    patch.mockRejectedValue(
      new ExAxiosError('http', 'ACTION_STATE_CONFLICT', 'old revision', { status: 409 }),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    await act(async () => {
      body.resolve(detail)
    })
    expect(hook.result.current.detail).toMatchObject({
      status: 'ready',
      value: { readAt: null, stateRevision: 4 },
    })
    expect(patch).not.toHaveBeenCalled()
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(patch).not.toHaveBeenCalled()
    expect(hook.result.current.detail).toMatchObject({
      status: 'ready',
      value: { readAt: 123, stateRevision: 5 },
      readError: null,
    })
    expect(detailReads).toBe(2)
  })
  it('rechecks a selected renderable body when its blocking bulk confirmation is cancelled', async () => {
    const body = deferredResponse()
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : body.promise,
    )
    patch.mockResolvedValue({
      receiptId: 'receipt-1',
      read: true,
      stateRevision: 5,
      unreadCount: 1,
      serverTime: 0,
    })
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    await act(async () => {
      body.resolve(detail)
    })
    expect(hook.result.current.confirm.kind).toBe('read-all')
    expect(patch).not.toHaveBeenCalled()
    await act(async () => {
      hook.result.current.confirm.onCancel()
    })
    expect(patch).toHaveBeenCalledTimes(1)
  })
  it.each(['success', 'failure'] as const)(
    'recovers a selected in-flight detail after read-all %s',
    async (outcome) => {
      const obsolete = deferredResponse()
      let detailReads = 0
      get.mockImplementation(({ url: path }: { url: string }) =>
        path === '/api/notifications/summary'
          ? Promise.resolve(summary)
          : path === '/api/notifications'
            ? Promise.resolve(page)
            : ++detailReads === 1
              ? obsolete.promise
              : Promise.resolve({ ...detail, readAt: 123 }),
      )
      if (outcome === 'success') post.mockResolvedValue(readAllResult)
      else post.mockRejectedValue(new Error('private bulk failure'))
      const hook = renderHook(() => useNotificationsController())
      await act(async () => {
        hook.result.current.onOpenModal()
        hook.result.current.onSelect('receipt-1')
      })
      await act(async () => {
        hook.result.current.bulk.onReadAll()
      })
      await act(async () => {
        hook.result.current.confirm.onSubmit()
      })
      expect(detailReads).toBe(2)
      expect(hook.result.current.detail).toMatchObject({
        status: 'ready',
        value: { receiptId: 'receipt-1', readAt: 123 },
      })
      await act(async () => {
        obsolete.resolve(detail)
      })
      expect(hook.result.current.detail.value?.readAt).toBe(123)
      expect(patch).not.toHaveBeenCalled()
    },
  )

  it('recovers selected in-flight detail on clear failure and clears selection on success', async () => {
    const obsolete = deferredResponse()
    let detailReads = 0,
      writes = 0
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : ++detailReads === 1
            ? obsolete.promise
            : Promise.resolve({ ...detail, readAt: 123 }),
    )
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/clear-preview'
        ? Promise.resolve(livePreview())
        : ++writes === 1
          ? Promise.reject(new Error('private clear failure'))
          : Promise.resolve(clearResult),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await act(async () => {
      hook.result.current.bulk.onClearAll()
    })
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(hook.result.current.detail.status).toBe('ready')
    expect(detailReads).toBe(2)
    await act(async () => {
      hook.result.current.confirm.onSubmit()
      obsolete.resolve(detail)
    })
    expect(hook.result.current.selectedId).toBeNull()
    expect(hook.result.current.detail).toMatchObject({ status: 'idle', value: null })
    expect(detailReads).toBe(2)
  })
  it('keeps paged rows and the fresh recovery lock when a failed write invalidates old page and summary reads', async () => {
    const oldSummary = deferredResponse(),
      oldPage = deferredResponse(),
      recovery = deferredResponse()
    let summaries = 0,
      pages = 0
    get.mockImplementation(({ url: path }: { url: string }) => {
      if (path === '/api/notifications/summary')
        return ++summaries === 1 ? oldSummary.promise : Promise.resolve(summary)
      if (path !== '/api/notifications') return Promise.resolve(detail)
      pages += 1
      return pages === 1
        ? Promise.resolve(pageOf(['A'], 'next'))
        : pages === 2
          ? oldPage.promise
          : recovery.promise
    })
    patch.mockRejectedValue(new Error('private write failure'))
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    await act(async () => {
      hook.result.current.onSelect('receipt-1')
    })
    expect(hook.result.current.list).toMatchObject({ status: 'ready', nextPageStatus: 'loading' })
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['A'])
    expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 2 })
    await act(async () => {
      oldPage.reject(new Error('obsolete page'))
      oldSummary.reject(new Error('obsolete summary'))
    })
    expect(hook.result.current.list.nextPageStatus).toBe('loading')
    expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 2 })
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    expect(pages).toBe(4) // history recovery and independent unread refresh
    await act(async () => {
      recovery.resolve(pageOf(['fresh'], null))
    })
    expect(hook.result.current.list).toMatchObject({ status: 'ready', nextPageStatus: 'idle' })
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['fresh'])
  })

  it('automatically reads an unavailable structured body when its text fallback is renderable', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : Promise.resolve({ ...detail, contentAvailable: false, content: null }),
    )
    patch.mockResolvedValue({
      receiptId: 'receipt-1',
      read: true,
      stateRevision: 5,
      unreadCount: 1,
      serverTime: 0,
    })
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    expect(patch).toHaveBeenCalledTimes(1)
  })
  it('does not automatically read a detail without renderable content or text fallback', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : Promise.resolve({ ...detail, content: null, contentFallbackText: null }),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    expect(hook.result.current.detail.status).toBe('ready')
    expect(patch).not.toHaveBeenCalled()
  })

  it('keeps selected B detail when an older A write conflicts', async () => {
    const firstWrite = deferredResponse()
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { pathParams?: { notificationId?: string } }) => {
        if (path === '/api/notifications/summary') return Promise.resolve(summary)
        if (path === '/api/notifications') return Promise.resolve(page)
        return Promise.resolve({
          ...detail,
          receiptId: init?.pathParams?.notificationId,
          readAt: init?.pathParams?.notificationId === 'receipt-B' ? 123 : null,
        })
      },
    )
    patch.mockReturnValueOnce(firstWrite.promise)
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-A')
    })
    await act(async () => {
      hook.result.current.onSelect('receipt-B')
    })
    await act(async () => {
      firstWrite.reject(
        new ExAxiosError('http', 'ACTION_STATE_CONFLICT', 'conflict', { status: 409 }),
      )
    })
    expect(hook.result.current.selectedId).toBe('receipt-B')
    expect(hook.result.current.detail.value?.receiptId).toBe('receipt-B')
    expect(hook.result.current.detail.readError).toBeNull()
    expect(
      get.mock.calls.filter((call) => call[0]?.pathParams?.notificationId === 'receipt-A'),
    ).toHaveLength(1)
  })

  it.each(['single', 'bulk'] as const)(
    'recovers list reads invalidated by a failed %s write',
    async (kind) => {
      const obsolete = deferredResponse()
      let pages = 0
      get.mockImplementation(({ url: path }: { url: string }) =>
        path === '/api/notifications/summary'
          ? Promise.resolve(summary)
          : path === '/api/notifications'
            ? ++pages === 1
              ? obsolete.promise
              : Promise.resolve(pageOf(['recovered'], null))
            : Promise.resolve(detail),
      )
      patch.mockRejectedValue(new Error('private failed state write'))
      post.mockRejectedValue(new Error('private failed bulk write'))
      const hook = renderHook(() => useNotificationsController())
      await act(async () => {
        hook.result.current.onOpenModal()
      })
      if (kind === 'single')
        await act(async () => {
          hook.result.current.onSelect('receipt-1')
        })
      else {
        await act(async () => {
          hook.result.current.bulk.onReadAll()
        })
        await act(async () => {
          hook.result.current.confirm.onSubmit()
        })
      }
      await act(async () => {
        obsolete.resolve(pageOf(['obsolete'], null))
      })
      expect(hook.result.current.list.status).toBe('ready')
      expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['recovered'])
      expect(hook.result.current.countState.kind).toBe('ready')
    },
  )

  it('keeps an explicit mark-unread action unread until a new proactive selection', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : Promise.resolve({ ...detail, readAt: 123 }),
    )
    patch.mockResolvedValue({
      receiptId: 'receipt-1',
      read: false,
      stateRevision: 5,
      unreadCount: 3,
      serverTime: 0,
    })
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await act(async () => {
      hook.result.current.detail.onToggleRead()
    })
    expect(hook.result.current.detail.value?.readAt).toBeNull()
    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch.mock.calls[0]?.[0]).toMatchObject({ data: { read: false } })
  })
  it('releases only its own bulk phase when another notification module advances the write generation', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : Promise.resolve(page),
    )
    const preparation = deferredResponse(),
      submission = deferredResponse()
    post.mockReturnValueOnce(preparation.promise)
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState.kind).toBe('ready'))
    await act(async () => {
      hook.result.current.bulk.onClearAll()
    })
    act(() => {
      captureNotificationWrite()
    })
    await act(async () => {
      preparation.resolve(livePreview())
    })
    expect(hook.result.current.bulk.preparing).toBeNull()
    expect(hook.result.current.bulk.error).toBe('状态已变化，请重新准备。')
    expect(hook.result.current.confirm.kind).toBeNull()
    post.mockResolvedValueOnce(livePreview()).mockReturnValueOnce(submission.promise)
    await act(async () => {
      hook.result.current.bulk.onClearAll()
    })
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    act(() => {
      captureNotificationWrite()
    })
    await act(async () => {
      submission.resolve(clearResult)
    })
    expect(hook.result.current.confirm).toMatchObject({
      kind: 'clear',
      pending: false,
      error: '状态已变化，请核对后重试。',
    })
    expect(hook.result.current.bulk.pending).toBeNull()
  })
  it('marks the currently selected body read after an earlier row write finishes', async () => {
    const firstWrite = deferredResponse()
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { pathParams?: { notificationId?: string } }) => {
        if (path === '/api/notifications/summary') return Promise.resolve(summary)
        if (path === '/api/notifications') return Promise.resolve(page)
        return Promise.resolve({ ...detail, receiptId: init?.pathParams?.notificationId })
      },
    )
    patch.mockReturnValueOnce(firstWrite.promise).mockResolvedValue({
      receiptId: 'receipt-B',
      read: true,
      stateRevision: 5,
      unreadCount: 0,
      serverTime: 0,
    })
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-A')
    })
    expect(patch).toHaveBeenCalledTimes(1)
    await act(async () => {
      hook.result.current.onSelect('receipt-B')
    })
    expect(hook.result.current.detail.value?.receiptId).toBe('receipt-B')
    expect(patch).toHaveBeenCalledTimes(1)
    await act(async () => {
      firstWrite.resolve({
        receiptId: 'receipt-A',
        read: true,
        stateRevision: 5,
        unreadCount: 1,
        serverTime: 0,
      })
    })
    expect(patch).toHaveBeenCalledTimes(2)
    expect(patch.mock.calls[1]?.[0]).toMatchObject({ pathParams: { notificationId: 'receipt-B' } })
  })

  it('rejects retained pagination callbacks after close or switching the view', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : Promise.resolve(pageOf(['A'], 'next')),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    const previous = hook.result.current.list.onLoadMore
    await act(async () => {
      hook.result.current.onCloseModal()
      previous()
    })
    expect(get.mock.calls.filter((call) => call[0].url === '/api/notifications')).toHaveLength(1)
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    const beforeSwitch = hook.result.current.list.onLoadMore
    await act(async () => {
      hook.result.current.list.onFilterChange('unread')
      beforeSwitch()
    })
    expect(get.mock.calls.filter((call) => call[0]?.params?.view === 'history')).toHaveLength(2)
  })

  it('retains the clear snapshot body and safe confirm error through a submission retry', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : Promise.resolve(page),
    )
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/clear-preview'
        ? Promise.resolve(livePreview())
        : Promise.reject(
            new ExAxiosError('http', 'HTTP_ERROR', 'secret database credentials', { status: 500 }),
          ),
    )
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState.kind).toBe('ready'))
    await act(async () => {
      hook.result.current.bulk.onClearAll()
    })
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(hook.result.current.confirm).toMatchObject({
      kind: 'clear',
      count: 3,
      pending: false,
      error: '操作失败，原状态已保留。请重试。',
    })
    await act(async () => {
      hook.result.current.refreshSummary()
      hook.result.current.confirm.onSubmit()
    })
    const submissions = post.mock.calls.filter(
      (call) => call[0].url === '/api/notifications/clear-all',
    )
    expect(submissions).toHaveLength(2)
    expect(submissions[1]?.[0]).toEqual(submissions[0]?.[0])
    expect(
      post.mock.calls.filter((call) => call[0].url === '/api/notifications/clear-preview'),
    ).toHaveLength(1)
  })

  it('discards global and local reads after unmount', async () => {
    const summaryRead = deferredResponse(),
      pageRead = deferredResponse(),
      detailRead = deferredResponse()
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? summaryRead.promise
        : path === '/api/notifications'
          ? pageRead.promise
          : detailRead.promise,
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    hook.unmount()
    await act(async () => {
      summaryRead.resolve(summary)
      pageRead.resolve(page)
      detailRead.resolve(detail)
    })
    expect(notificationsConfig.summary.status).not.toBe('ready')
    expect(notificationsConfig.history.items).toHaveLength(0)
    expect(patch).not.toHaveBeenCalled()
  })
  it('retries a failed read-all preparation with the same action despite a failed count', async () => {
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState.kind).toBe('ready'))
    get.mockRejectedValueOnce(
      new ExAxiosError('http', 'HTTP_ERROR', 'secret connection', { status: 500 }),
    )
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    expect(hook.result.current.bulk.error).toBe('未读计数暂时无法读取，请重试。')
    expect(hook.result.current.countState.kind).toBe('error')
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    expect(hook.result.current.confirm).toMatchObject({ kind: 'read-all', count: 2 })
    expect(hook.result.current.bulk.error).toBeNull()
  })

  it('rejects normal bulk actions while the global count is unknown or failed', async () => {
    const pending = deferredResponse()
    get.mockImplementation(() => pending.promise)
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.bulk.onReadAll()
      hook.result.current.bulk.onClearAll()
    })
    expect(post).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.reject(new Error('private connection'))
    })
    expect(hook.result.current.countState.kind).toBe('error')
    await act(async () => {
      hook.result.current.bulk.onReadAll()
      hook.result.current.bulk.onClearAll()
    })
    expect(post).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('guards read-all preparation, confirmation and submission synchronously', async () => {
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState.kind).toBe('ready'))
    const prepared = deferredResponse(),
      submitted = deferredResponse()
    get.mockImplementation(() => prepared.promise)
    post.mockImplementation(() => submitted.promise)
    await act(async () => {
      hook.result.current.bulk.onReadAll()
      hook.result.current.bulk.onReadAll()
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(hook.result.current.bulk.preparing).toBe('read-all')
    await act(async () => {
      prepared.resolve(summary)
    })
    await act(async () => {
      hook.result.current.bulk.onReadAll()
      hook.result.current.bulk.onClearAll()
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(post).not.toHaveBeenCalled()
    await act(async () => {
      hook.result.current.confirm.onSubmit()
      hook.result.current.confirm.onSubmit()
    })
    expect(post).toHaveBeenCalledTimes(1)
    await act(async () => {
      submitted.reject(new Error('private stack trace'))
    })
    expect(hook.result.current.confirm).toMatchObject({
      kind: 'read-all',
      pending: false,
      error: '操作失败，原状态已保留。请重试。',
    })
  })

  it('accepts only the latest first page and discards pagination superseded by refresh', async () => {
    const first = deferredResponse(),
      second = deferredResponse(),
      next = deferredResponse()
    let reads = 0
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { params?: { cursor?: string } }) => {
        if (path !== '/api/notifications') return routeGetCalls(path)
        if (init?.params?.cursor) return next.promise
        reads += 1
        return reads === 1
          ? first.promise
          : reads === 2
            ? second.promise
            : Promise.resolve(pageOf(['fresh'], 'fresh-cursor'))
      },
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await act(async () => {
      hook.result.current.list.onRetry()
    })
    await act(async () => {
      second.resolve(pageOf(['new'], 'next'))
    })
    const version = hook.result.current.list.resetVersion
    await act(async () => {
      first.resolve(pageOf(['old'], null))
    })
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['new'])
    expect(hook.result.current.list.resetVersion).toBe(version)
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    await act(async () => {
      hook.result.current.list.onRetry()
    })
    await act(async () => {
      next.resolve(pageOf(['old-page'], null))
    })
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['fresh'])
    expect(hook.result.current.list.hasMore).toBe(true)
  })

  it('does not let an older summary response overwrite the latest accepted summary', async () => {
    const old = deferredResponse(),
      latest = deferredResponse()
    get.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.refreshSummary()
    })
    await act(async () => {
      latest.resolve({ ...summary, unreadCount: 8 })
    })
    await act(async () => {
      old.resolve({ ...summary, unreadCount: 1 })
    })
    expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 8 })
  })

  it('deduplicates Popup and modal unread loads and preserves their paged unread list', async () => {
    const first = deferredResponse()
    get.mockImplementation(
      ({
        url: path,
        ...init
      }: { url: string } & { params?: { view?: string; cursor?: string } }) => {
        if (path !== '/api/notifications') return routeGetCalls(path)
        if (init?.params?.view === 'history') return Promise.resolve(page)
        return init?.params?.cursor ? Promise.resolve(pageOf(['B'], null)) : first.promise
      },
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.setPopupOpen(true)
    })
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.list.onFilterChange('unread')
    })
    const unreadCalls = () =>
      get.mock.calls.filter((call) => call[0]?.params?.view === 'unread').length
    expect(unreadCalls()).toBe(1)
    await act(async () => {
      first.resolve(pageOf(['A'], 'next'))
    })
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    await act(async () => {
      hook.result.current.setPopupOpen(true)
      hook.result.current.onRetryUnread()
    })
    expect(unreadCalls()).toBe(2)
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['A', 'B'])
  })

  it('refreshes an active unread view exactly once after a write without trusting replay counts', async () => {
    post.mockResolvedValue({ ...readAllResult, replayed: true, unreadCount: 99 })
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.list.onFilterChange('unread')
    })
    const before = get.mock.calls.filter((call) => call[0].url === '/api/notifications').length
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    const fresh = deferredResponse()
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary' ? fresh.promise : Promise.resolve(page),
    )
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(get.mock.calls.filter((call) => call[0].url === '/api/notifications')).toHaveLength(
      before + 1,
    )
    expect(hook.result.current.countState.kind).toBe('loading')
    expect(notificationsConfig.summary.unreadCount).toBe(2)
    await act(async () => {
      fresh.resolve(summary)
    })
  })

  it.each(['close', 'tab'] as const)('discards list and detail reads after %s', async (action) => {
    const list = deferredResponse(),
      body = deferredResponse()
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { params?: { view?: string } }) => {
        if (path === '/api/notifications/summary') return Promise.resolve(summary)
        if (path === '/api/notifications/{notificationId}') return body.promise
        return init?.params?.view === 'unread' ? Promise.resolve(page) : list.promise
      },
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await act(async () => {
      if (action === 'close') hook.result.current.onCloseModal()
      else hook.result.current.list.onFilterChange('unread')
    })
    await act(async () => {
      list.resolve(pageOf(['private'], null))
      body.resolve(detail)
    })
    expect(notificationsConfig.history.items).toHaveLength(0)
    expect(hook.result.current.selectedId).toBeNull()
    expect(hook.result.current.detail.value).toBeNull()
    expect(patch).not.toHaveBeenCalled()
  })

  it('clears local private selections and intents when the token changes while still authenticated', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications/{notificationId}'
          ? Promise.resolve({ ...detail, readAt: 123 })
          : Promise.resolve(page),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    expect(hook.result.current.detail.value).not.toBeNull()
    expect(hook.result.current.confirm.kind).toBe('read-all')
    await act(async () => {
      writeToken(window.localStorage, 'second-account')
      bindNotificationsToken('second-account')
    })
    expect(hook.result.current.authenticated).toBe(true)
    expect(hook.result.current.modalOpen).toBe(false)
    expect(hook.result.current.selectedId).toBeNull()
    expect(hook.result.current.detail.value).toBeNull()
    expect(hook.result.current.confirm.kind).toBeNull()
    expect(hook.result.current.bulk).toMatchObject({ pending: null, preparing: null, error: null })
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(post).not.toHaveBeenCalled()
  })

  it('keeps old rows through a failed explicit page recovery', async () => {
    let requests = 0
    get.mockImplementation(({ url: path }: { url: string }) =>
      path !== '/api/notifications'
        ? routeGetCalls(path)
        : ++requests === 1
          ? Promise.resolve(pageOf(['A'], 'next'))
          : Promise.reject(new Error('secret database error')),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    const version = hook.result.current.list.resetVersion
    await act(async () => {
      hook.result.current.list.onRetryPage()
    })
    expect(hook.result.current.list).toMatchObject({
      status: 'ready',
      nextPageStatus: 'error',
      hasMore: false,
      resetVersion: version,
    })
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['A'])
  })

  it('stops automatic pagination when the server repeats a completed cursor', async () => {
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { params?: { cursor?: string } }) =>
        path !== '/api/notifications'
          ? routeGetCalls(path)
          : Promise.resolve(pageOf(init?.params?.cursor ? ['B'] : ['A'], 'same')),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    expect(hook.result.current.list).toMatchObject({
      nextPageStatus: 'error',
      canAutoLoad: false,
      hasMore: false,
    })
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    expect(get.mock.calls.filter((call) => call[0].url === '/api/notifications')).toHaveLength(2)
  })

  it('restores closing and drops intent on SESSION_INVALID during submission', async () => {
    post.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', 'private expired details', { status: 401 }),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(invalidateSession).toHaveBeenCalledWith('session-token')
    expect(hook.result.current.modalOpen).toBe(false)
    expect(hook.result.current.confirm).toMatchObject({ kind: null, pending: false, error: null })
    expect(hook.result.current.bulk).toMatchObject({ pending: null, preparing: null, error: null })
  })
  it('deduplicates simultaneous page callbacks and refuses to reread without a cursor', async () => {
    let release!: (value: unknown) => void
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { params?: { cursor?: string } }) => {
        if (path !== '/api/notifications') return routeGetCalls(path)
        if (init?.params?.cursor)
          return new Promise((resolve) => {
            release = resolve
          })
        return Promise.resolve(pageOf(['A'], 'next'))
      },
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await act(async () => {
      hook.result.current.list.onLoadMore()
      hook.result.current.list.onLoadMore()
    })
    expect(get.mock.calls.filter((call) => call[0].url === '/api/notifications')).toHaveLength(2)
    await act(async () => {
      release(pageOf(['A', 'B'], null))
    })
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['A', 'B'])
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    expect(get.mock.calls.filter((call) => call[0].url === '/api/notifications')).toHaveLength(2)
  })

  it('keeps a fixed read-all body through polling and an uncertain retry', async () => {
    post.mockRejectedValueOnce(new Error('internal secret')).mockResolvedValueOnce(readAllResult)
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState.kind).toBe('ready'))
    await act(async () => {
      hook.result.current.bulk.onReadAll()
    })
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(hook.result.current.confirm.kind).toBe('read-all')
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 7, readThroughToken: 'new.token' })
        : Promise.resolve(page),
    )
    await act(async () => {
      hook.result.current.refreshSummary()
    })
    expect(hook.result.current.confirm.count).toBe(2)
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(post.mock.calls[1]?.[0]).toEqual(post.mock.calls[0]?.[0])
  })

  it('does not confirm or submit a zero-item clear preview', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : Promise.resolve(page),
    )
    post.mockResolvedValue(livePreview({ itemCount: 0 }))
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState.kind).toBe('ready'))
    const summaryRequests = get.mock.calls.filter(
      (call) => call[0].url === '/api/notifications/summary',
    ).length
    await act(async () => {
      hook.result.current.bulk.onClearAll()
      hook.result.current.bulk.onClearAll()
    })
    expect(
      get.mock.calls.filter((call) => call[0].url === '/api/notifications/summary'),
    ).toHaveLength(summaryRequests + 1)
    expect(post).toHaveBeenCalledTimes(1)
    expect(hook.result.current.confirm.kind).toBeNull()
    await act(async () => {
      hook.result.current.confirm.onSubmit()
    })
    expect(post).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('暂无可清理通知。')
  })
  it('reads the global count on its own endpoint and never derives it from a page', async () => {
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith({
        url: '/api/notifications/summary',
        method: 'GET',
        alert: false,
      }),
    )
    await waitFor(() => expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 2 }))
    hook.unmount()
  })

  it('shows the count as stale rather than zero when the summary request fails', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.reject(new ExAxiosError('network', 'NETWORK_ERROR', '网络连接失败，请稍后重试'))
        : Promise.resolve(page),
    )
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState).toEqual({ kind: 'error' }))
    expect(notificationsConfig.summary.unreadCount).toBe(0)
    hook.unmount()
  })

  /**
   * M5：轮询调度（设计 9.3）。
   *
   * 用**可控时钟**（`vi.useFakeTimers`）驱动，不靠真实等待：
   * 推进定时器就能观察间隔是否真的随失败拉长、随成功复位。
   */
  describe('M5 polling backoff', () => {
    const summaryCalls = () =>
      get.mock.calls.filter((call) => call[0].url === '/api/notifications/summary').length

    function setupPolling() {
      const hook = renderHook(() => useNotificationsController())
      return hook
    }

    it('lengthens the interval while summaries keep failing and resets it after a success', async () => {
      vi.useFakeTimers()
      try {
        // 前 4 次持续失败，之后恢复。用假时钟记录每次读取的时刻。
        let attempts = 0
        const attemptedAt: number[] = []
        get.mockImplementation(({ url: path }: { url: string }) => {
          if (path !== '/api/notifications/summary') return Promise.resolve(page)
          attempts += 1
          attemptedAt.push(Date.now())
          return attempts <= 4
            ? Promise.reject(
                new ExAxiosError('network', 'NETWORK_ERROR', '网络连接失败，请稍后重试'),
              )
            : Promise.resolve(summary)
        })
        const hook = setupPolling()
        await vi.advanceTimersByTimeAsync(0)
        expect(summaryCalls()).toBe(1)

        // 推进 25 分钟。排程是：a1@0 失败 → 60s → a2@60s 失败 → 240s → a3@300s 失败
        // → 480s → a4@780s 失败 → 960s 但被上限截到 600s → a5@1380s **成功** → 复位 60s
        // → a6@1440s → a7@1500s。
        await vi.advanceTimersByTimeAsync(25 * 60_000)
        expect(attempts).toBeGreaterThanOrEqual(6)

        const gaps = attemptedAt.slice(1).map((at, index) => at - attemptedAt[index]!)
        // 失败期间（gaps[0..3]）：间隔严格变大。固定 60 秒的话这里会全部相等。
        const failingGaps = gaps.slice(0, 4)
        for (let index = 1; index < failingGaps.length; index += 1) {
          expect(failingGaps[index]!).toBeGreaterThan(failingGaps[index - 1]!)
        }
        expect(failingGaps[0]).toBe(SUMMARY_POLLING.baseInterval)
        // 第 4 档本该是 16 分钟，被上限截到 10 分钟。
        expect(failingGaps[3]).toBe(SUMMARY_POLLING.maxInterval)

        // 成功之后：间隔立刻回到基准（退避只针对“正在失败”的那段时间）。
        expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 2 })
        expect(gaps[4]).toBe(SUMMARY_POLLING.baseInterval)
        expect(gaps[5]).toBe(SUMMARY_POLLING.baseInterval)
        hook.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('stops polling while the page is hidden and resumes when it becomes visible', async () => {
      vi.useFakeTimers()
      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      try {
        visibility.mockReturnValue('visible')
        const hook = setupPolling()
        await vi.advanceTimersByTimeAsync(0)
        const seen = summaryCalls()

        // 隐藏：轮询停掉，推进 10 分钟也不再发请求。
        visibility.mockReturnValue('hidden')
        act(() => {
          document.dispatchEvent(new Event('visibilitychange'))
        })
        await vi.advanceTimersByTimeAsync(10 * 60_000)
        expect(summaryCalls()).toBe(seen)

        // 回到可见：立即按节流刷一次，并重新起轮询。
        visibility.mockReturnValue('visible')
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'))
          await vi.advanceTimersByTimeAsync(0)
        })
        expect(summaryCalls()).toBe(seen + 1)
        await vi.advanceTimersByTimeAsync(60_000)
        expect(summaryCalls()).toBe(seen + 2)
        hook.unmount()
      } finally {
        visibility.mockRestore()
        vi.useRealTimers()
      }
    })

    /**
     * 复位必须落到**已经 setTimeout 出去的档位**上，而不只是把计数器清零。
     *
     * 缺陷版本里 `onVisible` 是 `refreshNow(); schedule()` —— `schedule()` 在同一 tick
     * 读 `nextDelay()`，那时本次成败还不知道，于是新排的定时器仍是旧退避档位。
     */
    it('re-arms the timer on the base interval after a successful refresh on becoming visible', async () => {
      vi.useFakeTimers()
      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      try {
        visibility.mockReturnValue('visible')
        // 前 3 次失败，之后成功。
        let attempts = 0
        get.mockImplementation(({ url: path }: { url: string }) => {
          if (path !== '/api/notifications/summary') return Promise.resolve(page)
          attempts += 1
          return attempts <= 3
            ? Promise.reject(
                new ExAxiosError('network', 'NETWORK_ERROR', '网络连接失败，请稍后重试'),
              )
            : Promise.resolve(summary)
        })
        const hook = setupPolling()
        await vi.advanceTimersByTimeAsync(0)
        // a1@0 失败 → a2@60s 失败 → a3@300s 失败，退避被推到 480s。
        await vi.advanceTimersByTimeAsync(60_000)
        await vi.advanceTimersByTimeAsync(240_000)
        expect(summaryCalls()).toBe(3)

        // 隐藏：待触发的轮询撤掉，推进 30 分钟也不再发请求。
        visibility.mockReturnValue('hidden')
        act(() => {
          document.dispatchEvent(new Event('visibilitychange'))
        })
        await vi.advanceTimersByTimeAsync(30 * 60_000)
        expect(summaryCalls()).toBe(3)

        // 回到可见：这次刷新成功 → 调度器复位 → 下一个间隔应为基准 60s。
        visibility.mockReturnValue('visible')
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'))
          await vi.advanceTimersByTimeAsync(0)
        })
        expect(summaryCalls()).toBe(4)
        expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 2 })

        // 一个基准间隔后就有下一次。旧退避是 480s，那时这里仍应是 4 次。
        await vi.advanceTimersByTimeAsync(60_000)
        expect(summaryCalls()).toBe(5)
        hook.unmount()
      } finally {
        visibility.mockRestore()
        vi.useRealTimers()
      }
    })

    it('collapses a burst of focus events into one request', async () => {
      vi.useFakeTimers()
      try {
        const hook = setupPolling()
        await vi.advanceTimersByTimeAsync(0)
        const seen = summaryCalls()
        // 密集聚焦：同一节流窗口内连发 10 次，不该变成 10 个请求。
        await act(async () => {
          for (let index = 0; index < 10; index += 1) {
            window.dispatchEvent(new Event('focus'))
            await vi.advanceTimersByTimeAsync(0)
          }
        })
        expect(summaryCalls()).toBe(seen + 1)
        // 出了节流窗口（10s）才再放行一次。
        await act(async () => {
          vi.advanceTimersByTime(10_000)
          window.dispatchEvent(new Event('focus'))
          await vi.advanceTimersByTimeAsync(0)
        })
        expect(summaryCalls()).toBe(seen + 2)
        hook.unmount()
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not stack a second request while one summary is already in flight', async () => {
      let release!: (value: unknown) => void
      get.mockImplementation(({ url: path }: { url: string }) => {
        if (path !== '/api/notifications/summary') return Promise.resolve(page)
        // 第一次挂住，好在「在途」状态下再触发刷新。
        return new Promise((resolve) => {
          release = resolve
        })
      })
      const hook = renderHook(() => useNotificationsController())
      await waitFor(() => expect(summaryCalls()).toBe(1))
      // 在途时再要求刷新若干次：在途去重应当把它们全部合并掉。
      await act(async () => {
        for (let index = 0; index < 5; index += 1) window.dispatchEvent(new Event('focus'))
      })
      expect(summaryCalls()).toBe(1)
      await act(async () => {
        release(summary)
      })
      hook.unmount()
    })

    it('clears the backoff and throttle window on logout so the next session starts fresh', async () => {
      vi.useFakeTimers()
      try {
        get.mockImplementation(({ url: path }: { url: string }) =>
          path === '/api/notifications/summary'
            ? Promise.reject(
                new ExAxiosError('network', 'NETWORK_ERROR', '网络连接失败，请稍后重试'),
              )
            : Promise.resolve(page),
        )
        const hook = setupPolling()
        await vi.advanceTimersByTimeAsync(0)
        await vi.advanceTimersByTimeAsync(60_000 + 120_000)
        expect(summaryCalls()).toBeGreaterThan(1)

        // 退出：监听与定时器一并撤掉，推进时间不再产生任何请求。
        hook.unmount()
        const seen = summaryCalls()
        await vi.advanceTimersByTimeAsync(30 * 60_000)
        expect(summaryCalls()).toBe(seen)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('loads history when the modal opens and does not mark anything read by opening', async () => {
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith({
        url: '/api/notifications',
        method: 'GET',
        alert: false,
        params: { view: 'history', limit: 20 },
      }),
    )
    expect(hook.result.current.selectedId).toBeNull()
    expect(patch).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('marks read only after the user selects and the body is present', async () => {
    patch.mockResolvedValue({
      receiptId: 'receipt-1',
      read: true,
      stateRevision: 5,
      unreadCount: 1,
      serverTime: 0,
    })
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      hook.result.current.onSelect('receipt-1')
    })
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith({
        url: '/api/notifications/{notificationId}/state',
        method: 'PATCH',
        alert: false,
        pathParams: { notificationId: 'receipt-1' },
        data: { read: true, expectedRevision: 4 },
      }),
    )
    hook.unmount()
  })

  it.each(['close', 'filter'] as const)(
    'settles a submitted read and refreshes the current view after %s',
    async (action) => {
      const write = deferredResponse()
      let saved = false
      patch.mockReturnValue(write.promise)
      get.mockImplementation(
        ({ url: path, ...init }: { url: string } & { params?: { view?: string } }) =>
          Promise.resolve(
            path === '/api/notifications/summary'
              ? { ...summary, unreadCount: saved ? 1 : 2 }
              : path === '/api/notifications/{notificationId}'
                ? detail
                : {
                    ...page,
                    items:
                      saved && init?.params?.view === 'unread'
                        ? []
                        : [
                            {
                              ...page.items[0]!,
                              readAt: saved ? 123 : null,
                              stateRevision: saved ? 5 : 4,
                            },
                          ],
                  },
          ),
      )
      const hook = renderHook(() => useNotificationsController())
      await act(async () => {
        hook.result.current.onOpenModal()
      })
      await act(async () => {
        hook.result.current.onSelect('receipt-1')
      })
      await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
      if (action === 'close') {
        await act(async () => {
          hook.result.current.onCloseModal()
        })
        await act(async () => {
          hook.result.current.onOpenModal()
        })
      } else
        await act(async () => {
          hook.result.current.list.onFilterChange('unread')
        })
      await act(async () => {
        saved = true
        write.resolve({
          receiptId: 'receipt-1',
          read: true,
          stateRevision: 5,
          unreadCount: 1,
          serverTime: 0,
        })
      })
      await waitFor(() =>
        expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 1 }),
      )
      expect(notificationsConfig.unread.items).toEqual([])
      if (action === 'close')
        expect(hook.result.current.list.items[0]).toMatchObject({ readAt: 123, stateRevision: 5 })
      else
        expect(hook.result.current.list).toMatchObject({
          filter: 'unread',
          status: 'ready',
          items: [],
        })
      hook.unmount()
    },
  )

  it('keeps a submitted read locked across close and reopen until it settles', async () => {
    const write = deferredResponse()
    patch.mockReturnValue(write.promise)
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    await act(async () => {
      hook.result.current.onCloseModal()
    })
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    expect(hook.result.current.detail.readPending).toBe(true)
    await act(async () => {
      hook.result.current.detail.onToggleRead()
      hook.result.current.bulk.onReadAll()
    })
    expect(patch).toHaveBeenCalledTimes(1)
    expect(hook.result.current.confirm.kind).toBeNull()
    await act(async () => {
      write.resolve({
        receiptId: 'receipt-1',
        read: true,
        stateRevision: 5,
        unreadCount: 1,
        serverTime: 0,
      })
    })
    expect(hook.result.current.detail).toMatchObject({
      readPending: false,
      value: { stateRevision: 5 },
    })
    hook.unmount()
  })

  it('replaces a pre-commit detail read after reopening while the submitted write settles', async () => {
    const write = deferredResponse(),
      obsoleteDetail = deferredResponse()
    let detailReads = 0
    patch.mockReturnValue(write.promise)
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve(summary)
        : path === '/api/notifications'
          ? Promise.resolve(page)
          : ++detailReads === 1
            ? Promise.resolve(detail)
            : detailReads === 2
              ? obsoleteDetail.promise
              : Promise.resolve({ ...detail, readAt: 123, stateRevision: 5 }),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    await act(async () => {
      hook.result.current.onCloseModal()
    })
    await act(async () => {
      hook.result.current.onOpenModal()
      hook.result.current.onSelect('receipt-1')
    })
    expect(hook.result.current.detail.status).toBe('loading')
    await act(async () => {
      write.resolve({
        receiptId: 'receipt-1',
        read: true,
        stateRevision: 5,
        unreadCount: 1,
        serverTime: 0,
      })
    })
    await waitFor(() =>
      expect(hook.result.current.detail).toMatchObject({
        status: 'ready',
        value: { stateRevision: 5 },
      }),
    )
    await act(async () => {
      obsoleteDetail.resolve(detail)
    })
    expect(hook.result.current.detail.value).toMatchObject({ readAt: 123, stateRevision: 5 })
    expect(patch).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it.each(['success', 'failure'] as const)(
    'does not settle or unlock a new account read on an old account %s',
    async (outcome) => {
      const oldWrite = deferredResponse(),
        newWrite = deferredResponse()
      patch.mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(newWrite.promise)
      const hook = renderHook(() => useNotificationsController())
      await act(async () => {
        hook.result.current.onOpenModal()
        hook.result.current.onSelect('receipt-1')
      })
      await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
      await act(async () => {
        writeToken(window.localStorage, 'second-account')
        bindNotificationsToken('second-account')
      })
      await act(async () => {
        hook.result.current.onOpenModal()
        hook.result.current.onSelect('receipt-1')
      })
      await waitFor(() => expect(patch).toHaveBeenCalledTimes(2))
      const reads = get.mock.calls.length
      await act(async () => {
        if (outcome === 'success')
          oldWrite.resolve({
            receiptId: 'receipt-1',
            read: true,
            stateRevision: 99,
            unreadCount: 0,
            serverTime: 0,
          })
        else
          oldWrite.reject(
            new ExAxiosError('http', 'SESSION_INVALID', 'old account expired', { status: 401 }),
          )
      })
      expect(get.mock.calls).toHaveLength(reads)
      expect(invalidateSession).not.toHaveBeenCalled()
      expect(hook.result.current.detail).toMatchObject({
        readPending: true,
        value: { stateRevision: 4 },
      })
      await act(async () => {
        hook.result.current.detail.onToggleRead()
      })
      expect(patch).toHaveBeenCalledTimes(2)
      await act(async () => {
        newWrite.resolve({
          receiptId: 'receipt-1',
          read: true,
          stateRevision: 5,
          unreadCount: 1,
          serverTime: 0,
        })
      })
      expect(hook.result.current.detail.readPending).toBe(false)
      hook.unmount()
    },
  )

  it('keeps a failed read-write unread and offers a retry', async () => {
    patch.mockRejectedValue(new ExAxiosError('http', 'HTTP_ERROR', '写入失败', { status: 500 }))
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      hook.result.current.onSelect('receipt-1')
    })
    await waitFor(() =>
      expect(hook.result.current.detail.readError).toBe('状态保存失败，正文和未读状态已保留。'),
    )
    expect(patch).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it('refreshes and asks the user to re-check after a 409 read conflict', async () => {
    patch.mockRejectedValue(
      new ExAxiosError('http', 'ACTION_STATE_CONFLICT', '状态已变化', { status: 409 }),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      hook.result.current.onSelect('receipt-1')
    })
    await waitFor(() =>
      expect(hook.result.current.detail.readError).toBe(
        '状态已变化（409），已刷新。请核对后再操作。',
      ),
    )
    // 409 之后重新读取详情，而不是自动重试同一个写。
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith({
        url: '/api/notifications/{notificationId}',
        method: 'GET',
        alert: false,
        pathParams: { notificationId: 'receipt-1' },
      }),
    )
    expect(patch).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it.each(['token', 'scope'] as const)(
    'discards a late list response once the account %s changes',
    async (change) => {
      let release!: (value: unknown) => void
      get.mockImplementation(({ url: path }: { url: string }) => {
        if (path !== '/api/notifications') return routeGetCalls(path)
        return new Promise((resolve) => {
          release = resolve
        })
      })
      const hook = renderHook(() => useNotificationsController())
      await act(async () => {
        hook.result.current.onOpenModal()
      })
      if (change === 'token') {
        writeToken(window.localStorage, 'other-token')
        await act(async () => {
          bindNotificationsToken('other-token')
        })
      } else {
        window.localStorage.setItem(
          `exwebsite.php.auth.v1:${encodeURIComponent(new URL('/scope-b', window.location.origin).href)}`,
          'session-token',
        )
        act(() => selectSessionScope('/scope-b'))
      }
      await act(async () => {
        release(page)
        await Promise.resolve()
      })
      await waitFor(() => expect(notificationsConfig.history.items).toHaveLength(0))
      expect(notificationsConfig.history.status).toBe('idle')
      hook.unmount()
    },
  )

  it('sends the previewed scope and reuses one request id for the clear intent', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : Promise.resolve(page),
    )
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/clear-preview'
        ? Promise.resolve(livePreview())
        : Promise.resolve(clearResult),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      await hook.result.current.bulk.onClearAll()
    })
    expect(post).toHaveBeenCalledWith({
      url: '/api/notifications/clear-preview',
      method: 'POST',
      alert: false,
    })
    expect(hook.result.current.confirm).toMatchObject({ kind: 'clear', count: 3 })

    await act(async () => {
      await hook.result.current.confirm.onSubmit()
    })
    const submit = post.mock.calls.find((call) => call[0].url === '/api/notifications/clear-all')
    expect(submit).toBeTruthy()
    expect(submit![0]).toMatchObject({ data: { clearSnapshotToken: 'clear.snapshot.token' } })
    expect(typeof (submit![0] as { data: { requestId: string } }).data.requestId).toBe('string')
    expect(info).toHaveBeenCalledWith('已清理 2 条，跳过 1 条；新到通知仍保留。')
    hook.unmount()
  })

  /**
   * N1-T2：分页失败后不能重放失效游标。
   *
   * 游标绑的是读取时的上界；分页途中来了新通知（`upperSequence` 一变）或游标过期，
   * 服务端就恒 400/410。重放它只会再报一次同样的错，用户永远卡在
   * 「重试 → 还是失败」的死循环里 —— Tester 的 U02 实测过。
   */
  it('drops the failed cursor and recovers by re-reading the first page', async () => {
    const requestedCursors: (string | undefined)[] = []
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { params?: { cursor?: string } }) => {
        if (path === '/api/notifications/summary') return Promise.resolve(summary)
        if (path !== '/api/notifications') return Promise.resolve(detail)
        const cursor = init?.params?.cursor
        requestedCursors.push(cursor)
        if (cursor !== undefined) {
          // 带游标翻页一律失败：模拟「分页途中来了新通知，旧游标恒 400」。
          return Promise.reject(
            new ExAxiosError('http', 'NOTIFICATION_TOKEN_INVALID', '游标已失效', { status: 400 }),
          )
        }
        // 重读第一页成功，并带回一个新游标。
        return Promise.resolve(pageOf(['N046', 'A'], 'cursor-fresh'))
      },
    )

    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['N046', 'A'])
    expect(hook.result.current.list.hasMore).toBe(true)

    // 翻下一页失败：已加载的通知保留，游标被丢弃（不再给出「加载更多」）。
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    await waitFor(() => expect(hook.result.current.list.nextPageStatus).toBe('error'))
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['N046', 'A'])
    expect(hook.result.current.list.hasMore).toBe(false)

    // 重试：必须重读第一页换新游标，而不是把失效游标再发一次。
    await act(async () => {
      hook.result.current.list.onRetryPage()
    })
    await waitFor(() => expect(hook.result.current.list.nextPageStatus).toBe('idle'))
    expect(requestedCursors).toEqual([undefined, 'cursor-fresh', undefined])
    expect(hook.result.current.list.hasMore).toBe(true)
    hook.unmount()
  })

  it('keeps the loaded rows visible while a failed page is being re-read', async () => {
    // 重读第一页期间不能把列表换成骨架：那等于把「已显示的通知保留」抹掉。
    let secondPageFailed = false
    let firstPageRead = false
    let releaseReload!: (value: unknown) => void
    get.mockImplementation(
      ({ url: path, ...init }: { url: string } & { params?: { cursor?: string } }) => {
        if (path === '/api/notifications/summary') return Promise.resolve(summary)
        if (path !== '/api/notifications') return Promise.resolve(detail)
        const cursor = init?.params?.cursor
        if (cursor !== undefined && !secondPageFailed) {
          secondPageFailed = true
          return Promise.reject(
            new ExAxiosError('http', 'NOTIFICATION_TOKEN_INVALID', '游标已失效', { status: 400 }),
          )
        }
        if (cursor === undefined && firstPageRead) {
          // 第二次读第一页（即重试）挂住，好在「请求在途」时断言列表没被换成骨架。
          return new Promise((resolve) => {
            releaseReload = resolve
          })
        }
        // 第一页带一个游标，这样第一次 onLoadMore 才是真正的「翻下一页」。
        firstPageRead = true
        return Promise.resolve(pageOf(['A'], 'cursor-1'))
      },
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      hook.result.current.list.onLoadMore()
    })
    await waitFor(() => expect(hook.result.current.list.nextPageStatus).toBe('error'))

    // 重读在途：状态仍是 ready（行还在），进度只体现在 nextPageStatus 上。
    await act(async () => {
      hook.result.current.list.onRetryPage()
    })
    await waitFor(() => expect(hook.result.current.list.nextPageStatus).toBe('loading'))
    expect(hook.result.current.list.status).toBe('ready')
    expect(hook.result.current.list.items).toHaveLength(1)

    await act(async () => {
      releaseReload(pageOf(['N046', 'A'], 'cursor-fresh'))
    })
    await waitFor(() => expect(hook.result.current.list.nextPageStatus).toBe('idle'))
    expect(hook.result.current.list.status).toBe('ready')
    expect(hook.result.current.list.items.map((item) => item.title)).toEqual(['N046', 'A'])
    hook.unmount()
  })

  /**
   * 设计 9.2：预览是否过期由**服务端**决定，客户端不能拿本机时钟去推。
   *
   * 判据是 `expiresAt <= Date.now() + (serverTime − 收到响应的本机时刻)`。
   * 直接拿 `Date.now()` 比 `expiresAt` 等于假定两台机器时钟一致，两条例分别让两种
   * 方向的偏移走向相反的错误结论。
   */
  it('treats the preview as expired when the server clock is ahead of this machine', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : Promise.resolve(page),
    )
    // 服务端快 1 小时。`expiresAt` 在本机看还有 30 分钟，但在服务端时钟上已经过期 30 分钟。
    const localNow = Date.now()
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/clear-preview'
        ? Promise.resolve(
            livePreview({
              serverTime: localNow + 3_600_000,
              expiresAt: localNow + 1_800_000,
            }),
          )
        : Promise.resolve(clearResult),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      await hook.result.current.bulk.onClearAll()
    })
    // 跟随服务端判定：过期。本机时钟会误判成「还有 30 分钟」。
    expect(hook.result.current.confirm).toMatchObject({ kind: 'clear', expired: true })
    hook.unmount()
  })

  it('keeps the preview valid when this machine clock is ahead of the server', async () => {
    get.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/summary'
        ? Promise.resolve({ ...summary, unreadCount: 0 })
        : Promise.resolve(page),
    )
    // 反过来：本机快 1 小时。`expiresAt` 在本机看已过期 30 分钟，但服务端还剩 30 分钟。
    const localNow = Date.now()
    post.mockImplementation(({ url: path }: { url: string }) =>
      path === '/api/notifications/clear-preview'
        ? Promise.resolve(
            livePreview({
              serverTime: localNow - 3_600_000,
              expiresAt: localNow - 1_800_000,
            }),
          )
        : Promise.resolve(clearResult),
    )
    const hook = renderHook(() => useNotificationsController())
    await act(async () => {
      hook.result.current.onOpenModal()
    })
    await waitFor(() => expect(hook.result.current.list.status).toBe('ready'))
    await act(async () => {
      await hook.result.current.bulk.onClearAll()
    })
    // 跟随服务端判定：未过期。本机时钟会误判成「已过期」。
    expect(hook.result.current.confirm).toMatchObject({ kind: 'clear', expired: false })
    hook.unmount()
  })

  it('submits read-all with the signed read-through token and keeps new arrivals unread', async () => {
    post.mockResolvedValue(readAllResult)
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(hook.result.current.countState).toEqual({ kind: 'ready', count: 2 }))
    await act(async () => {
      await hook.result.current.bulk.onReadAll()
    })
    expect(hook.result.current.confirm).toMatchObject({ kind: 'read-all', count: 2 })
    await act(async () => {
      await hook.result.current.confirm.onSubmit()
    })
    expect(post).toHaveBeenCalledWith({
      url: '/api/notifications/read-all',
      method: 'POST',
      alert: false,
      data: { requestId: expect.any(String), readThroughToken: 'read.through.token' },
    })
    expect(info).toHaveBeenCalledWith('已标记本次选定通知，新到通知仍未读。')
    hook.unmount()
  })

  it('clears private state and hands the session back on SESSION_INVALID', async () => {
    get.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', '会话已失效', { status: 401 }),
    )
    const hook = renderHook(() => useNotificationsController())
    await waitFor(() => expect(invalidateSession).toHaveBeenCalledWith('session-token'))
    expect(notificationsConfig.summary.unreadCount).toBe(0)
    expect(notificationsConfig.history.items).toHaveLength(0)
    hook.unmount()
  })

  it('hides the bell and stops reading for an anonymous visitor', async () => {
    authState.status = 'anonymous'
    const hook = renderHook(() => useNotificationsController())
    expect(hook.result.current.countState).toEqual({ kind: 'hidden' })
    expect(hook.result.current.authenticated).toBe(false)
    expect(get).not.toHaveBeenCalled()
    hook.unmount()
  })
})

function routeGetCalls(path: string) {
  if (path === '/api/notifications/summary') return Promise.resolve(summary)
  return Promise.resolve(page)
}

function deferredResponse() {
  let resolve!: (value: unknown) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<unknown>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
