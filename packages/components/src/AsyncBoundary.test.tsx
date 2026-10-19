// @vitest-environment jsdom
import { StrictMode, lazy, type ComponentType } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AsyncBoundary } from './AsyncBoundary'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AsyncBoundary', () => {
  it('delays feedback 150ms without moving focus and cancels the timer on completion', () => {
    vi.useFakeTimers()
    const view = render(
      <>
        <input aria-label="原有输入" />
        <AsyncBoundary loading loadingTitle="正在读取内容" loadingDescription="请稍候。" />
      </>,
    )
    const input = screen.getByRole('textbox')
    input.focus()
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    act(() => vi.advanceTimersByTime(149))
    expect(status.textContent).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status', { name: '正在读取内容' })).toBe(status)
    expect(document.getElementById(status.getAttribute('aria-describedby')!)?.textContent).toBe(
      '请稍候。',
    )
    expect(document.activeElement).toBe(input)
    view.rerender(
      <AsyncBoundary>
        <p>Ready</p>
      </AsyncBoundary>,
    )
    expect(screen.queryByRole('status')).toBeNull()
    view.rerender(
      <StrictMode>
        <AsyncBoundary loading />
      </StrictMode>,
    )
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(100))
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits for its loader and passes the resolved data to children', async () => {
    const request = deferred<{ title: string }>()
    render(
      <AsyncBoundary loader={() => request.promise}>{(data) => <p>{data.title}</p>}</AsyncBoundary>,
    )
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('Loaded content')).toBeNull()
    await act(async () => request.resolve({ title: 'Loaded content' }))
    expect(screen.getByText('Loaded content')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows ordinary JSX only after its loader finishes, including void results', async () => {
    const request = deferred<void>()
    render(
      <AsyncBoundary loader={() => request.promise}>
        <p>Ready JSX</p>
      </AsyncBoundary>,
    )
    expect(screen.queryByText('Ready JSX')).toBeNull()
    await act(async () => request.resolve())
    expect(screen.getByText('Ready JSX')).toBeTruthy()
  })

  it('discloses the real loader error inline, copies the full report, and retries', async () => {
    const failure = new Error('A real load failure <script>text only</script>')
    failure.stack =
      'Error: A real load failure\n' +
      '    at loadContent (fixture.tsx:12:3)\n'.repeat(20) +
      '    at finalFrame'
    const copy = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    })
    let attempts = 0
    const loader = async () => {
      if (++attempts === 1) throw failure
      return 'Recovered'
    }
    const { container } = render(
      <AsyncBoundary loader={loader} homeUrl="/">
        {(data) => <p>{data}</p>}
      </AsyncBoundary>,
    )
    await screen.findByText('内容暂时无法加载')
    expect(screen.queryByText(failure.message)).toBeNull()
    const disclosure = screen.getByRole('link', { name: '查看错误' })
    expect(disclosure.closest('p')).toBeTruthy()
    fireEvent.click(disclosure)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('region', { name: '可滚动的错误详情' })).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '复制完整错误信息' }))
    await screen.findByText('已复制')
    expect(copy).toHaveBeenCalledOnce()
    expect(copy.mock.calls[0]![0]).toContain(failure.message)
    expect(copy.mock.calls[0]![0]).toContain('finalFrame')
    const retry = screen.getByRole('button', { name: '重试' })
    const home = screen.getByRole('link', { name: '返回首页' })
    expect(retry.parentElement).toBe(home.parentElement)
    expect(retry.nextElementSibling).toBe(home)
    fireEvent.click(screen.getByRole('link', { name: '收起错误' }))
    expect(screen.queryByRole('region', { name: '可滚动的错误详情' })).toBeNull()
    fireEvent.click(retry)
    await screen.findByText('Recovered')
    expect(attempts).toBe(2)
    expect(screen.queryByRole('link', { name: '查看错误' })).toBeNull()
  })

  it('captures a descendant render failure and retries a fresh descendant tree', async () => {
    let broken = true
    function Content() {
      if (broken) throw new Error('Render failed')
      return <p>Render recovered</p>
    }
    render(
      <AsyncBoundary>
        <Content />
      </AsyncBoundary>,
    )
    await screen.findByText('这部分内容暂时无法显示')
    fireEvent.click(screen.getByRole('link', { name: '查看错误' }))
    expect(screen.getByRole('region', { name: '可滚动的错误详情' }).textContent).toContain(
      'Render failed',
    )
    broken = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await screen.findByText('Render recovered')
  })

  it('also catches exceptions thrown by the resolved-data render function', async () => {
    render(
      <AsyncBoundary loader={async () => 'data'}>
        {() => {
          throw new Error('Render function failed')
        }}
      </AsyncBoundary>,
    )
    await screen.findByText('这部分内容暂时无法显示')
    fireEvent.click(screen.getByRole('link', { name: '查看错误' }))
    expect(screen.getByRole('region', { name: '可滚动的错误详情' }).textContent).toContain(
      'Render function failed',
    )
  })

  it('aborts obsolete loads and never reveals a stale result after resetKey changes', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const signals: AbortSignal[] = []
    const view = render(
      <AsyncBoundary
        resetKey="first"
        loader={(signal) => {
          signals.push(signal)
          return first.promise
        }}
      >
        {(data) => <p>{data}</p>}
      </AsyncBoundary>,
    )
    view.rerender(
      <AsyncBoundary
        resetKey="second"
        loader={(signal) => {
          signals.push(signal)
          return second.promise
        }}
      >
        {(data) => <p>{data}</p>}
      </AsyncBoundary>,
    )
    expect(signals[0]!.aborted).toBe(true)
    await act(async () => second.resolve('Second result'))
    await act(async () => first.resolve('Obsolete first result'))
    expect(screen.queryByText('Obsolete first result')).toBeNull()
    expect(screen.getByText('Second result')).toBeTruthy()
    view.unmount()
    expect(signals.at(-1)!.aborted).toBe(true)
  })

  it('does not restart a loader solely because its inline function identity changes', async () => {
    let requests = 0
    const load = async () => {
      requests++
      return 'Content'
    }
    const view = render(
      <AsyncBoundary resetKey="same" loader={() => load()}>
        <p>Ready</p>
      </AsyncBoundary>,
    )
    await screen.findByText('Ready')
    view.rerender(
      <AsyncBoundary resetKey="same" loader={() => load()}>
        <p>Still ready</p>
      </AsyncBoundary>,
    )
    expect(screen.getByText('Still ready')).toBeTruthy()
    expect(requests).toBe(1)
  })

  it('ignores the discarded StrictMode load and cancels the active load on unmount', async () => {
    const runs: { signal: AbortSignal; request: ReturnType<typeof deferred<string>> }[] = []
    const loader = (signal: AbortSignal) => {
      const request = deferred<string>()
      runs.push({ signal, request })
      return request.promise
    }
    const view = render(
      <StrictMode>
        <AsyncBoundary loader={loader}>{(data) => <p>{data}</p>}</AsyncBoundary>
      </StrictMode>,
    )
    expect(runs).toHaveLength(2)
    expect(runs[0]!.signal.aborted).toBe(true)
    await act(async () => runs[0]!.request.resolve('Discarded'))
    expect(screen.queryByText('Discarded')).toBeNull()
    await act(async () => runs[1]!.request.resolve('Active'))
    expect(screen.getByText('Active')).toBeTruthy()
    view.unmount()
    expect(runs[1]!.signal.aborted).toBe(true)
  })

  it('uses externally owned state without starting an additional request', async () => {
    const retry = vi.fn()
    const view = render(
      <AsyncBoundary loading onRetry={retry}>
        <p>Controlled content</p>
      </AsyncBoundary>,
    )
    expect(screen.queryByText('Controlled content')).toBeNull()
    view.rerender(
      <AsyncBoundary error={new Error('External failure')} onRetry={retry}>
        <p>Controlled content</p>
      </AsyncBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(retry).toHaveBeenCalledOnce()
    view.rerender(
      <AsyncBoundary loading onRetry={retry}>
        <p>Controlled content</p>
      </AsyncBoundary>,
    )
    expect(screen.queryByText('内容暂时无法加载')).toBeNull()
    view.rerender(
      <AsyncBoundary onRetry={retry}>
        <p>Controlled content</p>
      </AsyncBoundary>,
    )
    expect(screen.getByText('Controlled content')).toBeTruthy()
  })

  it('resets a render failure when resetKey changes', async () => {
    function Broken(): never {
      throw new Error('Previous page')
    }
    const view = render(
      <AsyncBoundary resetKey="old">
        <Broken />
      </AsyncBoundary>,
    )
    await screen.findByText('这部分内容暂时无法显示')
    view.rerender(
      <AsyncBoundary resetKey="new">
        <p>New page</p>
      </AsyncBoundary>,
    )
    expect(screen.getByText('New page')).toBeTruthy()
  })

  it('also composes Suspense for lazy children', async () => {
    const request = deferred<{ default: ComponentType }>()
    const Content = lazy(() => request.promise)
    render(
      <AsyncBoundary>
        <Content />
      </AsyncBoundary>,
    )
    expect(screen.getByRole('status')).toBeTruthy()
    await act(async () => request.resolve({ default: () => <p>Lazy content</p> }))
    await waitFor(() => expect(screen.getByText('Lazy content')).toBeTruthy())
  })
})
