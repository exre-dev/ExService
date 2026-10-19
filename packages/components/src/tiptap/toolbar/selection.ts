import type { Editor } from '@tiptap/core'
import {
  NodeSelection,
  TextSelection,
  type Selection,
  type SelectionBookmark,
  type Transaction,
} from '@tiptap/pm/state'
import type { StepMap } from '@tiptap/pm/transform'
import type { TiptapLifecycle } from '../lifecycle'

/** A true command return alone does not prove filterTransaction accepted it. */
export function applyDocumentCommand(editor: Editor, command: () => boolean): boolean {
  if (editor.isDestroyed || !editor.isEditable) return false
  let applied = false
  const observe = () => {
    applied = true
  }
  editor.on('transaction', observe)
  try {
    return command() && applied
  } finally {
    editor.off('transaction', observe)
  }
}

type Span = { from: number; to: number }

/** Retain only surviving original content, even through several replacements in
 * one transaction. A replacement's new content is not the captured selection. */
function survivingSpans(spans: readonly Span[], map: StepMap): Span[] {
  let remaining = [...spans]
  map.forEach((oldStart, oldEnd, newStart, newEnd) => {
    if (oldEnd === oldStart) {
      // Track original characters on each side separately. Otherwise a later
      // deletion could leave only the inserted text and falsely keep us valid.
      if (newEnd > newStart)
        remaining = remaining.flatMap((span) =>
          span.from < oldStart && span.to > oldStart
            ? [
                { from: span.from, to: oldStart },
                { from: oldStart, to: span.to },
              ]
            : [span],
        )
      return
    }
    remaining = remaining.flatMap((span) => {
      if (oldEnd <= span.from || oldStart >= span.to) return [span]
      const pieces: Span[] = []
      if (span.from < oldStart) pieces.push({ from: span.from, to: oldStart })
      if (span.to > oldEnd) pieces.push({ from: oldEnd, to: span.to })
      return pieces
    })
  })
  return remaining
    .map((span) => ({ from: map.map(span.from, 1), to: map.map(span.to, -1) }))
    .filter((span) => span.from < span.to)
}

/** One root menu owns one session; nested panels reuse it until close. */
export class ToolbarSession {
  private readonly generation: number
  private bookmark: SelectionBookmark
  private readonly kind: 'text' | 'node' | 'other'
  private readonly backward: boolean
  private readonly empty: boolean
  private spans: Span[] = []
  private from: number
  private to: number
  private active = true
  private applying = false
  private readonly observe = ({
    transaction,
    appendedTransactions,
  }: {
    transaction: Transaction
    appendedTransactions: Transaction[]
  }) => {
    this.map(transaction)
    for (const appended of appendedTransactions) this.map(appended)
  }
  private readonly observeAvailability = () => {
    void this.valid
  }
  private readonly observeDestroy = () => this.invalidate()

  constructor(
    private readonly editor: Editor,
    private readonly runtime: TiptapLifecycle,
    private readonly onInvalidate?: () => void,
  ) {
    const selection = editor.state.selection
    this.generation = runtime.documentGeneration
    this.bookmark = selection.getBookmark()
    this.kind =
      selection instanceof TextSelection
        ? 'text'
        : selection instanceof NodeSelection
          ? 'node'
          : 'other'
    this.backward = selection.anchor > selection.head
    this.empty = selection.empty
    this.from = selection.from
    this.to = selection.to
    if (!selection.empty && this.kind !== 'node') {
      editor.state.doc.nodesBetween(this.from, this.to, (node, pos) => {
        if (node.isInline)
          this.spans.push({
            from: Math.max(this.from, pos),
            to: Math.min(this.to, pos + node.nodeSize),
          })
      })
      if (!this.spans.length) this.spans.push({ from: this.from, to: this.to })
    }
    if (editor.isDestroyed || !editor.isEditable) this.active = false
    else {
      editor.on('transaction', this.observe)
      editor.on('update', this.observeAvailability)
      editor.on('destroy', this.observeDestroy)
    }
  }

  get valid(): boolean {
    if (
      this.active &&
      (this.editor.isDestroyed ||
        !this.editor.isEditable ||
        this.runtime.documentGeneration !== this.generation)
    )
      this.invalidate()
    return this.active
  }

  private invalidate(): void {
    if (!this.active) return
    this.active = false
    this.editor.off('transaction', this.observe)
    this.editor.off('update', this.observeAvailability)
    this.editor.off('destroy', this.observeDestroy)
    if (!this.applying) this.onInvalidate?.()
  }

  private map(transaction: Transaction): void {
    if (!this.valid) return
    for (const map of transaction.mapping.maps) {
      if (this.kind === 'node') {
        const result = map.mapResult(this.from, 1)
        if (result.deleted) {
          this.invalidate()
          return
        }
        this.from = result.pos
        this.to = map.map(this.to, -1)
      } else if (this.empty) {
        const result = map.mapResult(this.from, 1)
        if (result.deleted) {
          this.invalidate()
          return
        }
        this.from = this.to = result.pos
      } else {
        this.spans = survivingSpans(this.spans, map)
        if (!this.spans.length) {
          this.invalidate()
          return
        }
        this.from = this.spans[0]!.from
        this.to = this.spans.at(-1)!.to
      }
    }
    this.bookmark = this.bookmark.map(transaction.mapping)
  }

  private resolve(): Selection | null {
    if (!this.valid) return null
    const doc = this.editor.state.doc
    try {
      if (this.kind === 'text') {
        // TextBookmark.resolve falls back to Selection.near when anchors cease
        // to be text positions. Refuse that silent change of operation target.
        const $from = doc.resolve(this.from),
          $to = doc.resolve(this.to)
        if (
          !$from.parent.inlineContent ||
          !$to.parent.inlineContent ||
          (!this.empty && this.from >= this.to)
        ) {
          this.invalidate()
          return null
        }
        return TextSelection.create(
          doc,
          this.backward ? this.to : this.from,
          this.backward ? this.from : this.to,
        )
      }
      const selection = this.bookmark.resolve(doc)
      if (
        this.kind === 'node' &&
        (!(selection instanceof NodeSelection) || selection.from !== this.from)
      ) {
        this.invalidate()
        return null
      }
      return selection
    } catch {
      this.invalidate()
      return null
    }
  }

  /** Restore before starting an upload, so runtime owns the mapped upload anchor. */
  restore(): boolean {
    const selection = this.resolve()
    if (!selection) return false
    this.editor.view.dispatch(this.editor.state.tr.setSelection(selection))
    return this.valid && this.editor.state.selection.eq(selection)
  }

  run(command: (editor: Editor) => boolean): boolean {
    // Restoration is deliberately outside the applied-transaction observer.
    if (!this.restore()) return false
    this.applying = true
    let accepted: boolean
    try {
      accepted = applyDocumentCommand(this.editor, () => command(this.editor))
    } finally {
      this.applying = false
    }
    if (!accepted) return false
    if (
      this.editor.isDestroyed ||
      !this.editor.isEditable ||
      this.runtime.documentGeneration !== this.generation
    )
      return false
    // Keep the command's resulting selection; focus never restores the bookmark.
    this.editor.view.focus()
    return true
  }

  dispose(): void {
    this.active = false
    this.editor.off('transaction', this.observe)
    this.editor.off('update', this.observeAvailability)
    this.editor.off('destroy', this.observeDestroy)
  }
}
