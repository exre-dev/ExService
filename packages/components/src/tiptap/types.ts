import type { Editor, JSONContent } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import type { ReactNode } from 'react'

export type TiptapInput =
  { format: 'json'; content: JSONContent } | { format: 'markdown'; content: string }
export type TiptapIssueCode =
  | 'not-ready'
  | 'invalid-content'
  | 'unsupported-content'
  | 'unsafe-content'
  | 'limit-exceeded'
  | 'conversion-failed'
  | 'upload-failed'
  | 'mention-failed'
  | 'normalized-content'
  | 'downgraded-content'
export interface TiptapIssue {
  code: TiptapIssueCode
  message: string
  path?: string
}
export type TiptapResult<T> =
  | { ok: true; value: T; notices: readonly TiptapIssue[] }
  | { ok: false; issues: readonly TiptapIssue[] }
export interface TiptapContentPolicy {
  allowRasterDataImages?: boolean
}
export interface TiptapMentionItem {
  id: string
  label: string
}
export interface TiptapUploadedImage {
  src: string
  alt?: string
  title?: string
  width?: number
  height?: number
}
export interface TiptapEditorHandle {
  readJSON(): TiptapResult<JSONContent>
  exportMarkdown(): TiptapResult<string>
  replaceContent(input: TiptapInput): TiptapResult<JSONContent>
  focus(): void
}
export type TiptapPlaceholder =
  | string
  | false
  | ((context: { editor: Editor; node: Node; pos: number; hasAnchor: boolean }) => string)
export interface MarkdownPresetOptions {
  placeholder?: TiptapPlaceholder
  slash?: boolean
  emoji?: boolean
  pasteMarkdown?: boolean
}
export interface TiptapPresetOptions extends Omit<MarkdownPresetOptions, 'pasteMarkdown'> {
  policy?: TiptapContentPolicy
}
export interface MarkdownPreset {
  readonly kind: 'markdown'
  readonly options: Readonly<MarkdownPresetOptions>
}
export interface FullTiptapPreset {
  readonly kind: 'tiptap'
  readonly options: Readonly<TiptapPresetOptions>
}
export type TiptapPreset = MarkdownPreset | FullTiptapPreset
export interface TiptapEditorSessionOptions {
  initialContent?: TiptapInput
  editable?: boolean
  ariaLabel: string
  onChange?: (content: JSONContent) => void
  onError?: (issues: readonly TiptapIssue[]) => void
  onNotice?: (notices: readonly TiptapIssue[]) => void
}
export interface TiptapServiceCallbacks {
  uploadImage?: (file: File, context: { signal: AbortSignal }) => Promise<TiptapUploadedImage>
  resolveMentions?: (
    query: string,
    context: { signal: AbortSignal },
  ) => Promise<readonly TiptapMentionItem[]>
}
export type UseTiptapEditorOptions = TiptapEditorSessionOptions &
  (
    | { preset: MarkdownPreset; uploadImage?: never; resolveMentions?: never }
    | ({ preset: FullTiptapPreset } & TiptapServiceCallbacks)
  )
export interface UseTiptapEditorResult extends TiptapEditorHandle {
  editor: Editor | null
  interactions: ReactNode
  issues: readonly TiptapIssue[]
}
export type TiptapEditorProps = TiptapEditorSessionOptions & { className?: string } & (
    | { preset: MarkdownPreset; uploadImage?: never; resolveMentions?: never }
    | ({ preset?: FullTiptapPreset } & TiptapServiceCallbacks)
  )
export interface TiptapViewerProps {
  preset?: TiptapPreset
  content: TiptapInput
  ariaLabel: string
  className?: string
  onError?: (issues: readonly TiptapIssue[]) => void
}
