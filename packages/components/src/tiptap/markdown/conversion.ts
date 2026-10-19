import { getSchema, type JSONContent, type MarkdownToken } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import type { TiptapInput, TiptapResult, TiptapIssue } from '../types'
import { createIsolatedMarked } from '../conversion/marked'
import { ContentBudget, ContentFailure, checkBytes, fail } from '../conversion/policy'
import { createMarkdownExtensions } from './extensions'
import { markdownKey, validateMarkdownJSON } from './validate'
import { canonicalMarkdownJSON } from './normalize'

function converter() {
  const extensions = createMarkdownExtensions({ purpose: 'conversion' })
  const schema = getSchema(extensions)
  const marked = createIsolatedMarked()
  const manager = new MarkdownManager({
    marked,
    markedOptions: { gfm: true, breaks: false, async: false },
    indentation: { style: 'space', size: 2 },
    extensions,
  })
  return { schema, marked, manager }
}
function checkedMarkdown(source: string, context: ReturnType<typeof converter>): JSONContent {
  if (typeof source !== 'string') fail('invalid-content')
  checkBytes(source)
  if (typeof window === 'undefined' || !window.DOMParser) fail('not-ready')
  const budget = new ContentBudget()
  function visit(token: MarkdownToken, depth: number) {
    budget.visit(depth)
    if (token.type === 'code' || token.type === 'codespan') return
    if (token.type === 'html') fail('unsupported-content')
    if (token.type === 'table') {
      for (const cell of [
        ...((token.header as MarkdownToken[]) ?? []),
        ...((token.rows as MarkdownToken[][]) ?? []).flat(),
      ])
        visit(cell, depth + 1)
    }
    for (const key of ['tokens', 'items'])
      for (const child of (token[key] as MarkdownToken[]) ?? []) visit(child, depth + 1)
  }
  for (const token of context.marked.lexer(source)) visit(token, 0)
  return validateMarkdownJSON(context.manager.parse(source), context.schema)
}
export function markdownResult<T>(work: (notices: TiptapIssue[]) => T): TiptapResult<T> {
  const notices: TiptapIssue[] = []
  try {
    return { ok: true, value: work(notices), notices }
  } catch (error) {
    return {
      ok: false,
      issues: [
        error instanceof ContentFailure
          ? error.issue
          : new ContentFailure('conversion-failed').issue,
      ],
    }
  }
}
export function parseMarkdownContent(input: TiptapInput): TiptapResult<JSONContent> {
  return markdownResult(() => {
    if (!input || typeof input !== 'object' || !['json', 'markdown'].includes(input.format))
      fail('invalid-content')
    const context = converter()
    return input.format === 'json'
      ? validateMarkdownJSON(input.content, context.schema)
      : checkedMarkdown(input.content, context)
  })
}
export function serializeMarkdownContent(content: JSONContent): TiptapResult<string> {
  return markdownResult((notices) => {
    const context = converter()
    const normalized = validateMarkdownJSON(content, context.schema)
    const snapshot = canonicalMarkdownJSON(normalized, notices)
    if (!snapshot.content?.length) return ''
    const source = context.manager.serialize(snapshot)
    checkBytes(source)
    let reimported: JSONContent
    try {
      reimported = checkedMarkdown(source, context)
    } catch (error) {
      if (
        error instanceof ContentFailure &&
        ['limit-exceeded', 'not-ready'].includes(error.issue.code)
      )
        throw error
      return fail('conversion-failed')
    }
    if (markdownKey(canonicalMarkdownJSON(reimported)) !== markdownKey(snapshot))
      fail('conversion-failed')
    return source
  })
}
