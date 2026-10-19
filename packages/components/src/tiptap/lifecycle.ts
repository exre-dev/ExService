import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import { Plugin, type Transaction } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { Slice, type Node } from '@tiptap/pm/model'
import { exitSuggestion } from '@tiptap/suggestion'
import { parseTiptapContent, parseTiptapHTML } from './conversion'
import { TIPTAP_LIMITS } from './conversion/policy'
import type {
  TiptapEditorSessionOptions,
  TiptapServiceCallbacks,
  TiptapContentPolicy,
  TiptapIssue,
  TiptapMentionItem,
  TiptapResult,
} from './types'
import { contentReplaceMeta } from './history'
import { ContentSession } from './content-session'
import { createTiptapContentAdapter } from './content-adapters'

type Callbacks = Pick<TiptapEditorSessionOptions, 'onChange' | 'onError' | 'onNotice'> &
  TiptapServiceCallbacks & { policy?: TiptapContentPolicy }
type BlockUploadTarget = { from: number; to: number; replace: boolean }
type Upload = {
  id: number
  generation: number
  pos: number
  controller: AbortController
  block?: BlockUploadTarget & { node: Node }
}

/** Per-instance event coordinator. Async work only retains mapped positions, never a stale Editor state. */
export class TiptapLifecycle {
  private content: ContentSession
  private editor: Editor | null = null
  private generation = 0
  private operation = 0
  private uploads = new Map<number, Upload>()
  private mention: AbortController | null = null
  private querySequence = 0
  get composing(): boolean {
    return this.content.composing
  }
  set composing(value: boolean) {
    this.content.composing = value
  }
  mentionFailed = false
  onMentionCancel?: () => void
  private editableListeners = new Set<() => void>()
  onEditableChange(listener: () => void): () => void {
    this.editableListeners.add(listener)
    return () => {
      this.editableListeners.delete(listener)
    }
  }
  updateEditable(): void {
    this.editableListeners.forEach((listener) => listener())
  }
  readonly read: ContentSession['read']
  readonly export: ContentSession['export']
  readonly replace: ContentSession['replace']
  readonly focus: ContentSession['focus']
  constructor(
    private readonly current: () => Callbacks,
    publish: (issues: readonly TiptapIssue[]) => void = () => {},
    initial?: TiptapResult<JSONContent>,
  ) {
    this.content = new ContentSession(
      createTiptapContentAdapter(() => this.current().policy),
      current,
      publish,
      initial,
      (editor) => exitSuggestion(editor.view),
    )
    this.read = this.content.read
    this.export = this.content.export
    this.replace = this.content.replace
    this.focus = this.content.focus
  }

  get documentGeneration(): number {
    return this.generation
  }

  attach(editor: Editor): void {
    if (editor.isDestroyed) return
    if (this.editor && this.editor !== editor) this.dispose()
    this.editor = editor
    this.content.attach(editor)
  }
  detach(editor: Editor): void {
    if (this.editor === editor) this.dispose()
  }
  report(issues: readonly TiptapIssue[]): void {
    this.content.report(issues)
  }
  private validate(transaction: Transaction): boolean {
    return this.content.validate(transaction)
  }
  extension() {
    const runtime = this
    return Extension.create({
      name: 'tiptapLifecycle',
      addExtensions: () => [runtime.content.extension()],
      addProseMirrorPlugins() {
        return [
          runtime.content.gate(this.editor),
          new Plugin({
            state: {
              init: () => null,
              apply(transaction, value) {
                if (transaction.getMeta(contentReplaceMeta)) runtime.invalidate()
                for (const [id, upload] of runtime.uploads) {
                  if (upload.block) {
                    let valid = true
                    for (const map of transaction.mapping.maps) {
                      const start = map.mapResult(upload.block.from, 1),
                        end = map.mapResult(upload.block.to, -1)
                      if (start.deleted || end.deleted) {
                        valid = false
                        break
                      }
                      upload.block.from = start.pos
                      upload.block.to = end.pos
                    }
                    const node = valid ? transaction.doc.nodeAt(upload.block.from) : null
                    if (
                      !node ||
                      transaction.doc.resolve(upload.block.from).depth !== 0 ||
                      upload.block.from + node.nodeSize !== upload.block.to ||
                      (upload.block.replace && !node.eq(upload.block.node))
                    ) {
                      upload.controller.abort()
                      runtime.uploads.delete(id)
                    } else upload.pos = upload.block.replace ? upload.block.from : upload.block.to
                    continue
                  }
                  const mapped = transaction.mapping.mapResult(upload.pos, 1)
                  if (mapped.deleted) {
                    upload.controller.abort()
                    runtime.uploads.delete(id)
                  } else upload.pos = mapped.pos
                }
                return value
              },
            },
            props: {
              handlePaste(view, event) {
                if (!view.editable || runtime.composing || view.composing) return false
                const files = Array.from(event.clipboardData?.files ?? [])
                if (files.length) {
                  files.forEach((file) => {
                    void runtime.upload(file)
                  })
                  return true
                }
                const html = event.clipboardData?.getData('text/html')
                if (html) {
                  runtime.insertHTML(html)
                  return true
                }
                // Let ProseMirror preserve plain text semantics. filterTransaction checks the whole candidate.
                return false
              },
              handleDrop(view, event, _slice, moved) {
                if (!view.editable || moved || runtime.composing || view.composing) return false
                const files = Array.from(event.dataTransfer?.files ?? [])
                if (files.length && !runtime.current().uploadImage) return false
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
                if (files.length) {
                  files.forEach((file) => {
                    void runtime.upload(file, pos)
                  })
                  return true
                }
                const html = event.dataTransfer?.getData('text/html')
                if (html) {
                  runtime.insertHTML(html, pos)
                  return true
                }
                return false
              },
              handleDOMEvents: {
                compositionstart() {
                  runtime.composing = true
                  runtime.cancelMention()
                  return false
                },
                compositionend() {
                  runtime.composing = false
                  return false
                },
                blur(view) {
                  runtime.cancelMention()
                  exitSuggestion(view)
                  return false
                },
              },
            },
          }),
        ]
      },
      // StrictMode may discard a second hook initializer. Its eventual destroy must
      // never tear down the live instance that uses this coordinator.
      onDestroy() {
        if (runtime.editor === this.editor) runtime.dispose()
      },
    })
  }
  insertHTML(html: string, pos?: number): boolean {
    const editor = this.editor
    if (!editor || editor.isDestroyed || !editor.isEditable) return false
    const result = parseTiptapHTML(html, this.current().policy)
    if (!result.ok) {
      this.report(result.issues)
      return false
    }
    const doc = editor.schema.nodeFromJSON(result.value)
    const slice = Slice.maxOpen(doc.content)
    const transaction =
      pos === undefined
        ? editor.state.tr.replaceSelection(slice)
        : editor.state.tr.replaceRange(pos, pos, slice)
    if (!this.validate(transaction)) return false
    editor.view.dispatch(transaction.scrollIntoView())
    return true
  }
  async upload(file: File, position?: number, blockTarget?: BlockUploadTarget): Promise<void> {
    const editor = this.editor,
      callback = this.current().uploadImage
    if (!editor || editor.isDestroyed || !editor.isEditable || this.composing) return
    if (!callback) {
      this.report([{ code: 'upload-failed', message: '未配置图片上传，请使用图片地址。' }])
      return
    }
    const node = blockTarget ? editor.state.doc.nodeAt(blockTarget.from) : null
    if (
      blockTarget &&
      (!node ||
        editor.state.doc.resolve(blockTarget.from).depth !== 0 ||
        blockTarget.from + node.nodeSize !== blockTarget.to)
    )
      return
    const upload: Upload = {
      id: ++this.operation,
      generation: this.generation,
      pos: blockTarget
        ? blockTarget.replace
          ? blockTarget.from
          : blockTarget.to
        : (position ?? editor.state.selection.from),
      controller: new AbortController(),
      ...(blockTarget && node ? { block: { ...blockTarget, node } } : {}),
    }
    this.uploads.set(upload.id, upload)
    try {
      const image = await callback(file, { signal: upload.controller.signal })
      if (!this.active(upload, editor)) return
      // Returned attributes and the complete candidate both pass the same schema/policy budget.
      const result = parseTiptapContent(
        { format: 'json', content: { type: 'doc', content: [{ type: 'image', attrs: image }] } },
        this.current().policy,
      )
      if (!result.ok) {
        this.report(result.issues)
        return
      }
      const imageNode = editor.schema.nodeFromJSON(result.value.content![0]!)
      const transaction = upload.block
        ? closeHistory(
            editor.state.tr.replaceWith(
              upload.pos,
              upload.block.replace ? upload.block.to : upload.pos,
              imageNode,
            ),
          )
        : editor.state.tr.replaceRangeWith(upload.pos, upload.pos, imageNode)
      if (!this.validate(transaction)) return
      // Do not move the user's current selection to the original upload anchor.
      this.uploads.delete(upload.id)
      editor.view.dispatch(transaction)
    } catch {
      if (this.active(upload, editor))
        this.report([{ code: 'upload-failed', message: '图片上传失败，请重新选择文件重试。' }])
    } finally {
      this.uploads.delete(upload.id)
    }
  }
  private active(upload: Upload, editor: Editor): boolean {
    return (
      this.editor === editor &&
      !editor.isDestroyed &&
      editor.isEditable &&
      !upload.controller.signal.aborted &&
      upload.generation === this.generation &&
      this.uploads.has(upload.id)
    )
  }
  async query(query: string, signal?: AbortSignal): Promise<TiptapMentionItem[]> {
    this.cancelMention(false)
    const callback = this.current().resolveMentions,
      editor = this.editor
    if (!callback || !editor?.isEditable || this.composing || editor.view.composing) return []
    const controller = new AbortController(),
      sequence = ++this.querySequence,
      generation = this.generation
    this.mention = controller
    this.mentionFailed = false
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
    try {
      const results = await callback(query, { signal: controller.signal })
      if (
        controller.signal.aborted ||
        sequence !== this.querySequence ||
        generation !== this.generation ||
        editor !== this.editor ||
        editor.isDestroyed ||
        this.composing
      )
        return []
      const seen = new Set<string>()
      return results
        .filter((item) => {
          if (
            !item ||
            typeof item.id !== 'string' ||
            !item.id ||
            typeof item.label !== 'string' ||
            !item.label ||
            seen.has(item.id)
          )
            return false
          seen.add(item.id)
          return true
        })
        .slice(0, TIPTAP_LIMITS.mentions)
    } catch {
      if (
        !controller.signal.aborted &&
        sequence === this.querySequence &&
        generation === this.generation
      ) {
        this.mentionFailed = true
        this.report([{ code: 'mention-failed', message: '提及查询失败，请重试。' }])
      }
      return []
    } finally {
      signal?.removeEventListener('abort', abort)
    }
  }
  cancelMention(notify = true): void {
    this.mention?.abort()
    this.mention = null
    this.querySequence++
    if (notify) this.onMentionCancel?.()
  }
  cancelUploads(): void {
    for (const upload of this.uploads.values()) upload.controller.abort()
    this.uploads.clear()
  }
  private invalidate(): void {
    this.generation++
    this.cancelUploads()
    this.cancelMention()
  }
  dispose(): void {
    this.invalidate()
    if (this.editor) this.content.detach(this.editor)
    this.editor = null
  }
}
