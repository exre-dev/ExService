// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContentAreaState, SettingsContentSkeleton } from '@components/src/ContentAreaState'

afterEach(cleanup)

describe('ContentAreaState', () => {
  it('fills the content area with an accessible loading skeleton', () => {
    render(<ContentAreaState status="loading" skeleton={<SettingsContentSkeleton />} />)
    expect(screen.getByRole('status', { name: '正在加载' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('replaces the skeleton with an error and retries', async () => {
    const retry = vi.fn()
    const view = render(
      <ContentAreaState status="loading" skeleton={<SettingsContentSkeleton />} />,
    )
    view.rerender(<ContentAreaState status="error" errorMessage="读取失败" onRetry={retry} />)
    expect(screen.queryByRole('status', { name: '正在加载' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('读取失败')
    await userEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('renders the supplied successful content', () => {
    render(
      <ContentAreaState status="ready">
        <article>设置内容</article>
      </ContentAreaState>,
    )
    expect(screen.getByText('设置内容')).toBeTruthy()
  })
})
