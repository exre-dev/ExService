import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import { Plugin, Selection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { ContentFailure } from './conversion/policy'
import { ContentNotifications, invokeContentObserver } from './content-events'
import {
  acceptedContentSnapshot,
  bindContentDiagnostics,
  captureContentDiagnostic,
  contentAccepted,
  contentFailure,
  contentOperationMeta,
  createContentGatePlugin,
  invalidateContentDiagnostics,
  validateContentTransaction,
  type ContentOperation,
  type ContentValidator,
} from './content-gate'
import { contentReplaceMeta } from './history'
import { emojiCancelMeta } from './emoji-trigger'
import { insertBlockCancelMeta } from './insert-block'
import type { TiptapEditorSessionOptions, TiptapInput, TiptapIssue, TiptapResult } from './types'

export interface ContentAdapter {
  parse(input: TiptapInput): TiptapResult<JSONContent>
  validate: ContentValidator
  serialize(content: JSONContent): TiptapResult<string>
}
type Callbacks = Pick<TiptapEditorSessionOptions, 'onChange' | 'onError' | 'onNotice'>
const notReady = (): TiptapResult<never> => ({
  ok: false,
  issues: [new ContentFailure('not-ready').issue],
})

/** One Editor's content protocol. Preset semantics and service operations remain outside. */
export class ContentSession {
  private attached: Editor | null = null
  private initialIssues: readonly TiptapIssue[] = []
  private initialNotified = false
  private notifications = new ContentNotifications()
  composing = false

  constructor(
    private readonly adapter: ContentAdapter,
    private readonly current: () => Callbacks,
    private readonly publish: (issues: readonly TiptapIssue[]) => void = () => {},
    initial?: TiptapResult<JSONContent>,
    private readonly afterReplace?: (editor: Editor) => void,
  ) {
    if (initial && !initial.ok) this.initialIssues = initial.issues
  }

  get editor(): Editor | null {
    return this.attached && !this.attached.isDestroyed ? this.attached : null
  }
  owns(editor: Editor): boolean {
    return this.editor === editor
  }
  attach(editor: Editor): void {
    if (editor.isDestroyed) return
    if (this.attached && this.attached !== editor) this.detach(this.attached)
    this.attached = editor
    bindContentDiagnostics(editor, this.report, () => {
      this.initialIssues = []
      this.publishIssues([])
    })
    if (this.initialIssues.length && !this.initialNotified) {
      this.initialNotified = true
      this.report(this.initialIssues)
    }
  }
  detach(editor: Editor): void {
    if (this.attached !== editor) return
    bindContentDiagnostics(editor)
    this.attached = null
    this.composing = false
  }
  private publishIssues(issues: readonly TiptapIssue[]): void {
    invokeContentObserver(() => this.publish(structuredClone(issues)))
  }
  report = (issues: readonly TiptapIssue[]): void => {
    const editor = this.editor
    if (!editor) return
    invalidateContentDiagnostics(editor)
    this.publishIssues(issues)
    const callback = this.current().onError,
      snapshot = structuredClone(issues),
      current = captureContentDiagnostic(editor)
    if (callback)
      this.notifications.send([
        () => {
          if (this.owns(editor) && current()) callback(snapshot)
        },
      ])
  }
  notice = (notices: readonly TiptapIssue[]): void => {
    const callback = this.current().onNotice,
      snapshot = structuredClone(notices)
    if (this.editor && notices.length && callback)
      this.notifications.send([() => callback(snapshot)])
  }
  private settle<T>(result: TiptapResult<T>): TiptapResult<T> {
    if (!result.ok) this.report(result.issues)
    else {
      if (this.editor) invalidateContentDiagnostics(this.editor)
      this.publishIssues(this.initialIssues)
      this.notice(result.notices)
    }
    return result
  }
  read = (): TiptapResult<JSONContent> => {
    const editor = this.editor
    if (!editor) return notReady()
    try {
      return this.settle({
        ok: true,
        value: this.adapter.validate(editor.getJSON(), editor.schema),
        notices: [],
      })
    } catch (error) {
      return this.settle({ ok: false, issues: contentFailure(error) })
    }
  }
  export = (): TiptapResult<string> => {
    const editor = this.editor
    if (!editor) return notReady()
    if (this.initialIssues.length) {
      invalidateContentDiagnostics(editor)
      return { ok: false, issues: structuredClone(this.initialIssues) }
    }
    return this.settle(this.adapter.serialize(editor.getJSON()))
  }
  focus = (): void => {
    this.editor?.commands.focus()
  }
  validate(transaction: Parameters<typeof validateContentTransaction>[1]): boolean {
    return !!this.editor && validateContentTransaction(this.editor, transaction)
  }
  gate(editor: Editor) {
    return createContentGatePlugin(editor, this.adapter.validate, this.report)
  }

  replace = (input: TiptapInput): TiptapResult<JSONContent> => {
    const editor = this.editor
    if (!editor) return notReady()
    const parsed = this.adapter.parse(input)
    if (!parsed.ok) return this.settle(parsed)
    const complete = this.notifications.reserve()
    let notifications: (() => void)[] = []
    try {
      const doc = editor.schema.nodeFromJSON(parsed.value),
        operation: ContentOperation = {}
      const transaction = closeHistory(
        editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content),
      )
        .setMeta(contentOperationMeta, operation)
        .setMeta(contentReplaceMeta, true)
        .setMeta(emojiCancelMeta, true)
        .setMeta(insertBlockCancelMeta, true)
        .setMeta('addToHistory', false)
      transaction.setSelection(Selection.atStart(transaction.doc))
      this.adapter.validate(transaction.doc.toJSON(), editor.schema)
      editor.view.dispatch(transaction)
      if (!contentAccepted(editor, operation))
        return this.settle({
          ok: false,
          issues: operation.issues ?? contentFailure(new ContentFailure('invalid-content')),
        })
      // Fix the result before host observers can mutate snapshots or replace again.
      const accepted = {
        value: acceptedContentSnapshot(editor, operation)!,
        notices: structuredClone(parsed.notices),
      }
      const callbacks = this.current(),
        snapshot = structuredClone(accepted.value),
        notices = structuredClone(accepted.notices)
      notifications = [
        ...(callbacks.onChange ? [() => callbacks.onChange!(snapshot)] : []),
        ...(callbacks.onNotice && notices.length ? [() => callbacks.onNotice!(notices)] : []),
      ]
      return { ok: true, ...accepted }
    } catch (error) {
      return this.settle({ ok: false, issues: contentFailure(error) })
    } finally {
      complete(notifications)
    }
  }

  extension() {
    const session = this
    return Extension.create({
      name: 'tiptapContentSession',
      addProseMirrorPlugins: () => [
        new Plugin({
          props: {
            handleDOMEvents: {
              compositionstart() {
                session.composing = true
                return false
              },
              compositionend() {
                session.composing = false
                return false
              },
            },
          },
        }),
      ],
      onTransaction({ editor, transaction }) {
        if (session.owns(editor) && transaction.getMeta(contentReplaceMeta))
          session.afterReplace?.(editor)
      },
      onUpdate({ editor, transaction }) {
        if (!session.owns(editor) || transaction.getMeta(contentReplaceMeta)) return
        invalidateContentDiagnostics(editor)
        session.publishIssues(session.initialIssues)
        const callback = session.current().onChange,
          snapshot = structuredClone(editor.getJSON())
        if (callback) session.notifications.send([() => callback(snapshot)])
      },
      onDestroy() {
        session.detach(this.editor)
      },
    })
  }
}
