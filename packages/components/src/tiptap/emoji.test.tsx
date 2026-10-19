// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef, StrictMode } from 'react'
import type { Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { TiptapEditor } from './TiptapEditor'
import EmojiPickerPanel from './EmojiPickerPanel'
import type { TiptapEditorHandle } from './types'
import { closeEmojiPicker, currentEmojiAnchor, insertPickedEmoji } from './emoji-trigger'

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
  // jsdom has no layout. Supply the real list's measurement boundary without
  // replacing the picker's selection or keyboard implementation.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.matches('[data-slot="emoji-picker-panel"]') ? 350 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.matches('[data-slot="emoji-picker-list"]') ? 300 : 0
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
  const list = await within(picker).findByRole('listbox', { name: '表情列表' })
  await waitFor(() => expect(document.activeElement).toBe(list))
  expect(list.getAttribute('aria-busy')).toBeNull()
  expect(list.tabIndex).toBe(0)
  const face = await waitFor(() => {
    const cell = within(list)
      .getAllByRole('option')
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

it('uses the real listbox keyboard navigation and confirms the highlighted emoji', async () => {
  render(<TiptapEditor ariaLabel="keyboard emoji" />)
  const textbox = screen.getByRole('textbox', { name: 'keyboard emoji' })
  typeDollar(textbox)
  const list = await screen.findByRole('listbox', { name: '表情列表' })
  await waitFor(() => expect(document.activeElement).toBe(list))
  fireEvent.keyDown(list, { key: 'ArrowRight' })
  const active = list.getAttribute('aria-activedescendant')
  expect(active).toBeTruthy()
  const option = document.getElementById(active!)
  expect(option?.getAttribute('role')).toBe('option')
  const emoji = option?.textContent
  expect(emoji).toBeTruthy()
  fireEvent.keyDown(list, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择 Emoji' })).toBeNull())
  expect(textbox.textContent).toBe(emoji)
  expect(document.activeElement).toBe(textbox)
})

it('browses local Chinese data without requesting remote emoji data', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  render(<TiptapEditor ariaLabel="offline emoji" />)
  const textbox = screen.getByRole('textbox', { name: 'offline emoji' })
  typeDollar(textbox)
  const picker = await screen.findByRole('dialog', { name: '选择 Emoji' })
  const list = await within(picker).findByRole('listbox', { name: '表情列表' })
  expect(within(picker).getByRole('tablist', { name: '表情分类' })).toBeTruthy()
  await waitFor(() => expect(within(list).getAllByRole('option').length).toBeGreaterThan(0))
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps the picker and trigger when the document gate rejects selection', async () => {
  render(<TiptapEditor ariaLabel="guarded selection" />)
  const textbox = screen.getByRole('textbox', { name: 'guarded selection' })
  const editor = typeDollar(textbox)
  const picker = await screen.findByRole('dialog', { name: '选择 Emoji' })
  const option = (await within(picker).findAllByRole('option'))[0]!
  editor.registerPlugin(new Plugin({ filterTransaction: (transaction) => !transaction.docChanged }))
  fireEvent.click(option)
  expect(textbox.textContent).toBe('$')
  expect(screen.getByRole('dialog', { name: '选择 Emoji' })).toBeTruthy()
})

it('rejects a real pick from a stale panel after another session opens', async () => {
  render(<TiptapEditor ariaLabel="stale emoji" />)
  const textbox = screen.getByRole('textbox', { name: 'stale emoji' })
  const editor = typeDollar(textbox)
  const previous = currentEmojiAnchor(editor)!
  await screen.findByRole('dialog', { name: '选择 Emoji' })
  act(() => {
    closeEmojiPicker(editor, previous.session)
  })
  typeDollar(textbox)
  const current = currentEmojiAnchor(editor)!
  expect(current.session).not.toBe(previous.session)
  const stale = render(
    <EmojiPickerPanel editor={editor} anchor={previous} session={previous.session} />,
  )
  const panels = await screen.findAllByRole('dialog', { name: '选择 Emoji' })
  const staleOption = (await within(panels[1]!).findAllByRole('option'))[0]!
  fireEvent.click(staleOption)
  expect(textbox.textContent).toBe('$$')
  expect(currentEmojiAnchor(editor)?.session).toBe(current.session)
  stale.unmount()
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
