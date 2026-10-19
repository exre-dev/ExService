// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef, StrictMode, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { ExplicitToolbarEditor as TiptapEditor } from './testing/ExplicitToolbarEditor'
import type { TiptapEditorHandle } from './types'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  cleanup()
  vi.unstubAllGlobals()
})

it('wraps the complete toolbar and preserves its editor and form on business rerender', async () => {
  const handle = createRef<TiptapEditorHandle>()
  const wrap = vi.fn((toolbar: ReactNode) => (
    <section aria-label="业务工具栏背景">{toolbar}</section>
  ))
  const { rerender } = render(
    <StrictMode>
      <TiptapEditor
        ref={handle}
        ariaLabel="wrapped editor"
        renderToolbar={wrap}
        initialContent={{ format: 'markdown', content: 'selected text' }}
      />
    </StrictMode>,
  )
  await waitFor(() => expect(handle.current?.readJSON().ok).toBe(true))
  const textbox = screen.getByRole('textbox', { name: 'wrapped editor' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  expect(
    screen.getByRole('region', { name: '业务工具栏背景' }).contains(screen.getByRole('toolbar')),
  ).toBe(true)
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 9 })
  })
  fireEvent.click(screen.getByRole('button', { name: '粗体' }))
  expect(textbox.querySelector('strong')?.textContent).toBe('selected')
  fireEvent.click(await screen.findByRole('button', { name: '编辑链接' }))
  const address = await screen.findByRole('textbox', { name: '链接地址' })
  fireEvent.change(address, { target: { value: 'https://example.test/kept' } })
  rerender(
    <StrictMode>
      <TiptapEditor
        ref={handle}
        ariaLabel="wrapped editor"
        renderToolbar={wrap}
        initialContent={{ format: 'markdown', content: 'ignored new initial' }}
      />
    </StrictMode>,
  )
  expect(screen.getByRole('textbox', { name: 'wrapped editor' })).toBe(textbox)
  expect((textbox as HTMLElement & { editor: Editor }).editor).toBe(editor)
  expect(textbox.textContent).toBe('selected text')
  expect(screen.getByRole('textbox', { name: '链接地址' })).toBe(address)
  expect((address as HTMLInputElement).value).toBe('https://example.test/kept')
  fireEvent.click(screen.getByRole('button', { name: '应用链接' }))
  await waitFor(() => expect(textbox.querySelector('a')?.textContent).toBe('selected'))
})

it('does not invoke the wrapper for hidden or readonly toolbars and removes mounted panels', async () => {
  const wrap = vi.fn((toolbar: ReactNode) => <div data-testid="business-surface">{toolbar}</div>)
  const { rerender } = render(
    <TiptapEditor ariaLabel="mount rules" toolbar={false} renderToolbar={wrap} />,
  )
  await screen.findByRole('textbox', { name: 'mount rules' })
  expect(wrap).not.toHaveBeenCalled()
  rerender(<TiptapEditor ariaLabel="mount rules" editable={false} renderToolbar={wrap} />)
  expect(wrap).not.toHaveBeenCalled()
  rerender(<TiptapEditor ariaLabel="mount rules" renderToolbar={wrap} />)
  await screen.findByRole('toolbar')
  expect(wrap).toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: '编辑链接' }))
  await screen.findByRole('textbox', { name: '链接地址' })
  const calls = wrap.mock.calls.length
  rerender(<TiptapEditor ariaLabel="mount rules" editable={false} renderToolbar={wrap} />)
  expect(wrap).toHaveBeenCalledTimes(calls)
  expect(screen.queryByRole('toolbar')).toBeNull()
  expect(screen.queryByTestId('business-surface')).toBeNull()
  expect(screen.queryByRole('textbox', { name: '链接地址' })).toBeNull()
  expect(screen.queryByRole('toolbar', { name: '更多工具' })).toBeNull()
})

it('honors a null wrapper result and keeps independently wrapped editors isolated', async () => {
  const hidden = vi.fn(() => null)
  const first = createRef<TiptapEditorHandle>(),
    second = createRef<TiptapEditorHandle>()
  render(
    <>
      <TiptapEditor
        ref={first}
        ariaLabel="hidden editor"
        renderToolbar={hidden}
        initialContent={{ format: 'markdown', content: 'one' }}
      />
      <TiptapEditor
        ref={second}
        ariaLabel="visible editor"
        renderToolbar={(toolbar) => <aside aria-label="独立背景">{toolbar}</aside>}
        initialContent={{ format: 'markdown', content: 'two' }}
      />
    </>,
  )
  await waitFor(() =>
    expect(first.current?.readJSON().ok && second.current?.readJSON().ok).toBe(true),
  )
  expect(hidden).toHaveBeenCalled()
  expect(screen.getAllByRole('toolbar')).toHaveLength(1)
  expect(
    screen.getByRole('complementary', { name: '独立背景' }).contains(screen.getByRole('toolbar')),
  ).toBe(true)
  act(() => {
    first.current!.replaceContent({ format: 'markdown', content: 'updated one' })
  })
  expect(screen.getByRole('textbox', { name: 'visible editor' }).textContent).toBe('two')
})

it('does not apply a link form after replacement while its resolver is pending', async () => {
  const ref = createRef<TiptapEditorHandle>()
  render(
    <TiptapEditor
      ref={ref}
      ariaLabel="pending form"
      initialContent={{ format: 'markdown', content: 'old target' }}
    />,
  )
  await waitFor(() => expect(ref.current?.readJSON().ok).toBe(true))
  const textbox = screen.getByRole('textbox', { name: 'pending form' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 4 })
  })
  fireEvent.click(await screen.findByRole('button', { name: '编辑链接' }))
  const address = await screen.findByRole('textbox', { name: '链接地址' })
  fireEvent.change(address, { target: { value: 'https://example.test/obsolete' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '应用链接' }))
    expect(ref.current!.replaceContent({ format: 'markdown', content: 'new document' }).ok).toBe(
      true,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  expect(textbox.textContent).toBe('new document')
  expect(textbox.querySelector('a')).toBeNull()
  expect(textbox.querySelector('img')).toBeNull()
  expect(screen.queryByRole('textbox', { name: '链接地址' })).toBeNull()
})
