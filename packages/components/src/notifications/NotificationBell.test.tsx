// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  NotificationBell,
  type NotificationBellProps,
} from '@components/src/notifications/NotificationBell'
import type { NotificationItemView } from '@components/src/notifications/notificationsView'

afterEach(() => cleanup())

function item(overrides: Partial<NotificationItemView> = {}): NotificationItemView {
  return {
    receiptId: 'receipt-1',
    title: '社区公告',
    summaryText: '摘要',
    scope: 'community',
    category: 'announcement',
    necessity: 'optional',
    sequence: 3,
    deliveredAt: Date.UTC(2026, 9, 8),
    readAt: null,
    expired: false,
    stateRevision: 1,
    ...overrides,
  }
}

function props(overrides: Partial<NotificationBellProps> = {}): NotificationBellProps {
  return {
    countState: { kind: 'ready', count: 3 },
    status: 'ready',
    items: [item()],
    open: false,
    onOpenChange: vi.fn(),
    onViewAll: vi.fn(),
    onSelect: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
}

describe('NotificationBell', () => {
  it('names the bell with the live unread count', () => {
    render(<NotificationBell {...props()} />)
    expect(screen.getByRole('button', { name: '未读通知，3 条' })).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('caps the badge at 99+ because the API returns a safe integer', () => {
    render(<NotificationBell {...props({ countState: { kind: 'ready', count: 420 } })} />)
    expect(screen.getByText('99+')).toBeTruthy()
  })

  it('shows the count as stale instead of zero when the summary failed', () => {
    render(<NotificationBell {...props({ countState: { kind: 'error' } })} />)
    expect(screen.getByRole('button', { name: '未读通知，计数未更新' })).toBeTruthy()
    expect(screen.getByText('!')).toBeTruthy()
  })

  it('shows a pending marker while the summary is loading', () => {
    render(<NotificationBell {...props({ countState: { kind: 'loading' } })} />)
    expect(screen.getByText('…')).toBeTruthy()
  })

  it('renders no badge while the visitor is signed out', () => {
    render(<NotificationBell {...props({ countState: { kind: 'hidden' } })} />)
    expect(screen.getByRole('button', { name: '未读通知' })).toBeTruthy()
  })

  it('renders no badge node for confirmed zero and remains clickable with history', async () => {
    const onOpenChange = vi.fn()
    render(
      <NotificationBell {...props({ countState: { kind: 'ready', count: 0 }, onOpenChange })} />,
    )
    const bell = screen.getByRole('button', { name: '未读通知，0 条' })
    expect(bell.querySelector('span')).toBeNull()
    await userEvent.click(bell)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('opens the popup on View all focus and shows at most five unread rows', async () => {
    const onOpenChange = vi.fn()
    render(
      <NotificationBell
        {...props({
          open: true,
          onOpenChange,
          items: Array.from({ length: 7 }, (_, index) =>
            item({ receiptId: `r-${index}`, title: `通知 ${index}` }),
          ),
        })}
      />,
    )
    expect(document.activeElement).toHaveProperty('textContent', '查看全部')
    expect(screen.getByRole('heading', { name: '未读通知' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText('打开面板不会自动标为已读。')).toBeNull()
  })

  it('keeps the empty state and View all when there is nothing unread', () => {
    render(<NotificationBell {...props({ open: true, items: [] })} />)
    expect(screen.getByRole('heading', { name: '暂时没有未读通知' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看全部' })).toBeTruthy()
  })

  it('opens the history modal from View all without selecting anything', async () => {
    const onViewAll = vi.fn()
    render(<NotificationBell {...props({ open: true, onViewAll })} />)
    await userEvent.click(screen.getByRole('button', { name: '查看全部' }))
    expect(onViewAll).toHaveBeenCalledOnce()
  })

  it('passes the selected row up so the modal can open on it', async () => {
    const onSelect = vi.fn()
    render(<NotificationBell {...props({ open: true, onSelect })} />)
    await userEvent.click(screen.getByRole('button', { name: '社区公告' }))
    expect(onSelect).toHaveBeenCalledWith('receipt-1')
  })

  it('offers a retry inside the popup when the unread page fails', async () => {
    const onRetry = vi.fn()
    render(<NotificationBell {...props({ open: true, status: 'error', items: [], onRetry })} />)
    expect(screen.getByRole('alert').textContent).toContain('通知暂时无法加载，计数未更新。')
    await userEvent.click(screen.getByRole('button', { name: '重试加载' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows a loading placeholder before the first unread page arrives', () => {
    render(<NotificationBell {...props({ open: true, status: 'loading', items: [] })} />)
    expect(screen.getByLabelText('正在加载通知')).toBeTruthy()
  })
})
