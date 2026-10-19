// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@exre/exui'
import { useState } from 'react'
import { MemberModal } from './MemberModal'

vi.mock('../../content/about/registry', () => ({
  aboutStore: {},
  aboutRegistry: {
    members: [
      {
        slug: 'member',
        id: 'member-page',
        title: '测试成员',
        role: '设计',
        summary: '成员简介',
        links: [],
      },
    ],
  },
}))
vi.mock('../../content/useContent', () => ({
  useContent: () => ({ status: 'loaded', retry: vi.fn() }),
}))
vi.mock('./AboutBody', () => ({ AboutBody: () => <p>成员正文</p> }))
let mobile = false
vi.stubGlobal('matchMedia', (media: string) => ({
  media,
  matches: mobile,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  mobile = false
})

it('covers the viewport width in responsive fullscreen mode', async () => {
  mobile = true
  render(
    <ThemeProvider defaultTheme="light">
      <MemberModal
        slug="member"
        trigger={document.createElement('button')}
        components={{}}
        onClose={vi.fn()}
      />
    </ThemeProvider>,
  )
  const dialog = screen.getByRole('dialog', { name: '测试成员' })
  await waitFor(() => expect(dialog.getAttribute('data-exui-fullscreen')).not.toBeNull())
  expect(dialog.style.width).toBe('100vw')
  expect(dialog.style.maxWidth).toBe('100vw')
})

it('renders the member in a scrolling dialog and restores focus to its trigger', () => {
  const trigger = document.createElement('button')
  trigger.textContent = '打开成员'
  document.body.append(trigger)
  vi.spyOn(trigger, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList)
  const onClose = vi.fn()
  function Host() {
    const [open, setOpen] = useState(true)
    return open ? (
      <MemberModal
        slug="member"
        trigger={trigger}
        components={{}}
        onClose={() => {
          onClose()
          setOpen(false)
        }}
      />
    ) : null
  }
  render(
    <ThemeProvider defaultTheme="light">
      <Host />
    </ThemeProvider>,
  )
  const dialog = screen.getByRole('dialog', { name: '测试成员' })
  expect(dialog.querySelector('[data-slot="dialog-body"]')?.textContent).toContain('成员正文')
  fireEvent.click(screen.getByRole('button', { name: '关闭成员简介' }))
  expect(onClose).toHaveBeenCalledOnce()
  return waitFor(() => expect(document.activeElement).toBe(trigger)).finally(() => trigger.remove())
})

it.each(['detached', 'disabled'] as const)(
  'returns focus to the page heading when its trigger is %s',
  async (state) => {
    const trigger = document.createElement('button')
    if (state === 'disabled') {
      trigger.disabled = true
      document.body.append(trigger)
      vi.spyOn(trigger, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList)
    }
    const onClose = vi.fn()
    function Host() {
      const [open, setOpen] = useState(true)
      return (
        <main>
          <h1 tabIndex={-1}>关于我们</h1>
          {open && (
            <MemberModal
              slug="member"
              trigger={trigger}
              components={{}}
              onClose={() => {
                onClose()
                setOpen(false)
              }}
            />
          )}
        </main>
      )
    }
    render(
      <ThemeProvider defaultTheme="light">
        <Host />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '关闭成员简介' }))
    expect(onClose).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: '关于我们' })),
    )
    trigger.remove()
  },
)
