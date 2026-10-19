import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '@tiptap/react'
import { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion'
import { parseTiptapContent } from './conversion'
import { createTiptapExtensions } from './extensions'
import { TiptapLifecycle } from './lifecycle'
import { ContentSession } from './content-session'
import { markdownContentAdapter } from './content-adapters'
import { createMarkdownExtensions } from './markdown/extensions'
import { parseMarkdownContent } from './markdown/conversion'
import { MarkdownEmojiPicker } from './markdown/MarkdownEmojiPicker'
import type { MarkdownEmojiPickerProps } from './markdown/types'
import { closeEmojiPicker, createEmojiTrigger, type EmojiAnchor } from './emoji-trigger'
import { MentionPopup } from './MentionPopup'
import { InsertBlockControls, InsertBlockMenu } from './InsertBlockMenu'
import { closeInsertBlock, createInsertBlockTrigger, type InsertBlockAnchor } from './insert-block'
import { createTableNodeView } from './table/node-view'
import { createPresetPlaceholder } from './placeholder'
import { snapshotPreset } from './presets'
import type {
  TiptapEditorHandle,
  TiptapEditorSessionOptions,
  TiptapServiceCallbacks,
  TiptapIssue,
  TiptapMentionItem,
  TiptapPreset,
  UseTiptapEditorOptions,
  UseTiptapEditorResult,
} from './types'

type Candidates = { props: SuggestionProps<TiptapMentionItem>; index: number }
type SessionOptions = TiptapEditorSessionOptions &
  TiptapServiceCallbacks & { preset?: TiptapPreset }
const empty = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Private composition boundary for shared and explicit native Editor hosts. */
export function useEditorSession(options: SessionOptions) {
  const current = useRef(options)
  current.current = options
  const [preset] = useState(() => snapshotPreset(options.preset ?? { kind: 'tiptap', options: {} }))
  const policy = preset.kind === 'tiptap' ? preset.options.policy : undefined
  const [initial] = useState(() => {
    const input = options.initialContent ?? { format: 'json' as const, content: empty }
    return preset.kind === 'markdown'
      ? parseMarkdownContent(input)
      : parseTiptapContent(input, policy)
  })
  const [issues, setIssues] = useState<readonly TiptapIssue[]>(initial.ok ? [] : initial.issues)
  const [candidates, setCandidates] = useState<Candidates | null>(null)
  const [emojiAnchor, setEmojiAnchor] = useState<EmojiAnchor | null>(null)
  const [insertAnchor, setInsertAnchor] = useState<InsertBlockAnchor | null>(null)
  const insertKeyboard = useRef<(event: KeyboardEvent) => boolean>(() => false)
  const candidateRef = useRef(candidates)
  candidateRef.current = candidates
  const [runtime] = useState(() =>
    preset.kind === 'markdown'
      ? new ContentSession(markdownContentAdapter, () => current.current, setIssues, initial)
      : new TiptapLifecycle(() => ({ ...current.current, policy }), setIssues, initial),
  )
  const extensions = useMemo(() => {
    const base =
      runtime instanceof ContentSession
        ? createMarkdownExtensions({
            purpose: 'editing',
            pasteMarkdown: preset.kind === 'markdown' && preset.options.pasteMarkdown,
            onError: runtime.report,
            onNotice: runtime.notice,
          })
        : createTiptapExtensions({
            purpose: 'editing',
            policy,
            placeholder: false,
            tableNodeView: createTableNodeView(runtime),
            mentionSuggestion: {
              allow: ({ editor }) =>
                editor.isFocused &&
                !!current.current.resolveMentions &&
                !runtime.composing &&
                !editor.view.composing,
              items: ({ query, signal }) => runtime.query(query, signal),
              render: () => {
                const update = (suggestion: SuggestionProps<TiptapMentionItem>) => {
                  if (runtime.composing) return
                  const next = { props: suggestion, index: 0 }
                  candidateRef.current = next
                  setCandidates(next)
                }
                const clear = () => {
                  candidateRef.current = null
                  setCandidates(null)
                }
                runtime.onMentionCancel = clear
                return {
                  onStart: update,
                  onUpdate: update,
                  onExit: () => {
                    runtime.cancelMention(false)
                    clear()
                  },
                  onKeyDown: ({ event, view }) => {
                    if (
                      runtime.composing ||
                      view.composing ||
                      event.isComposing ||
                      event.keyCode === 229
                    )
                      return false
                    const active = candidateRef.current
                    if (event.key === 'Escape') {
                      runtime.cancelMention()
                      exitSuggestion(view)
                      return true
                    }
                    if (!active) return false
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      const count = active.props.items.length
                      const next = {
                        ...active,
                        index: count
                          ? (active.index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
                          : 0,
                      }
                      candidateRef.current = next
                      setCandidates(next)
                      return true
                    }
                    if (event.key === 'Enter' && active.props.items[active.index]) {
                      active.props.command(active.props.items[active.index]!)
                      return true
                    }
                    return false
                  },
                }
              },
            },
          })
    return [
      ...base,
      ...createPresetPlaceholder(preset, () => !!current.current.resolveMentions),
      ...(preset.options.emoji !== false
        ? [createEmojiTrigger(setEmojiAnchor, () => runtime.composing)]
        : []),
      ...(preset.options.slash !== false
        ? [
            createInsertBlockTrigger(
              setInsertAnchor,
              () => runtime.composing,
              (event) => insertKeyboard.current(event),
            ),
          ]
        : []),
      runtime.extension(),
    ]
    // Preset, schema, and all mutable extension storage belong to this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const editor = useEditor(
    {
      extensions,
      content: initial.ok ? initial.value : empty,
      editable: options.editable ?? true,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': options.ariaLabel },
      },
    },
    [],
  )
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    runtime.attach(editor)
    return () => runtime.detach(editor)
  }, [editor, runtime])
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(options.editable ?? true, false)
    editor.setOptions({
      editorProps: {
        attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': options.ariaLabel },
      },
    })
    if (runtime instanceof TiptapLifecycle) runtime.updateEditable()
    if (options.editable === false) {
      if (runtime instanceof TiptapLifecycle) {
        runtime.cancelMention()
        runtime.cancelUploads()
        exitSuggestion(editor.view)
      }
      closeEmojiPicker(editor)
      closeInsertBlock(editor)
    }
  }, [editor, options.editable, options.ariaLabel, runtime])
  const methods = useMemo<TiptapEditorHandle>(
    () => ({
      readJSON: () => runtime.read(),
      exportMarkdown: () => runtime.export(),
      replaceContent: (input) => runtime.replace(input),
      focus: () => runtime.focus(),
    }),
    [runtime],
  )
  const live = editor && !editor.isDestroyed ? editor : null
  const emojiPickerProps: MarkdownEmojiPickerProps | null =
    live && emojiAnchor && options.editable !== false
      ? {
          editor: live,
          anchor: { from: emojiAnchor.from, to: emojiAnchor.to },
          session: emojiAnchor.session,
        }
      : null
  const interactions =
    live && options.editable !== false ? (
      <>
        {emojiPickerProps && <MarkdownEmojiPicker {...emojiPickerProps} />}
        {preset.kind === 'tiptap' && preset.options.slash !== false && (
          <InsertBlockControls editor={live} />
        )}
        {insertAnchor && (
          <InsertBlockMenu
            editor={live}
            anchor={insertAnchor}
            runtime={runtime}
            markdown={preset.kind === 'markdown'}
            uploadEnabled={preset.kind === 'tiptap' && !!options.uploadImage}
            keyboard={insertKeyboard}
          />
        )}
        {candidates && runtime instanceof TiptapLifecycle && (
          <MentionPopup suggestion={candidates.props} index={candidates.index} runtime={runtime} />
        )}
      </>
    ) : null
  const result: UseTiptapEditorResult = { ...methods, editor: live, interactions, issues }
  return { result, runtime }
}

export function useTiptapEditor(options: UseTiptapEditorOptions): UseTiptapEditorResult {
  return useEditorSession(options).result
}
