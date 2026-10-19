// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { undoDepth, redoDepth } from '@tiptap/pm/history'
import { EditorContent } from '@tiptap/react'
import { useTiptapEditor } from '../useTiptapEditor'
import { useMarkdownPreset } from '../presets'
import type { TiptapEditorSessionOptions, UseTiptapEditorResult } from '../types'
import { closeEmojiPicker, currentEmojiAnchor, insertPickedEmoji } from '../emoji-trigger'
import { createMarkdownExtensions } from './extensions'
import { parseMarkdownContent } from './conversion'
import { ContentSession } from '../content-session'
import { markdownContentAdapter } from '../content-adapters'

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
})
afterEach(cleanup)
const bindings = new Map<string, UseTiptapEditorResult>()
function Host(props: TiptapEditorSessionOptions & { emoji?: boolean }) {
  const preset = useMarkdownPreset({ emoji: props.emoji, slash: false, placeholder: false })
  const value = useTiptapEditor({ ...props, preset })
  bindings.set(props.ariaLabel, value)
  return (
    <>
      <EditorContent editor={value.editor} />
      <div data-testid={`issues-${props.ariaLabel}`}>
        {value.issues.map((issue) => issue.code).join(',')}
      </div>
    </>
  )
}
const get = (name = 'editor') => bindings.get(name)!
function dollar(editor: Editor) {
  act(() => {
    editor.view.dom.focus()
    editor.view.someProp('handleTextInput', (fn) =>
      fn(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
        '$',
        () => editor.state.tr,
      ),
    )
  })
}
describe('Markdown preset session', () => {
  it('retains editor, selection and stable methods through rerenders and reads latest callbacks', () => {
    const first = vi.fn(),
      latest = vi.fn()
    const host = render(
      <StrictMode>
        <Host
          ariaLabel="editor"
          initialContent={{ format: 'markdown', content: 'initial' }}
          onChange={first}
        />
      </StrictMode>,
    )
    const initial = get(),
      editor = initial.editor!
    act(() => {
      editor.commands.setTextSelection(4)
      editor.commands.insertContent('x')
    })
    expect(first).toHaveBeenCalledTimes(1)
    const position = editor.state.selection.from
    host.rerender(
      <StrictMode>
        <Host
          ariaLabel="editor"
          initialContent={{ format: 'markdown', content: 'changed' }}
          onChange={latest}
        />
      </StrictMode>,
    )
    expect(get().editor).toBe(editor)
    expect(get().exportMarkdown).toBe(initial.exportMarkdown)
    expect(get().replaceContent).toBe(initial.replaceContent)
    expect(editor.state.selection.from).toBe(position)
    act(() => {
      editor.commands.insertContent('y')
    })
    expect(latest).toHaveBeenCalledTimes(1)
    expect(editor.state.doc.textContent).toBe('inixytial')
  })
  it('latches invalid initialization across edits until an explicit successful replacement, notifying once in StrictMode', () => {
    const errors = vi.fn(),
      changes = vi.fn()
    render(
      <StrictMode>
        <Host
          ariaLabel="editor"
          initialContent={{ format: 'markdown', content: '<b>bad</b>' }}
          onError={errors}
          onChange={changes}
        />
      </StrictMode>,
    )
    expect(errors).toHaveBeenCalledTimes(1)
    expect(changes).not.toHaveBeenCalled()
    const editor = get().editor!
    act(() => {
      editor.commands.insertContent('typed')
    })
    expect(get().exportMarkdown()).toMatchObject({
      ok: false,
      issues: [{ code: 'unsupported-content' }],
    })
    expect(errors).toHaveBeenCalledTimes(1)
    act(() => {
      expect(get().replaceContent({ format: 'markdown', content: '' })).toMatchObject({ ok: true })
    })
    expect(get().exportMarkdown()).toMatchObject({ ok: true, value: '' })
    expect(get().issues).toEqual([])
  })
  it('resets real undo/redo history on replacement including equivalent content, and keeps new edits undoable', () => {
    const changes = vi.fn()
    render(
      <Host
        ariaLabel="editor"
        initialContent={{ format: 'markdown', content: 'old' }}
        onChange={changes}
      />,
    )
    const editor = get().editor!
    act(() => {
      editor.commands.setTextSelection(4)
      editor.commands.insertContent('x')
      editor.commands.undo()
    })
    expect(redoDepth(editor.state)).toBe(1)
    act(() => {
      expect(get().replaceContent({ format: 'markdown', content: 'old' })).toMatchObject({
        ok: true,
      })
    })
    expect(undoDepth(editor.state)).toBe(0)
    expect(redoDepth(editor.state)).toBe(0)
    expect(editor.commands.undo()).toBe(false)
    expect(editor.commands.redo()).toBe(false)
    act(() => {
      editor.commands.insertContent('new')
    })
    expect(undoDepth(editor.state)).toBe(1)
    act(() => {
      editor.commands.undo()
    })
    expect(editor.state.doc.textContent).toBe('old')
    const focus = document.activeElement
    act(() => {
      expect(get().replaceContent({ format: 'markdown', content: '# replacement' })).toMatchObject({
        ok: true,
      })
    })
    expect(document.activeElement).toBe(focus)
    expect(editor.state.selection.from).toBe(1)
    expect(undoDepth(editor.state)).toBe(0)
  })
  it('keeps failed replacement document, history, selection and Emoji session unchanged', () => {
    const errors = vi.fn(),
      changes = vi.fn()
    render(
      <Host
        ariaLabel="editor"
        initialContent={{ format: 'markdown', content: 'old' }}
        onError={errors}
        onChange={changes}
      />,
    )
    const editor = get().editor!
    dollar(editor)
    const anchor = currentEmojiAnchor(editor),
      before = editor.getJSON(),
      selection = editor.state.selection,
      depth = undoDepth(editor.state),
      count = changes.mock.calls.length
    act(() => {
      expect(get().replaceContent({ format: 'markdown', content: '<b>bad</b>' })).toMatchObject({
        ok: false,
      })
    })
    expect(editor.getJSON()).toEqual(before)
    expect(editor.state.selection).toEqual(selection)
    expect(undoDepth(editor.state)).toBe(depth)
    expect(currentEmojiAnchor(editor)).toBe(anchor)
    expect(changes).toHaveBeenCalledTimes(count)
    expect(errors).toHaveBeenCalledTimes(1)
  })
  it('uses accepted operation receipts even when an additional plugin rejects a valid replacement', () => {
    render(<Host ariaLabel="editor" initialContent={{ format: 'markdown', content: 'old' }} />)
    const editor = get().editor!
    editor.registerPlugin(
      new Plugin({ filterTransaction: (transaction) => !transaction.docChanged }),
    )
    act(() => {
      expect(get().replaceContent({ format: 'markdown', content: 'new' })).toMatchObject({
        ok: false,
      })
    })
    expect(editor.state.doc.textContent).toBe('old')
  })
  it('isolates editors, freezes Emoji configuration and cancels sessions on readonly and replacement', () => {
    const host = render(
      <>
        <Host ariaLabel="one" />
        <Host ariaLabel="two" />
      </>,
    )
    const one = get('one').editor!,
      two = get('two').editor!
    dollar(one)
    const old = currentEmojiAnchor(one)!
    act(() => {
      get('one').replaceContent({ format: 'markdown', content: 'replacement' })
    })
    dollar(one)
    const current = currentEmojiAnchor(one)!
    expect(current.session).not.toBe(old.session)
    act(() => {
      expect(insertPickedEmoji(one, '😀', old.session)).toBe(false)
      expect(closeEmojiPicker(one, old.session)).toBe(false)
    })
    expect(currentEmojiAnchor(one)).toBe(current)
    expect(two.state.doc.textContent).toBe('')
    host.rerender(
      <>
        <Host ariaLabel="one" emoji={false} />
        <Host ariaLabel="two" editable={false} />
      </>,
    )
    expect(get('one').editor).toBe(one)
    expect(currentEmojiAnchor(one)).toBe(current)
    expect(two.isEditable).toBe(false)
    host.rerender(
      <>
        <Host key="disabled" ariaLabel="one" emoji={false} />
        <Host ariaLabel="two" editable={false} />
      </>,
    )
    const rebuilt = get('one').editor!
    expect(rebuilt).not.toBe(one)
    dollar(rebuilt)
    expect(currentEmojiAnchor(rebuilt)).toBeNull()
  })
  it('returns not-ready after unmount without invoking callbacks', () => {
    const errors = vi.fn(),
      host = render(<Host ariaLabel="editor" onError={errors} />)
    const saved = get()
    host.unmount()
    expect(saved.exportMarkdown()).toMatchObject({ ok: false, issues: [{ code: 'not-ready' }] })
    expect(saved.replaceContent({ format: 'markdown', content: 'new' })).toMatchObject({
      ok: false,
      issues: [{ code: 'not-ready' }],
    })
    expect(errors).not.toHaveBeenCalled()
  })
  it.each(['replace', 'edit', 'unmount'])(
    'drops queued rejected diagnostics after %s',
    async (action) => {
      const errors = vi.fn(),
        host = render(
          <StrictMode>
            <Host
              ariaLabel="editor"
              initialContent={{ format: 'markdown', content: 'old' }}
              onError={errors}
            />
          </StrictMode>,
        )
      const editor = get().editor!
      act(() => {
        editor.commands.setContent({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 7 }, content: [{ type: 'text', text: 'bad' }] },
          ],
        })
        if (action === 'replace')
          expect(get().replaceContent({ format: 'markdown', content: 'new' })).toMatchObject({
            ok: true,
          })
        if (action === 'edit') editor.commands.insertContent('new')
      })
      if (action === 'unmount') host.unmount()
      await act(async () => {
        await Promise.resolve()
      })
      expect(errors).not.toHaveBeenCalled()
      if (action !== 'unmount') expect(get().issues).toEqual([])
    },
  )
  it('keeps queued diagnostics scoped to the editor that still owns the rejected document', async () => {
    const oneErrors = vi.fn(),
      twoErrors = vi.fn()
    render(
      <StrictMode>
        <Host
          ariaLabel="one"
          initialContent={{ format: 'markdown', content: 'one' }}
          onError={oneErrors}
        />
        <Host
          ariaLabel="two"
          initialContent={{ format: 'markdown', content: 'two' }}
          onError={twoErrors}
        />
      </StrictMode>,
    )
    act(() => {
      for (const name of ['one', 'two'])
        get(name).editor!.commands.setContent({
          type: 'doc',
          content: [{ type: 'heading', attrs: { level: 7 } }],
        })
      get('one').replaceContent({ format: 'markdown', content: 'new' })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(oneErrors).not.toHaveBeenCalled()
    expect(twoErrors).toHaveBeenCalledTimes(1)
    expect(get('one').issues).toEqual([])
    expect(get('two').issues).toMatchObject([{ code: 'invalid-content' }])
  })
  it('discards a detached live instance diagnostic during effect replay and instance handoff', async () => {
    const errors = vi.fn(),
      publish = vi.fn()
    const initial = parseMarkdownContent({ format: 'markdown', content: 'old' })
    if (!initial.ok) throw new Error('fixture')
    const runtime = new ContentSession(
      markdownContentAdapter,
      () => ({ onError: errors }),
      publish,
      initial,
    )
    const make = () =>
      new Editor({
        extensions: [
          ...createMarkdownExtensions({ purpose: 'editing', onError: runtime.report }),
          runtime.extension(),
        ],
        content: initial.value,
      })
    const old = make(),
      next = make()
    const reject = () =>
      old.commands.setContent({ type: 'doc', content: [{ type: 'heading', attrs: { level: 7 } }] })
    try {
      runtime.attach(old)
      reject()
      runtime.detach(old)
      runtime.attach(old)
      await Promise.resolve()
      expect(old.isDestroyed).toBe(false)
      expect(errors).not.toHaveBeenCalled()
      reject()
      runtime.detach(old)
      runtime.attach(next)
      await Promise.resolve()
      expect(errors).not.toHaveBeenCalled()
      expect(publish).not.toHaveBeenCalled()
    } finally {
      old.destroy()
      next.destroy()
    }
  })
})
