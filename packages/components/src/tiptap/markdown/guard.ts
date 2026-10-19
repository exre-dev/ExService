import { Extension } from '@tiptap/core'
import { Plugin, type Transaction } from '@tiptap/pm/state'
import { Slice } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import type { EditorView } from '@tiptap/pm/view'
import { ContentFailure } from '../conversion/policy'
import type { TiptapIssue } from '../types'
import type { MarkdownExtensionOptions } from './types'
import { validateMarkdownJSON } from './validate'
import { parseMarkdownHTML, plainTextDocument } from './paste'
import { parseMarkdownContent } from './conversion'
import {
  contentAccepted,
  contentFailure,
  contentOperationMeta,
  createContentGatePlugin,
  reportContentIssues,
  type ContentOperation,
} from '../content-gate'
import { invokeContentObserver } from '../content-events'

export function createMarkdownGuard(options: MarkdownExtensionOptions) {
  return Extension.create({
    name: 'markdownContentGuard',
    priority: 1000,
    addProseMirrorPlugins() {
      const editor = this.editor
      const report = (issues: readonly TiptapIssue[]) => reportContentIssues(editor, issues)
      const commit = (view: EditorView, tr: Transaction, notices: readonly TiptapIssue[] = []) => {
        const operation: ContentOperation = {}
        closeHistory(tr).setMeta(contentOperationMeta, operation)
        validateMarkdownJSON(tr.doc.toJSON(), view.state.schema, false)
        view.dispatch(tr.scrollIntoView())
        if (contentAccepted(editor, operation)) {
          if (notices.length) invokeContentObserver(() => options.onNotice?.(notices))
        } else report(operation.issues ?? [new ContentFailure('invalid-content').issue])
      }
      const insert = (view: EditorView, html: string, text: string, pos?: number) => {
        try {
          if (!html && !text) {
            report([new ContentFailure('unsupported-content').issue])
            return
          }
          const { $from, $to } = view.state.selection
          if (pos === undefined && text && $from.parent.type.spec.code && $from.sameParent($to)) {
            commit(view, view.state.tr.insertText(text))
            return
          }
          if (!html && options.pasteMarkdown) {
            const parsed = parseMarkdownContent({ format: 'markdown', content: text })
            if (!parsed.ok) {
              report(parsed.issues)
              return
            }
            const slice = Slice.maxOpen(view.state.schema.nodeFromJSON(parsed.value).content, false)
            commit(
              view,
              pos === undefined
                ? view.state.tr.replaceSelection(slice)
                : view.state.tr.replaceRange(pos, pos, slice),
            )
            return
          }
          const parsed = html ? parseMarkdownHTML(html, view.state.schema) : null
          if (
            parsed &&
            !parsed.ok &&
            parsed.issues.some((issue) => issue.code === 'limit-exceeded')
          ) {
            report(parsed.issues)
            return
          }
          const meaningful =
            parsed?.ok &&
            (parsed.value.textContent.length ||
              parsed.value.content.content.some(
                (node) => node.type.name !== 'paragraph' || node.childCount,
              ))
          if (parsed && !parsed.ok && !text) {
            report(parsed.issues)
            return
          }
          if (!meaningful && !text) {
            report([new ContentFailure('unsupported-content').issue])
            return
          }
          const doc =
            meaningful && parsed?.ok ? parsed.value : plainTextDocument(text, view.state.schema)
          const notices =
            meaningful && parsed?.ok
              ? parsed.notices
              : html
                ? [new ContentFailure('downgraded-content').issue]
                : []
          // Table is isolating. Opening through it can fit a 1×1 table as plain
          // paragraph text; keep isolating boundaries while ordinary p can merge.
          const slice = Slice.maxOpen(doc.content, false)
          commit(
            view,
            pos === undefined
              ? view.state.tr.replaceSelection(slice)
              : view.state.tr.replaceRange(pos, pos, slice),
            notices,
          )
        } catch (error) {
          report(contentFailure(error))
        }
      }
      const filesError = () =>
        report([
          { code: 'unsupported-content', message: '此编辑器不支持文件上传，请使用图片地址。' },
        ])
      return [
        createContentGatePlugin(
          editor,
          (content, schema) => validateMarkdownJSON(content, schema, false),
          options.onError,
        ),
        new Plugin({
          props: {
            handlePaste(view, event) {
              if (!view.editable) return false
              const data = event.clipboardData
              if (data?.files.length) {
                filesError()
                return true
              }
              if (!data) return false
              insert(view, data.getData('text/html'), data.getData('text/plain'))
              return true
            },
            handleDrop(view, event, _slice, moved) {
              if (moved || !view.editable) return false
              const data = event.dataTransfer
              if (data?.files.length) {
                filesError()
                return true
              }
              if (!data?.getData('text/html')) return false
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
              if (pos === undefined || editor.isDestroyed || editor.view !== view) return true
              insert(view, data.getData('text/html'), data.getData('text/plain'), pos)
              return true
            },
          },
        }),
      ]
    },
  })
}
