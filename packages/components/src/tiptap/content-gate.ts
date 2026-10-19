import type { Editor, JSONContent } from '@tiptap/core'
import type { Node, Schema } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { ContentFailure } from './conversion/policy'
import { invokeContentObserver } from './content-events'
import { contentReplaceMeta } from './history'
import type { TiptapIssue } from './types'

export type ContentValidator = (content: JSONContent, schema: Schema) => JSONContent
export interface ContentOperation {
  issues?: readonly TiptapIssue[]
}
export const contentOperationMeta = new PluginKey<ContentOperation>('exreContentOperation')
interface GateState {
  revision: number
}
const key = new PluginKey<GateState>('exreContentGate')
type Report = (issues: readonly TiptapIssue[]) => void
interface DiagnosticOwner {
  report?: Report
  replaceAccepted?: () => void
}
interface Channel {
  sequence: number
  owner: DiagnosticOwner | null
  report: Report
  check: (transaction: Transaction) => boolean
}
const channels = new WeakMap<Editor, Channel>()
const receipts = new WeakMap<ContentOperation, { editor: Editor; document: Node }>()

export function contentFailure(error: unknown): readonly TiptapIssue[] {
  return [
    error instanceof ContentFailure ? error.issue : new ContentFailure('invalid-content').issue,
  ]
}

export function bindContentDiagnostics(
  editor: Editor,
  report?: Report,
  replaceAccepted?: () => void,
): void {
  const channel = channels.get(editor)
  if (channel) {
    channel.sequence++
    channel.owner = { report, replaceAccepted }
  }
}

export function invalidateContentDiagnostics(editor: Editor): void {
  const channel = channels.get(editor)
  if (channel) channel.sequence++
}

/** A diagnostic may wait in either a microtask or a reentrant observer queue. */
export function captureContentDiagnostic(editor: Editor): () => boolean {
  const channel = channels.get(editor),
    state = key.getState(editor.state)
  const sequence = channel?.sequence,
    owner = channel?.owner
  return () =>
    !!channel &&
    !editor.isDestroyed &&
    channels.get(editor) === channel &&
    channel.sequence === sequence &&
    channel.owner === owner &&
    key.getState(editor.state) === state
}

export function reportContentIssues(editor: Editor, issues: readonly TiptapIssue[]): void {
  const channel = channels.get(editor)
  if (channel && !editor.isDestroyed) {
    channel.sequence++
    channel.report(issues)
  }
}

export function contentAccepted(editor: Editor, operation: ContentOperation): boolean {
  return receipts.get(operation)?.editor === editor
}

export function acceptedContentSnapshot(
  editor: Editor,
  operation: ContentOperation,
): JSONContent | undefined {
  const receipt = receipts.get(operation)
  return receipt?.editor === editor ? structuredClone(receipt.document.toJSON()) : undefined
}

export function validateContentTransaction(editor: Editor, transaction: Transaction): boolean {
  return channels.get(editor)?.check(transaction) ?? false
}

/** Shared by Hook sessions and standalone extension factories; no React ownership is required. */
export function createContentGatePlugin(
  editor: Editor,
  validate: ContentValidator,
  onError?: Report,
): Plugin<GateState> {
  const channel: Channel = {
    sequence: 0,
    owner: null,
    report: (issues) => {
      if (editor.isDestroyed) return
      const callback = channel.owner ? channel.owner.report : onError
      if (callback) invokeContentObserver(() => callback(issues))
    },
    check: (transaction) => {
      channel.sequence++
      try {
        validate(transaction.doc.toJSON(), transaction.doc.type.schema)
        return true
      } catch (error) {
        const issues = contentFailure(error),
          operation = transaction.getMeta(contentOperationMeta) as ContentOperation | undefined
        if (operation) operation.issues = issues
        else {
          const current = captureContentDiagnostic(editor)
          queueMicrotask(() => {
            if (current()) channel.report(issues)
          })
        }
        return false
      }
    },
  }
  channels.set(editor, channel)
  return new Plugin<GateState>({
    key,
    state: {
      init: () => ({ revision: 0 }),
      apply(transaction, previous) {
        const operation = transaction.getMeta(contentOperationMeta) as ContentOperation | undefined
        const original = transaction.getMeta('appendedTransaction') as Transaction | undefined
        const accepted =
          operation ?? (original?.getMeta(contentOperationMeta) as ContentOperation | undefined)
        if (accepted) {
          receipts.set(accepted, { editor, document: transaction.doc })
        }
        // Commit recovery before native Editor events can start a newer operation.
        if (operation && transaction.getMeta(contentReplaceMeta)) channel.owner?.replaceAccepted?.()
        return transaction.docChanged || operation ? { revision: previous.revision + 1 } : previous
      },
    },
    filterTransaction: (transaction) => !transaction.docChanged || channel.check(transaction),
    view: () => {
      channels.set(editor, channel)
      return {
        destroy() {
          if (channels.get(editor) === channel) {
            channel.sequence++
            channels.delete(editor)
          }
        },
      }
    },
  })
}
