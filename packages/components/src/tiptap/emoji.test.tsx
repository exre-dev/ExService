// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef, StrictMode } from 'react'
import type { Editor } from '@tiptap/core'
import { TiptapEditor } from './TiptapEditor'
import type { TiptapEditorHandle } from './types'
import { insertPickedEmoji } from './emoji-trigger'

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
  // jsdom has no layout. Supply the measured browser boundary used by the
  // real picker's grid, without replacing its search or selection behavior.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.closest('.EmojiPickerReact') ? 350 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.matches('[data-epr-part="emoji"]')
      ? 32
      : this.closest('.EmojiPickerReact')
        ? 300
        : 0
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      active = true
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        queueMicrotask(() => {
          if (this.active)
            this.callback(
              [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            )
        })
      }
      unobserve() {}
      disconnect() {
        this.active = false
      }
    },
  )
})
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function typeDollar(textbox: HTMLElement) {
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    textbox.focus()
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, '$', () => editor.state.tr.insertText('$', from, to)),
    )
    if (!handled) editor.view.dispatch(editor.state.tr.insertText('$', from, to))
  })
  return editor
}

it('dismisses immediately on blur while the picker module is still loading', async () => {
  render(
    <>
      <TiptapEditor ariaLabel="loading emoji" />
      <button>Outside</button>
    </>,
  )
  typeDollar(screen.getByRole('textbox', { name: 'loading emoji' }))
  const outside = screen.getByRole('button', { name: 'Outside' })
  act(() => {
    outside.focus()
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150))
  })
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
  expect(document.activeElement).toBe(outside)
})

it('opens the real picker on typed $ and replaces only that trigger with Unicode text', async () => {
  const ref = createRef<TiptapEditorHandle>()
  render(
    <StrictMode>
      <TiptapEditor
        ref={ref}
        ariaLabel="emoji editor"
        initialContent={{ format: 'markdown', content: 'before after' }}
      />
    </StrictMode>,
  )
  const textbox = screen.getByRole('textbox', { name: 'emoji editor' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection(8)
  })
  typeDollar(textbox)
  const picker = await screen.findByRole('dialog', { name: '选择 Emoji' })
  expect(picker.getAttribute('data-slot')).toBe('popover-content')
  expect(within(picker).queryAllByRole('button', { name: /肤色/ })).toHaveLength(0)
  expect(within(picker).queryByRole('textbox')).toBeNull()
  await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('gridcell'))
  const face = await waitFor(() => {
    const cell = within(picker)
      .getAllByRole('gridcell')
      .find((item) => item.textContent === '😀')
    expect(cell).toBeTruthy()
    return cell!
  })
  fireEvent.click(face)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull())
  expect(textbox.textContent).toBe('before 😀after')
  expect(ref.current!.exportMarkdown()).toMatchObject({ ok: true, value: 'before 😀after' })
  expect(editor.state.selection.from).toBe(10)
  expect(document.activeElement).toBe(textbox)
})

it('keeps literal $ on Escape and does not reopen after paste or ordinary transactions', async () => {
  render(<TiptapEditor ariaLabel="cancel emoji" />)
  const textbox = screen.getByRole('textbox', { name: 'cancel emoji' })
  const editor = typeDollar(textbox)
  const picker = await screen.findByRole('dialog', { name: '选择 Emoji' })
  fireEvent.keyDown(picker, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
  expect(textbox.textContent).toBe('$')
  act(() => {
    editor.commands.insertContent(' $100')
  })
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
})

it('does not trigger in code or during composition and closes after replacement or readonly', async () => {
  const ref = createRef<TiptapEditorHandle>()
  const { rerender } = render(<TiptapEditor ref={ref} ariaLabel="guard emoji" />)
  const textbox = screen.getByRole('textbox', { name: 'guard emoji' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    editor.commands.toggleCodeBlock()
  })
  typeDollar(textbox)
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: '' })
  })
  fireEvent.compositionStart(textbox)
  typeDollar(textbox)
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
  fireEvent.compositionEnd(textbox)
  typeDollar(textbox)
  await screen.findByRole('dialog', { name: '选择 Emoji' })
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: 'replacement' })
  })
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
  typeDollar(textbox)
  await screen.findByRole('dialog', { name: '选择 Emoji' })
  rerender(<TiptapEditor ref={ref} ariaLabel="guard emoji" editable={false} />)
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
})

it('maps the trigger through edits and refuses a deleted trigger even if $ is reinserted', async () => {
  render(<TiptapEditor ariaLabel="mapped emoji" />)
  const textbox = screen.getByRole('textbox', { name: 'mapped emoji' })
  const editor = typeDollar(textbox)
  await screen.findByRole('dialog', { name: '选择 Emoji' })
  act(() => {
    editor.view.dispatch(editor.state.tr.insertText('prefix ', 1))
  })
  act(() => {
    expect(insertPickedEmoji(editor, '👍🏽')).toBe(true)
  })
  expect(textbox.textContent).toBe('prefix 👍🏽')
  typeDollar(textbox)
  await screen.findByRole('dialog', { name: '选择 Emoji' })
  act(() => {
    const position = editor.state.selection.from
    editor.view.dispatch(
      editor.state.tr.delete(position - 1, position).insertText('$', position - 1),
    )
  })
  expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull()
  act(() => {
    expect(insertPickedEmoji(editor, '😀')).toBe(false)
  })
  expect(textbox.textContent).toBe('prefix 👍🏽$')
})

it('dismisses when focus moves out of the editor instead of letting a delayed picker steal focus', async () => {
  render(
    <>
      <TiptapEditor ariaLabel="blur emoji" />
      <button>Outside</button>
    </>,
  )
  const textbox = screen.getByRole('textbox', { name: 'blur emoji' })
  typeDollar(textbox)
  act(() => {
    screen.getByRole('button', { name: 'Outside' }).focus()
  })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull())
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }))
})
