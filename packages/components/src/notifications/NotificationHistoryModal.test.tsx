// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  NotificationHistoryModal,
  type NotificationHistoryModalProps,
} from '@components/src/notifications/NotificationHistoryModal'
import type {
  NotificationItemView,
  NotificationDetailView,
} from '@components/src/notifications/notificationsView'

beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
)
afterEach(() => {
  cleanup()
  restoreScrollIntoView()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const originalScrollIntoView = Element.prototype.scrollIntoView
function restoreScrollIntoView() {
  if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
}

const item: NotificationItemView = {
  receiptId: 'receipt-1',
  title: '社区公告标题',
  summaryText: '这是摘要',
  scope: 'community',
  category: 'announcement',
  necessity: 'optional',
  sequence: 3,
  deliveredAt: Date.UTC(2026, 9, 8),
  readAt: null,
  expired: false,
  stateRevision: 1,
}
const readItem: NotificationItemView = {
  ...item,
  receiptId: 'receipt-2',
  title: '已读公告',
  readAt: Date.UTC(2026, 9, 8),
}
const expiredItem: NotificationItemView = {
  ...item,
  receiptId: 'receipt-3',
  title: '过期公告',
  expired: true,
}

const detail: NotificationDetailView = {
  receiptId: 'receipt-1',
  title: '社区公告标题',
  scope: 'community',
  category: 'announcement',
  necessity: 'optional',
  sequence: 3,
  deliveredAt: Date.UTC(2026, 9, 8),
  readAt: null,
  clearedAt: null,
  lifecycle: 'active',
  stateRevision: 1,
  clearRevision: 0,
  contentAvailable: true,
  content: {
    format: 'html',
    schemaVersion: 1,
    policyVersion: 'notification-html-v1',
    html: '<p>正文段落</p>',
    text: '正文段落',
  },
  contentFallbackText: '正文段落',
  actions: [
    {
      actionId: 'open',
      label: '查看社区',
      emphasis: 'primary',
      enabled: true,
      unavailableReason: null,
      navigationTarget: { kind: 'internal', path: '/communities/rifling-911' },
    },
    {
      actionId: 'join',
      label: '加入',
      emphasis: 'secondary',
      enabled: false,
      unavailableReason: 'unsupported',
      navigationTarget: null,
    },
  ],
  actionsAvailable: true,
}

function props(
  overrides: Partial<NotificationHistoryModalProps> = {},
): NotificationHistoryModalProps {
  return {
    countState: { kind: 'ready', count: 2 },
    open: true,
    onClose: vi.fn(),
    selectedId: null,
    onSelect: vi.fn(),
    list: {
      status: 'ready',
      items: [item, readItem, expiredItem],
      hasMore: false,
      nextPageStatus: 'idle',
      filter: 'all',
      onFilterChange: vi.fn(),
      canAutoLoad: false,
      resetVersion: 0,
      onRetryPage: vi.fn(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
    },
    detail: {
      status: 'idle',
      value: null,
      readPending: false,
      readError: null,
      onToggleRead: vi.fn(),
      onRetryRead: vi.fn(),
      onRetryDetail: vi.fn(),
      onNavigate: vi.fn(),
    },
    bulk: {
      pending: null,
      preparing: null,
      error: null,
      onReadAll: vi.fn(),
      onClearAll: vi.fn(),
    },
    confirm: {
      kind: null,
      count: 0,
      pending: false,
      expired: false,
      error: null,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
    },
    ...overrides,
  }
}

describe('NotificationHistoryModal', () => {
  it('loads once per intersection and rechecks continuously visible short pages after layout', async () => {
    const onLoadMore = vi.fn()
    const observe = vi.fn(),
      disconnect = vi.fn()
    let intersect: IntersectionObserverCallback | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
          intersect = callback
          expect(options.root).toBe(screen.getByRole('tabpanel'))
          expect(options.rootMargin).toBe('0px')
        }
        observe = observe
        disconnect = disconnect
      },
    )
    const value = props({ list: { ...props().list, hasMore: true, canAutoLoad: true, onLoadMore } })
    const { rerender, unmount } = render(<NotificationHistoryModal {...value} />)
    act(() => {
      intersect!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
      intersect!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(onLoadMore).toHaveBeenCalledOnce()
    // jsdom has no layout; these coordinates simulate a sentinel still inside the root.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    })
    rerender(
      <NotificationHistoryModal
        {...value}
        list={{ ...value.list, items: [...value.list.items] }}
      />,
    )
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(2))
    rerender(
      <NotificationHistoryModal
        {...value}
        list={{ ...value.list, hasMore: false, canAutoLoad: false }}
      />,
    )
    expect(disconnect).toHaveBeenCalled()
    unmount()
    expect(observe).toHaveBeenCalledTimes(2)
  })

  it('does not observe while a page is paused in error, confirmation is open or phone body is visible', () => {
    const constructor = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {
          constructor()
        }
        observe() {}
        disconnect() {}
      },
    )
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const value = props({ list: { ...props().list, hasMore: true, canAutoLoad: true } })
    const { rerender } = render(<NotificationHistoryModal {...value} selectedId="receipt-1" />)
    expect(constructor).not.toHaveBeenCalled()
    rerender(
      <NotificationHistoryModal {...value} list={{ ...value.list, nextPageStatus: 'error' }} />,
    )
    expect(constructor).not.toHaveBeenCalled()
    rerender(
      <NotificationHistoryModal {...value} confirm={{ ...value.confirm, kind: 'read-all' }} />,
    )
    expect(constructor).not.toHaveBeenCalled()
  })

  it('ignores a queued observer callback after automatic paging is paused', () => {
    let queued: IntersectionObserverCallback | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          queued = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    const onLoadMore = vi.fn()
    const value = props({ list: { ...props().list, hasMore: true, canAutoLoad: true, onLoadMore } })
    const { rerender } = render(<NotificationHistoryModal {...value} />)
    rerender(<NotificationHistoryModal {...value} list={{ ...value.list, canAutoLoad: false }} />)
    act(() =>
      queued!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
    )
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it('restores focus to the active Tab on phone back when the selected row vanished', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    render(<NotificationHistoryModal {...props({ selectedId: 'vanished' })} />)
    await userEvent.click(screen.getByRole('button', { name: '返回列表' }))
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: '全部' }))
  })

  it('preserves phone return position after a background read refresh replaces the first page', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const value = props()
    const { rerender } = render(<NotificationHistoryModal {...value} />)
    const list = screen.getByRole('tabpanel')
    list.scrollTop = 240
    await userEvent.click(screen.getByRole('button', { name: item.title }))
    rerender(
      <NotificationHistoryModal
        {...value}
        selectedId={item.receiptId}
        detail={{ ...value.detail, status: 'ready', value: detail }}
      />,
    )
    rerender(
      <NotificationHistoryModal
        {...value}
        selectedId={item.receiptId}
        list={{ ...value.list, resetVersion: 1 }}
        detail={{ ...value.detail, status: 'ready', value: detail }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '返回列表' }))
    expect(list.scrollTop).toBe(240)
    expect(document.activeElement?.textContent).toContain(item.title)
  })

  it('shows durable preparation and submission errors with explicit retry controls', () => {
    const value = props()
    const { rerender } = render(
      <NotificationHistoryModal {...value} bulk={{ ...value.bulk, error: '准备失败' }} />,
    )
    expect(screen.getByRole('alert').textContent).toContain('准备失败')
    expect(screen.getByRole('button', { name: '重新准备' })).toBeTruthy()
    rerender(
      <NotificationHistoryModal
        {...value}
        confirm={{ ...value.confirm, kind: 'read-all', error: '提交失败，原状态已保留' }}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('提交失败，原状态已保留')
    expect(screen.getByRole('button', { name: '确认全部已读' })).toBeTruthy()
  })

  it('retries the failed preparation intent when the summary is no longer ready', async () => {
    const value = props()
    const { rerender } = render(
      <NotificationHistoryModal {...value} bulk={{ ...value.bulk, preparing: 'read-all' }} />,
    )
    rerender(
      <NotificationHistoryModal
        {...value}
        countState={{ kind: 'error' }}
        bulk={{ ...value.bulk, error: '准备失败' }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '重新准备' }))
    expect(value.bulk.onReadAll).toHaveBeenCalledOnce()
    expect(value.bulk.onClearAll).not.toHaveBeenCalled()
  })

  it('uses accessible Tabs and one global bulk action independent of loaded unread rows', async () => {
    const onFilterChange = vi.fn()
    render(
      <NotificationHistoryModal
        {...props({ list: { ...props().list, items: [readItem], onFilterChange } })}
      />,
    )
    const tablist = screen.getByRole('tablist')
    expect(tablist.querySelectorAll('[role="tab"]').length).toBe(2)
    expect(screen.queryByRole('button', { name: '清理全部' })).toBeNull()
    expect((screen.getByRole('button', { name: '已读全部' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect(screen.queryByText(/已加载 \d+ 条/)).toBeNull()
    expect(screen.queryByRole('button', { name: '恢复清理记录' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: '未读' }))
    expect(onFilterChange).toHaveBeenCalledWith('unread')
  })

  it('allows global clear in an empty unread tab and disables it only for known empty history', () => {
    const value = props({
      countState: { kind: 'ready', count: 0 },
      list: { ...props().list, filter: 'unread', items: [] },
    })
    const { rerender } = render(<NotificationHistoryModal {...value} />)
    expect((screen.getByRole('button', { name: '清理全部' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    rerender(<NotificationHistoryModal {...value} list={{ ...value.list, filter: 'all' }} />)
    expect((screen.getByRole('button', { name: '清理全部' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('disables bulk work while the count is unknown, failed, preparing or submitting', () => {
    const value = props()
    const { rerender } = render(
      <NotificationHistoryModal {...value} countState={{ kind: 'loading' }} />,
    )
    expect((screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    rerender(<NotificationHistoryModal {...value} countState={{ kind: 'error' }} />)
    expect((screen.getByRole('button', { name: '加载中…' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    rerender(
      <NotificationHistoryModal {...value} bulk={{ ...value.bulk, preparing: 'read-all' }} />,
    )
    expect((screen.getByRole('button', { name: '已读全部' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    rerender(<NotificationHistoryModal {...value} bulk={{ ...value.bulk, pending: 'read-all' }} />)
    expect(
      (screen.getByRole('button', { name: '关闭通知历史' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('opens with no selection and never auto-selects or reads the first row', () => {
    render(<NotificationHistoryModal {...props()} />)
    expect(screen.getByText('点击通知查看内容')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '选择通知' })).toBeNull()
    const titles = screen.getAllByRole('button').map((button) => button.textContent)
    expect(titles).toContain('社区公告标题')
    expect(screen.queryByRole('button', { name: '标为已读' })).toBeNull()
  })

  it('shows every state in the list with a readable label instead of colour alone', () => {
    render(<NotificationHistoryModal {...props()} />)
    expect(screen.getAllByText('未读').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已读').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已过期').length).toBeGreaterThan(0)
  })

  /**
   * 计数措辞：Contract 不返回总数，所以只能说**已加载**多少条。
   * 说成「共 N 条」或「N 条历史」会被读成总数，而翻页还没到底时它并不是总数。
   */

  it('selects a row through the shared list without writing state itself', async () => {
    const onSelect = vi.fn()
    render(<NotificationHistoryModal {...props({ onSelect })} />)
    await userEvent.click(screen.getByRole('button', { name: '社区公告标题' }))
    expect(onSelect).toHaveBeenCalledWith('receipt-1')
  })

  it('renders the selected body, marks the active action navigable and disables unsupported ones', async () => {
    const onNavigate = vi.fn()
    render(
      <NotificationHistoryModal
        {...props({
          selectedId: 'receipt-1',
          detail: { ...props().detail, status: 'ready', value: detail, onNavigate },
        })}
      />,
    )
    expect(screen.getByRole('heading', { name: '社区公告标题' })).toBeTruthy()
    expect(screen.getByText('正文段落')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '查看社区' }))
    expect(onNavigate).toHaveBeenCalledWith('/communities/rifling-911')

    const disabled = screen.getByRole('button', { name: '加入' }) as HTMLButtonElement
    expect(disabled.disabled).toBe(true)
    expect(disabled.title).toBe('此操作尚未接入。')
    expect(screen.getByText('加入：此操作尚未接入。')).toBeTruthy()
  })

  it('keeps the body readable after expiry and says expiry is not counted as unread', () => {
    render(
      <NotificationHistoryModal
        {...props({
          selectedId: 'receipt-1',
          detail: {
            ...props().detail,
            status: 'ready',
            value: { ...detail, lifecycle: 'expired' },
          },
        })}
      />,
    )
    expect(screen.getByText('这条通知已过期，保留正文供查阅。')).toBeTruthy()
    expect(screen.getByText('过期通知不计入未读。')).toBeTruthy()
    expect(screen.getByText('正文段落')).toBeTruthy()
  })

  it('offers retry inside the detail pane when the body cannot be read', async () => {
    const onRetryDetail = vi.fn()
    render(
      <NotificationHistoryModal
        {...props({
          selectedId: 'receipt-1',
          detail: { ...props().detail, status: 'error', onRetryDetail },
        })}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '重试正文' }))
    expect(onRetryDetail).toHaveBeenCalledOnce()
  })

  it('asks for confirmation before a global clear and reports the previewed scope', async () => {
    const onSubmit = vi.fn()
    render(
      <NotificationHistoryModal
        {...props({
          confirm: {
            kind: 'clear',
            count: 12,
            pending: false,
            expired: false,
            error: null,
            onCancel: vi.fn(),
            onSubmit,
          },
        })}
      />,
    )
    expect(screen.getByRole('heading', { name: '清理这 12 条通知？' })).toBeTruthy()
    expect(screen.getByText(/将清理预览时的 12 条通知/)).toBeTruthy()
    expect(screen.getByText('清理消息不会取消活动参与。')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '确认清理' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('blocks submission once the preview token has expired', () => {
    render(
      <NotificationHistoryModal
        {...props({
          confirm: {
            kind: 'clear',
            count: 12,
            pending: false,
            expired: true,
            error: null,
            onCancel: vi.fn(),
            onSubmit: vi.fn(),
          },
        })}
      />,
    )
    expect(screen.getByText('预览已过期，请重新预览。')).toBeTruthy()
    expect((screen.getByRole('button', { name: '确认清理' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('keeps the unread-only filter empty state distinguishable from an empty history', () => {
    const view = render(
      <NotificationHistoryModal
        {...props({
          list: { ...props().list, items: [], filter: 'unread' },
        })}
      />,
    )
    expect(screen.getByRole('heading', { name: '暂时没有未读通知' })).toBeTruthy()
    expect(screen.getByText('当前历史均已读或已过期。可以切回全部历史。')).toBeTruthy()
    view.unmount()

    render(<NotificationHistoryModal {...props({ list: { ...props().list, items: [] } })} />)
    expect(screen.getByRole('heading', { name: '还没有通知历史' })).toBeTruthy()
  })

  /**
   * 分页失败：保留已加载的行，只在这一页尾部给重试（设计 9.3）。
   *
   * 控制器此时已经把失效游标丢掉了（`hasMore` 为 false），所以重试做的是
   * **从第一页重读**换取新游标。按钮文案必须照实写「重新加载通知」——
   * 写「重试下一页」却重读整份列表，就是 B2 里「保留草稿」那样文案与行为互相矛盾。
   */
  it('retries a failed next page without discarding the loaded rows', async () => {
    const onLoadMore = vi.fn()
    render(
      <NotificationHistoryModal
        {...props({
          list: {
            ...props().list,
            hasMore: false,
            nextPageStatus: 'error',
            onRetryPage: onLoadMore,
          },
        })}
      />,
    )
    expect(screen.getByText('通知暂时无法继续加载')).toBeTruthy()
    // 已加载的行仍然在，不能被错误面板顶掉。
    expect(screen.getAllByText('社区公告标题').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '重试下一页' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '重新加载通知' }))
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('shows a reloading state instead of blanking the list while the retry is in flight', async () => {
    // 重读期间 `hasMore` 为 false 且 `nextPageStatus` 为 loading：列表必须留着，
    // 只给一个「正在重新加载…」，不能退回骨架（那等于把已加载内容抹掉）。
    render(
      <NotificationHistoryModal
        {...props({
          list: { ...props().list, hasMore: false, nextPageStatus: 'loading' },
        })}
      />,
    )
    expect(screen.getByRole('status').textContent).toBe('正在重新加载…')
    expect(screen.getAllByText('社区公告标题').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '加载更多' })).toBeNull()
  })

  it('offers a list-level retry when the first page fails', async () => {
    const onRetry = vi.fn()
    render(
      <NotificationHistoryModal
        {...props({
          list: { ...props().list, status: 'error', items: [], onRetry },
        })}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '重试加载' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('keeps both scroll containers so the list and the body scroll independently', () => {
    render(
      <NotificationHistoryModal
        {...props({
          selectedId: 'receipt-1',
          detail: { ...props().detail, status: 'ready', value: detail },
        })}
      />,
    )
    const list = screen.getByRole('region', { name: '通知列表' })
    const body = screen.getByRole('region', { name: '通知正文' })
    expect(list).toBeTruthy()
    expect(body).toBeTruthy()
    expect(list.contains(body)).toBe(false)
  })

  it('closes through the explicit header control', async () => {
    const onClose = vi.fn()
    render(<NotificationHistoryModal {...props({ onClose })} />)
    await userEvent.click(screen.getByRole('button', { name: '关闭通知历史' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('keeps all dismissal paths blocked during bulk submission and restores them afterward', async () => {
    const onClose = vi.fn()
    const value = props({ onClose, bulk: { ...props().bulk, pending: 'clear' } })
    const view = render(<NotificationHistoryModal {...value} />)
    const close = screen.getByRole('button', { name: '关闭通知历史' }) as HTMLButtonElement
    expect(close.disabled).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(onClose).not.toHaveBeenCalled()

    view.rerender(<NotificationHistoryModal {...value} bulk={{ ...value.bulk, pending: null }} />)
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('returns final focus when the history closes', async () => {
    const finalFocus = document.createElement('button')
    document.body.append(finalFocus)
    try {
      const value = props({ finalFocusRef: { current: finalFocus } })
      const view = render(<NotificationHistoryModal {...value} />)
      view.rerender(<NotificationHistoryModal {...value} open={false} />)
      await waitFor(() => expect(document.activeElement).toBe(finalFocus))
    } finally {
      finalFocus.remove()
    }
  })

  it('allows outside dismissal again after bulk submission settles', async () => {
    const onClose = vi.fn()
    const value = props({ onClose, bulk: { ...props().bulk, pending: 'read-all' } })
    const view = render(<NotificationHistoryModal {...value} />)
    const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement
    await userEvent.click(overlay)
    expect(onClose).not.toHaveBeenCalled()
    view.rerender(<NotificationHistoryModal {...value} bulk={{ ...value.bulk, pending: null }} />)
    await userEvent.click(overlay)
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('keeps the history open after cancelling its nested confirmation', async () => {
    const onClose = vi.fn()
    const onCancel = vi.fn()
    const value = props({ onClose, confirm: { ...props().confirm, kind: 'clear', onCancel } })
    const view = render(<NotificationHistoryModal {...value} />)
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
    view.rerender(
      <NotificationHistoryModal {...value} confirm={{ ...value.confirm, kind: null }} />,
    )
    expect(screen.getByRole('dialog', { name: '通知历史' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
