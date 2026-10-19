// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationItemList } from '@components/src/notifications/NotificationItemList'
import type { NotificationItemView } from '@components/src/notifications/notificationsView'

afterEach(() => cleanup())

function item(overrides: Partial<NotificationItemView> = {}): NotificationItemView {
  return {
    receiptId: 'receipt-1',
    title: '社区公告',
    summaryText: '摘要文本',
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

describe('NotificationItemList', () => {
  it('exposes each row as a listitem with its own title button', () => {
    render(<NotificationItemList items={[item()]} selectedId={null} onSelect={vi.fn()} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(1)
    expect(screen.getByRole('button', { name: '社区公告' })).toBeTruthy()
    expect(screen.getByText('摘要文本')).toBeTruthy()
    expect(screen.getByText('全站公告')).toBeTruthy()
  })

  it('marks the selected row with aria-current instead of a nested control', () => {
    const { container } = render(
      <NotificationItemList
        items={[item(), item({ receiptId: 'r2', title: '第二条' })]}
        selectedId="r2"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '第二条' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: '社区公告' }).getAttribute('aria-current')).toBeNull()
    // 标题按钮内不能再嵌套可交互元素。
    expect(container.querySelectorAll('button button')).toHaveLength(0)
  })

  it('states unread, read and expired as readable text, not colour alone', () => {
    render(
      <NotificationItemList
        items={[
          item(),
          item({ receiptId: 'r2', title: '第二条', readAt: Date.UTC(2026, 9, 8) }),
          item({ receiptId: 'r3', title: '第三条', expired: true }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('未读')).toBeTruthy()
    expect(screen.getByText('已读')).toBeTruthy()
    expect(screen.getByText('已过期')).toBeTruthy()
  })

  it('reports the selection back by receipt id', async () => {
    const onSelect = vi.fn()
    render(<NotificationItemList items={[item()]} selectedId={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: '社区公告' }))
    expect(onSelect).toHaveBeenCalledWith('receipt-1')
  })

  it('truncates to the requested limit for the popup', () => {
    render(
      <NotificationItemList
        items={Array.from({ length: 6 }, (_, index) =>
          item({ receiptId: `r-${index}`, title: `通知 ${index}` }),
        )}
        selectedId={null}
        onSelect={vi.fn()}
        limit={5}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('renders the caller-supplied empty state instead of a generic one', () => {
    render(
      <NotificationItemList
        items={[]}
        selectedId={null}
        onSelect={vi.fn()}
        empty={<p>没有通知</p>}
      />,
    )
    expect(screen.getByText('没有通知')).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
