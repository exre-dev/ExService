// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorPanel } from '@components/src/ErrorPanel'

let resized: (() => void) | undefined
const disconnect = vi.fn()
class TestResizeObserver {
  constructor(callback: () => void) {
    resized = callback
  }
  observe() {}
  disconnect = disconnect
}
vi.stubGlobal('ResizeObserver', TestResizeObserver)
afterEach(() => {
  cleanup()
  disconnect.mockClear()
  vi.restoreAllMocks()
})
const single = [{ id: 'one', message: '检查失败，请重试' }]

it('leaves no markup for an empty result', () => {
  const { container } = render(
    <ErrorPanel errors={[]} title="错误" action={<button>重试</button>} />,
  )
  expect(container.childElementCount).toBe(0)
})

it('uses one named polite region and a semantic list without the default alert role', () => {
  const { container } = render(<ErrorPanel errors={single} id="feedback" className="custom" />)
  const region = screen.getByRole('region', { name: '错误信息' })
  expect(region.id).toBe('feedback')
  expect(region.classList.contains('custom')).toBe(true)
  expect(region.getAttribute('aria-live')).toBe('polite')
  expect(container.querySelectorAll('[aria-live]').length).toBe(1)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(within(region).getAllByRole('listitem').length).toBe(1)
  expect(screen.queryByText('1')).toBeNull()
  expect(container.querySelector('[data-slot="error-panel-header"]')).toBeNull()
})

it('keeps ordered duplicate messages, optional descriptions, and a title count only for multiple errors', () => {
  const { rerender } = render(
    <ErrorPanel
      title="无法注册"
      errors={[
        { id: 'one', message: '<b>同一问题</b>' },
        { id: 'two', message: '<b>同一问题</b>', description: '修正说明' },
      ]}
    />,
  )
  const region = screen.getByRole('region', { name: /无法注册/ })
  expect(within(region).getAllByText('<b>同一问题</b>')).toHaveLength(2)
  expect(region.querySelector('b')).toBeNull()
  expect(screen.getByText('修正说明')).toBeTruthy()
  expect(
    within(region)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['1<b>同一问题</b>', '2<b>同一问题</b>修正说明'])
  expect(screen.getByText('2 条')).toBeTruthy()
  rerender(<ErrorPanel title="无法注册" errors={single} />)
  expect(screen.queryByText(/条$/)).toBeNull()
  expect(screen.queryByText('修正说明')).toBeNull()
})

it.each([undefined, null])('omits the entire footer for action %s', (action) => {
  const { container } = render(<ErrorPanel errors={single} action={action} />)
  expect(container.querySelector('[data-slot="error-panel-footer"]')).toBeNull()
  expect(container.querySelector('[data-slot="error-panel-footer-separator"]')).toBeNull()
})

it('leaves the caller action independently focusable and runs it only when clicked', async () => {
  const onClick = vi.fn(),
    user = userEvent.setup()
  const { container } = render(
    <ErrorPanel errors={single} action={<button onClick={onClick}>申请加入</button>} />,
  )
  expect(container.querySelector('[data-slot="error-panel-footer"]')).toBeTruthy()
  expect(onClick).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '申请加入' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})

it.each([
  [undefined, 240],
  [160, 160],
  [240, 240],
  [320, 320],
  [160.5, 160.5],
  [159, 240],
  [0, 240],
  [-1, 240],
  [NaN, 240],
  [Infinity, 240],
])('applies maxHeight %s to the whole region as %s px', (maxHeight, effective) => {
  render(<ErrorPanel errors={single} maxHeight={maxHeight} />)
  expect(screen.getByRole('region').style.maxHeight).toBe(`${effective}px`)
})

it('adds a keyboard stop only for measured overflow and removes it on resize', () => {
  render(<ErrorPanel errors={single} />)
  const list = screen.getByRole('list')
  expect(list.hasAttribute('tabindex')).toBe(false)
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 200 })
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 100 })
  act(() => resized?.())
  expect(list.tabIndex).toBe(0)
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 })
  act(() => resized?.())
  expect(list.hasAttribute('tabindex')).toBe(false)
  cleanup()
  expect(disconnect).toHaveBeenCalled()
})

it('resets scroll only when id, message or description changes, without taking input focus', () => {
  const { rerender } = render(
    <>
      <input aria-label="邮箱" />
      <ErrorPanel errors={single} />
    </>,
  )
  const input = screen.getByLabelText('邮箱'),
    list = screen.getByRole('list')
  input.focus()
  list.scrollTop = 35
  rerender(
    <>
      <input aria-label="邮箱" />
      <ErrorPanel errors={single.map((item) => ({ ...item }))} action={<button>重试</button>} />
    </>,
  )
  expect(list.scrollTop).toBe(35)
  for (const errors of [
    [{ ...single[0]!, id: 'two' }],
    [{ id: 'two', message: '新的错误' }],
    [{ id: 'two', message: '新的错误', description: '下一步' }],
  ]) {
    list.scrollTop = 35
    rerender(
      <>
        <input aria-label="邮箱" />
        <ErrorPanel errors={errors} />
      </>,
    )
    expect(list.scrollTop).toBe(0)
  }
  expect(document.activeElement).toBe(input)
})
