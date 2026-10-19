// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { createTiptapExtensions } from '../extensions'
import { TiptapLifecycle } from '../lifecycle'
import { ToolbarSession, applyDocumentCommand } from './selection'

const editors: Editor[] = []
const sessions: ToolbarSession[] = []
afterEach(() => {
  sessions.splice(0).forEach((session) => session.dispose())
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})
function setup(content = '<p>alpha</p><p>beta</p>') {
  const runtime = new TiptapLifecycle(() => ({}))
  const element = document.createElement('div')
  document.body.append(element)
  const editor = new Editor({
    element,
    extensions: [...createTiptapExtensions({ purpose: 'editing' }), runtime.extension()],
    content,
  })
  editors.push(editor)
  runtime.attach(editor)
  return { editor, runtime }
}
function capture(editor: Editor, runtime: TiptapLifecycle, invalidate?: () => void) {
  const session = new ToolbarSession(editor, runtime, invalidate)
  sessions.push(session)
  return session
}

it('restores the mapped original selection and applies marks to it after form focus changes', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 5 })
  const session = capture(editor, runtime)
  editor.commands.insertContentAt(1, 'XX')
  editor.commands.setTextSelection(12)
  expect(session.run((instance) => instance.chain().setBold().run())).toBe(true)
  expect(editor.state.selection.from).toBe(4)
  expect(editor.state.selection.to).toBe(7)
  expect(editor.state.doc.textBetween(4, 7)).toBe('lph')
  expect(editor.state.doc.rangeHasMark(4, 7, editor.schema.marks.bold!)).toBe(true)
  expect(editor.view.hasFocus()).toBe(true)
})

it.each([
  { from: 2, to: 3, expected: 'pha' },
  { from: 4, to: 5, expected: 'lpa' },
])('keeps remaining selected text after partial deletion $from-$to', ({ from, to, expected }) => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 6 })
  const session = capture(editor, runtime)
  editor.commands.deleteRange({ from, to })
  expect(session.valid).toBe(true)
  expect(session.restore()).toBe(true)
  expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe(
    expected,
  )
})

it('rejects a fully replaced text range even when replacement retains the same coordinates', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 5 })
  const invalidated = vi.fn(),
    session = capture(editor, runtime, invalidated)
  editor.commands.insertContentAt({ from: 2, to: 5 }, 'XYZ')
  const before = editor.getJSON()
  expect(session.valid).toBe(false)
  expect(session.run((instance) => instance.chain().setBold().run())).toBe(false)
  expect(editor.getJSON()).toEqual(before)
  expect(invalidated).toHaveBeenCalledTimes(1)
})

it('rejects text removed in separate steps of one transaction', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 6 })
  const session = capture(editor, runtime)
  editor.view.dispatch(editor.state.tr.delete(2, 4).delete(2, 4))
  expect(session.valid).toBe(false)
})

it('does not count newly inserted text as surviving original selection content', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 6 })
  const session = capture(editor, runtime)
  editor.commands.insertContentAt(4, 'XX')
  editor.commands.deleteRange({ from: 2, to: 4 })
  editor.commands.deleteRange({ from: 4, to: 6 })
  expect(editor.getText()).toContain('aXX')
  expect(session.valid).toBe(false)
  expect(session.run((instance) => instance.commands.setBold())).toBe(false)
})

it('does not silently move a deleted cursor into nearby text', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection(3)
  const session = capture(editor, runtime)
  editor.commands.deleteRange({ from: 2, to: 4 })
  expect(session.restore()).toBe(false)
})

it('maps a node selection without changing its type and rejects deletion of the selected node', () => {
  const { editor, runtime } = setup('<p>alpha</p><img src="/image.png"><p>beta</p>')
  editor.commands.setNodeSelection(7)
  const session = capture(editor, runtime)
  editor.commands.insertContentAt(1, 'XX')
  editor.commands.setTextSelection(2)
  expect(session.restore()).toBe(true)
  expect(editor.state.selection.toJSON()).toEqual({ type: 'node', anchor: 9 })
  editor.commands.deleteRange({ from: 9, to: 10 })
  expect(session.valid).toBe(false)
})

it.each(['replace', 'readonly', 'dispose', 'destroy'] as const)(
  'blocks stale sessions after %s',
  (action) => {
    const { editor, runtime } = setup()
    const session = capture(editor, runtime)
    if (action === 'replace') runtime.replace({ format: 'markdown', content: 'replacement' })
    if (action === 'readonly') editor.setEditable(false)
    if (action === 'dispose') runtime.dispose()
    if (action === 'destroy') editor.destroy()
    expect(session.valid).toBe(false)
    expect(session.run((instance) => instance.chain().setBold().run())).toBe(false)
  },
)

it('does not treat restoring selection as proof that a filtered document command applied', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 5 })
  const session = capture(editor, runtime)
  editor.commands.setTextSelection(10)
  const before = editor.getJSON()
  expect(
    session.run((instance) =>
      instance.commands.command(({ tr }) => {
        tr.addMark(2, 5, instance.schema.marks.textStyle!.create({ fontSize: '99rem' }))
        return true
      }),
    ),
  ).toBe(false)
  expect(editor.getJSON()).toEqual(before)
  expect(editor.view.hasFocus()).toBe(false)
  expect(session.valid).toBe(true)
})

it('retains the successful command result selection instead of restoring the old bookmark', () => {
  const { editor, runtime } = setup()
  editor.commands.setTextSelection({ from: 2, to: 5 })
  const session = capture(editor, runtime)
  expect(session.run((instance) => instance.commands.insertContent('replacement'))).toBe(true)
  expect(editor.state.selection.empty).toBe(true)
  expect(editor.state.selection.from).toBe(13)
  expect(editor.view.hasFocus()).toBe(true)
})

it('checks actual applied root transactions for direct commands', () => {
  const { editor } = setup()
  expect(applyDocumentCommand(editor, () => true)).toBe(false)
  expect(applyDocumentCommand(editor, () => editor.commands.setBold())).toBe(true)
})

it('maps appended transactions along with the applied root transaction', () => {
  const { editor, runtime } = setup()
  editor.registerPlugin(
    new Plugin({
      appendTransaction: (transactions, _old, state) =>
        transactions.some((transaction) => transaction.getMeta('toolbar-append'))
          ? state.tr.insertText('X', 1)
          : null,
    }),
  )
  editor.commands.setTextSelection({ from: 2, to: 5 })
  const session = capture(editor, runtime)
  editor.view.dispatch(editor.state.tr.insertText('Y', 1).setMeta('toolbar-append', true))
  expect(session.restore()).toBe(true)
  expect(editor.state.selection.from).toBe(4)
  expect(editor.state.selection.to).toBe(7)
  expect(editor.state.doc.textBetween(4, 7)).toBe('lph')
})

it('invalidates a session when editing is disabled even if it is enabled again before submission', () => {
  const { editor, runtime } = setup()
  const session = capture(editor, runtime)
  editor.setEditable(false)
  editor.setEditable(true)
  expect(session.valid).toBe(false)
})
