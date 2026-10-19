import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import type { Node } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { ADMONITION_TITLES } from './conversion/policy'

export type InsertBlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code'
  | 'divider'
  | 'details'
  | 'table'
  | 'tip'
  | 'info'
  | 'warning'
  | 'error'
export type InsertBlockAnchor = {
  mode: 'slash' | 'after'
  from: number
  to: number
  session: object
  pendingImage?: boolean
}
const key = new PluginKey<InsertBlockAnchor | null>('tiptapInsertBlock')
export const insertBlockCancelMeta = new PluginKey('exreInsertBlockCancel')

export function readInsertBlockAnchor(editor: Editor): InsertBlockAnchor | null {
  return editor.isDestroyed || !editor.isEditable ? null : (key.getState(editor.state) ?? null)
}

export function closeInsertBlock(editor: Editor): void {
  if (!editor.isDestroyed && key.getState(editor.state))
    editor.view.dispatch(editor.state.tr.setMeta(key, null))
}

function topLevelNode(doc: Node, position: number): Node | null {
  if (position < 0 || position >= doc.content.size || doc.resolve(position).depth !== 0) return null
  return doc.nodeAt(position)
}

export function openInsertBlockAfter(editor: Editor, position: number): boolean {
  if (editor.isDestroyed || !editor.isEditable || editor.view.composing) return false
  const node = topLevelNode(editor.state.doc, position)
  if (!node?.isBlock) return false
  const anchor: InsertBlockAnchor = {
    mode: 'after',
    from: position,
    to: position + node.nodeSize,
    session: {},
  }
  editor.view.dispatch(editor.state.tr.setMeta(key, anchor))
  return readInsertBlockAnchor(editor)?.session === anchor.session
}

/** Keep the mapped target while the native file dialog is open; no content is consumed yet. */
export function prepareInsertBlockImage(editor: Editor): object | null {
  const anchor = readInsertBlockAnchor(editor)
  if (!anchor || editor.view.composing) return null
  editor.view.dispatch(editor.state.tr.setMeta(key, { ...anchor, pendingImage: true }))
  return readInsertBlockAnchor(editor)?.session === anchor.session ? anchor.session : null
}

function blockContent(type: InsertBlockType): JSONContent {
  const paragraph: JSONContent = { type: 'paragraph' }
  if (type === 'text') return paragraph
  if (/^h[1-6]$/.test(type)) return { type: 'heading', attrs: { level: Number(type.slice(1)) } }
  if (type === 'bullet' || type === 'ordered' || type === 'task')
    return {
      type: type === 'bullet' ? 'bulletList' : type === 'ordered' ? 'orderedList' : 'taskList',
      content: [{ type: type === 'task' ? 'taskItem' : 'listItem', content: [paragraph] }],
    }
  if (type === 'quote') return { type: 'blockquote', content: [paragraph] }
  if (type === 'code') return { type: 'codeBlock' }
  if (type === 'divider') return { type: 'horizontalRule' }
  if (type === 'table')
    return {
      type: 'table',
      content: Array.from({ length: 3 }, (_, row) => ({
        type: 'tableRow',
        content: Array.from({ length: 3 }, () => ({
          type: row === 0 ? 'tableHeader' : 'tableCell',
          content: [{ type: 'paragraph' }],
        })),
      })),
    }
  if (type === 'details')
    return {
      type: 'details',
      attrs: { open: true },
      content: [{ type: 'detailsSummary' }, { type: 'detailsContent', content: [paragraph] }],
    }
  return {
    type: 'admonition',
    attrs: { type },
    content: [
      {
        type: 'admonitionTitle',
        content: [
          { type: 'text', text: ADMONITION_TITLES[type as keyof typeof ADMONITION_TITLES] },
        ],
      },
      paragraph,
    ],
  }
}

export function insertBlock(
  editor: Editor,
  type: InsertBlockType,
  expectedSession?: object,
): boolean {
  return insertBlockContent(editor, blockContent(type), type === 'divider', expectedSession)
}

export function insertBlockImageUrl(
  editor: Editor,
  attrs: { src: string; alt: string; title: string | null },
  expectedSession: object,
): boolean {
  return insertBlockContent(
    editor,
    { type: 'paragraph', content: [{ type: 'image', attrs }] },
    false,
    expectedSession,
    true,
  )
}

function insertBlockContent(
  editor: Editor,
  content: JSONContent,
  divider: boolean,
  expectedSession?: object,
  pending = false,
): boolean {
  const anchor = readInsertBlockAnchor(editor)
  if (
    !anchor ||
    (expectedSession && anchor.session !== expectedSession) ||
    (anchor.pendingImage && !pending) ||
    editor.view.composing
  )
    return false
  let node: Node
  try {
    node = editor.schema.nodeFromJSON(content)
    node.check()
  } catch {
    return false
  }
  const from = anchor.mode === 'slash' ? anchor.from : anchor.to
  // A divider needs somewhere editable immediately after it, even between two containers.
  const nodes = divider ? [node, editor.schema.nodes.paragraph!.create()] : [node]
  const transaction = closeHistory(editor.state.tr.replaceWith(from, anchor.to, nodes)).setMeta(
    key,
    null,
  )
  let caret = divider ? from + node.nodeSize + 1 : from + 1
  let found = false
  node.descendants((child, offset) => {
    if (found || child.type.name === 'admonitionTitle') return false
    if (child.isTextblock) {
      caret = from + offset + 2
      found = true
      return false
    }
    return !child.isTextblock
  })
  transaction.setSelection(Selection.near(transaction.doc.resolve(caret), 1))
  editor.view.dispatch(transaction.scrollIntoView())
  const accepted = key.getState(editor.state) === null
  if (accepted) editor.view.focus()
  return accepted
}

/** Only direct input in an empty top-level paragraph can open the slash menu. */
export function createInsertBlockTrigger(
  onChange: (anchor: InsertBlockAnchor | null) => void,
  composing: () => boolean,
  onKeyDown: (event: KeyboardEvent) => boolean,
) {
  const typeSlash = (view: EditorView, from: number, to: number, text: string) => {
    const position = view.state.doc.resolve(from)
    if (
      text !== '/' ||
      from !== to ||
      !view.editable ||
      !view.hasFocus() ||
      view.composing ||
      composing() ||
      position.depth !== 1 ||
      position.parent.type.name !== 'paragraph' ||
      position.parent.content.size !== 0 ||
      position.marks().some((mark) => mark.type.name === 'code') ||
      view.state.storedMarks?.some((mark) => mark.type.name === 'code')
    )
      return false
    const anchor: InsertBlockAnchor = {
      mode: 'slash',
      from: position.before(1),
      to: position.after(1) + 1,
      session: {},
    }
    view.dispatch(view.state.tr.insertText('/', from, to).setMeta(key, anchor).scrollIntoView())
    return true
  }
  return Extension.create({
    name: 'tiptapInsertBlock',
    addProseMirrorPlugins: () => [
      new Plugin<InsertBlockAnchor | null>({
        key,
        state: {
          init: () => null,
          apply(transaction, previous) {
            if (transaction.getMeta(insertBlockCancelMeta)) return null
            const explicit = transaction.getMeta(key)
            if (explicit !== undefined) return explicit
            if (!previous) return null
            let { from, to } = previous
            for (const map of transaction.mapping.maps) {
              const start = map.mapResult(from, 1),
                end = map.mapResult(to, -1)
              if (start.deleted || end.deleted) return null
              from = start.pos
              to = end.pos
            }
            const node = topLevelNode(transaction.doc, from)
            if (!node || from + node.nodeSize !== to) return null
            if (
              previous.mode === 'slash' &&
              (node.type.name !== 'paragraph' ||
                node.textContent !== '/' ||
                node.content.size !== 1 ||
                (!previous.pendingImage &&
                  (!transaction.selection.empty || transaction.selection.from !== from + 2)))
            )
              return null
            return from === previous.from && to === previous.to
              ? previous
              : { ...previous, from, to }
          },
        },
        props: {
          handleTextInput: typeSlash,
          handleKeyDown(view, event) {
            if (event.isComposing || event.keyCode === 229 || view.composing || composing())
              return false
            const anchor = key.getState(view.state)
            if (anchor && !anchor.pendingImage) {
              if (event.key === 'Escape') {
                view.dispatch(view.state.tr.setMeta(key, null))
                return true
              }
              if (onKeyDown(event)) return true
            }
            if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return false
            return typeSlash(view, view.state.selection.from, view.state.selection.to, event.key)
          },
          handleDOMEvents: {
            compositionstart(view) {
              if (key.getState(view.state)) view.dispatch(view.state.tr.setMeta(key, null))
              return false
            },
            blur(view, event) {
              const anchor = key.getState(view.state)
              if (
                anchor &&
                !anchor.pendingImage &&
                !(
                  event.relatedTarget instanceof Element &&
                  event.relatedTarget.closest('[data-tiptap-insert-block]')
                )
              )
                view.dispatch(view.state.tr.setMeta(key, null))
              return false
            },
          },
        },
        view: () => ({
          update(view, previous) {
            const anchor = key.getState(view.state) ?? null
            if (anchor !== key.getState(previous)) onChange(anchor)
          },
        }),
      }),
    ],
  })
}
