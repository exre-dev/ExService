import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export type EmojiAnchor = { from: number; to: number; session: object }
const key = new PluginKey<EmojiAnchor | null>('tiptapEmojiPicker')
export const emojiCancelMeta = 'exreEmojiCancel'
export function currentEmojiAnchor(editor: Editor): EmojiAnchor | null {
  return editor.isDestroyed ? null : (key.getState(editor.state) ?? null)
}

export function closeEmojiPicker(editor: Editor, expectedSession?: object): boolean {
  const anchor = currentEmojiAnchor(editor)
  if (!anchor || (expectedSession && anchor.session !== expectedSession)) return false
  editor.view.dispatch(editor.state.tr.setMeta(key, null))
  return true
}

export function insertPickedEmoji(
  editor: Editor,
  emoji: string,
  expectedSession?: object,
): boolean {
  const anchor = !editor.isDestroyed && key.getState(editor.state)
  if (
    !anchor ||
    !editor.isEditable ||
    !emoji ||
    (expectedSession && anchor.session !== expectedSession) ||
    editor.state.doc.textBetween(anchor.from, anchor.to) !== '$'
  )
    return false
  const transaction = editor.state.tr.insertText(emoji, anchor.from, anchor.to).setMeta(key, null)
  editor.view.dispatch(transaction.scrollIntoView())
  // The lifecycle's filterTransaction can reject a document over the budget.
  const accepted = key.getState(editor.state) === null
  if (accepted) editor.view.focus()
  return accepted
}

/** Opens only for direct text input, so imports, paste and undo cannot summon UI. */
export function createEmojiTrigger(
  onChange: (anchor: EmojiAnchor | null) => void,
  composing: () => boolean,
  isEnabled: () => boolean = () => true,
) {
  const typeDollar = (view: EditorView, from: number, to: number, text: string) => {
    const position = view.state.doc.resolve(from)
    if (
      text !== '$' ||
      from !== to ||
      !isEnabled() ||
      !view.editable ||
      !view.hasFocus() ||
      view.composing ||
      composing() ||
      position.parent.type.spec.code ||
      position.marks().some((mark) => mark.type.name === 'code') ||
      view.state.storedMarks?.some((mark) => mark.type.name === 'code')
    )
      return false
    view.dispatch(
      view.state.tr
        .insertText('$', from, to)
        .setMeta(key, { from, to: from + 1, session: {} })
        .scrollIntoView(),
    )
    return true
  }
  return Extension.create({
    name: 'tiptapEmojiPicker',
    addProseMirrorPlugins: () => [
      new Plugin<EmojiAnchor | null>({
        key,
        state: {
          init: () => null,
          apply(transaction, previous) {
            if (transaction.getMeta(emojiCancelMeta)) return null
            if (transaction.getMeta(key) !== undefined) return transaction.getMeta(key)
            if (!previous) return null
            const from = transaction.mapping.mapResult(previous.from, 1)
            const to = transaction.mapping.mapResult(previous.to, -1)
            if (
              from.deleted ||
              to.deleted ||
              transaction.doc.textBetween(from.pos, to.pos) !== '$' ||
              !transaction.selection.empty ||
              transaction.selection.from !== to.pos
            )
              return null
            return from.pos === previous.from && to.pos === previous.to
              ? previous
              : { from: from.pos, to: to.pos, session: previous.session }
          },
        },
        props: {
          handleTextInput: typeDollar,
          handleKeyDown(view, event) {
            if (event.isComposing || event.keyCode === 229 || view.composing || composing())
              return false
            if (event.key === 'Escape' && key.getState(view.state)) {
              view.dispatch(view.state.tr.setMeta(key, null))
              return true
            }
            if (event.key !== '$' || event.ctrlKey || event.metaKey || event.altKey) return false
            return typeDollar(view, view.state.selection.from, view.state.selection.to, event.key)
          },
          handleDOMEvents: {
            compositionstart(view) {
              if (key.getState(view.state)) view.dispatch(view.state.tr.setMeta(key, null))
              return false
            },
            blur(view, event) {
              // Install dismissal with the editor, before the lazy panel exists.
              // Moving focus into the picker search field keeps the mapped anchor.
              if (
                key.getState(view.state) &&
                !(
                  event.relatedTarget instanceof Element &&
                  event.relatedTarget.closest('[data-tiptap-emoji-picker]')
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
