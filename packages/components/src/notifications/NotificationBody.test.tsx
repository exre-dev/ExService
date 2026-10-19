// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  NotificationBody,
  hasRenderableNotificationBody,
} from '@components/src/notifications/NotificationBody'
import type { NotificationContentInput } from '@components/src/notifications/notificationContent'

afterEach(() => cleanup())

const html: NotificationContentInput = {
  format: 'html',
  schemaVersion: 1,
  policyVersion: 'notification-html-v1',
  html:
    '<h2>小标题</h2><p>段落与<a href="/communities/rifling-911">社区主页</a>。</p>' +
    '<ul><li>一条</li></ul><table><thead><tr><th scope="col">列</th></tr></thead>' +
    '<tbody><tr><td>值</td></tr></tbody></table>',
  text: '小标题\n段落与社区主页。\n一条\n列 值',
}

describe('NotificationBody', () => {
  it('renders the safe tree as real elements without an HTML sink', () => {
    const { container } = render(<NotificationBody content={html} fallbackText={html.text} />)
    expect(screen.getByRole('heading', { name: '小标题' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '社区主页' }).getAttribute('href')).toBe(
      '/communities/rifling-911',
    )
    expect(screen.getByRole('region', { name: '通知正文表格，可横向滚动' })).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).not.toContain('dangerouslySetInnerHTML')
  })

  it('marks the column scope from the safe tree', () => {
    render(<NotificationBody content={html} fallbackText={html.text} />)
    expect(screen.getByRole('columnheader', { name: '列' }).getAttribute('scope')).toBe('col')
  })

  it('falls back to the full plain text when the format is unavailable', () => {
    render(
      <NotificationBody
        content={{ ...html, policyVersion: 'notification-html-v9' }}
        fallbackText={html.text}
      />,
    )
    expect(screen.getByText('正文格式暂不可用，以下为完整文字。')).toBeTruthy()
    expect(screen.getByText(/小标题/)).toBeTruthy()
    // 回退不渲染任何原始标记。
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders nothing when neither the tree nor the fallback is usable', () => {
    const { container } = render(<NotificationBody content={html} fallbackText={null} />)
    expect(container.querySelector('h2')).toBeTruthy()
    const empty = render(
      <NotificationBody
        content={{ ...html, policyVersion: 'notification-html-v9' }}
        fallbackText={null}
      />,
    )
    expect(empty.container.textContent).toBe('')
  })

  it('reports whether the caller can safely render anything', () => {
    expect(hasRenderableNotificationBody(html, html.text)).toBe(true)
    expect(hasRenderableNotificationBody({ ...html, schemaVersion: 2 }, html.text)).toBe(true)
    expect(hasRenderableNotificationBody({ ...html, schemaVersion: 2 }, null)).toBe(false)
    expect(hasRenderableNotificationBody(null, null)).toBe(false)
  })
})
