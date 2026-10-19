import type { AnyExtension, Editor } from '@tiptap/core'
import type { TiptapIssue } from '../types'

export interface MarkdownExtensionOptions {
  purpose: 'editing' | 'viewing' | 'conversion'
  pasteMarkdown?: boolean
  onError?: (issues: readonly TiptapIssue[]) => void
  onNotice?: (notices: readonly TiptapIssue[]) => void
}
export interface MarkdownEmojiAnchor {
  readonly from: number
  readonly to: number
}
export interface MarkdownEmojiPickerProps {
  editor: Editor
  anchor: MarkdownEmojiAnchor
  session: object
}
export type MarkdownExtensions = AnyExtension[]
