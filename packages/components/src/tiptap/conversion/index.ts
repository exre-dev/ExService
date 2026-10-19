import { getSchema, type JSONContent, type MarkdownToken } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import type { TiptapInput, TiptapContentPolicy, TiptapResult, TiptapIssue } from '../types'
import { createTiptapExtensions } from '../extensions'
import { createIsolatedMarked } from './marked'
import { ContentBudget, ContentFailure, checkBytes, fail } from './policy'
import { validateTiptapHTML } from './html'
import { semanticJSON, validateTiptapJSON } from './validate'
import { parseValidatedTiptapHTML } from './dom'

function converter(policy: TiptapContentPolicy) {
  const extensions = createTiptapExtensions({ purpose: 'conversion', policy })
  const schema = getSchema(extensions)
  const marked = createIsolatedMarked()
  const manager = new MarkdownManager({
    marked,
    markedOptions: { gfm: true, breaks: false, async: false },
    indentation: { style: 'space', size: 2 },
    extensions,
  })
  return { extensions, schema, marked, manager }
}

function checkedMarkdown(
  content: string,
  context: ReturnType<typeof converter>,
  policy: TiptapContentPolicy,
  notices: TiptapIssue[],
): JSONContent {
  if (typeof content !== 'string') fail('invalid-content')
  checkBytes(content)
  if (typeof window === 'undefined' || !window.DOMParser) fail('not-ready')
  const tokens = context.marked.lexer(content)
  const budget = new ContentBudget()
  const htmlBudget = new ContentBudget()
  function walk(token: MarkdownToken, depth: number) {
    budget.visit(depth)
    if (token.type === 'heading' && Number(token.depth) > 4) fail('unsupported-content')
    if (token.type === 'code' || token.type === 'codespan') return
    if (['html', 'tiptapHtmlBlock', 'tiptapHtmlInline'].includes(token.type ?? ''))
      validateTiptapHTML(String(token.raw ?? token.text ?? ''), policy, notices, htmlBudget)
    if (token.type === 'table') {
      const cells = [
        ...((token.header as MarkdownToken[]) ?? []),
        ...((token.rows as MarkdownToken[][]) ?? []).flat(),
      ]
      for (const cell of cells) walk(cell, depth + 1)
    }
    for (const key of ['tokens', 'items', 'titleTokens', 'nestedTokens']) {
      const children = token[key] as MarkdownToken[] | undefined
      if (children) for (const child of children) walk(child, depth + 1)
    }
  }
  for (const token of tokens) walk(token, 0)
  // Preflight uses the same isolated tokenizers as the official parser. Finite HTML
  // style values are canonicalized after parsing, before schema validation.
  const parsed = context.manager.parse(content)
  return validateTiptapJSON(parsed, context.schema, policy, notices, true)
}

function result<T>(work: (notices: TiptapIssue[]) => T): TiptapResult<T> {
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

/** Synchronous browser conversion; all returned documents are independent normalized snapshots. */
export function parseTiptapContent(
  input: TiptapInput,
  policy: TiptapContentPolicy = {},
): TiptapResult<JSONContent> {
  return result((notices) => {
    if (!input || typeof input !== 'object' || !['json', 'markdown'].includes(input.format))
      fail('invalid-content')
    const context = converter(policy)
    return input.format === 'json'
      ? validateTiptapJSON(input.content, context.schema, policy, notices)
      : checkedMarkdown(input.content, context, policy, notices)
  })
}

export function serializeTiptapMarkdown(
  content: JSONContent,
  policy: TiptapContentPolicy = {},
): TiptapResult<string> {
  return result((notices) => {
    const context = converter(policy)
    const normalized = validateTiptapJSON(content, context.schema, policy, notices)
    const markdown = context.manager.serialize(normalized)
    const reparsed = checkedMarkdown(markdown, context, policy, [])
    if (semanticJSON(reparsed) !== semanticJSON(normalized)) fail('conversion-failed')
    return markdown
  })
}

/** Internal HTML paste/drop entry: returns fixed diagnostics and never throws to UI callers. */
export function parseTiptapHTML(
  content: string,
  policy: TiptapContentPolicy = {},
): TiptapResult<JSONContent> {
  return result((notices) => {
    if (typeof content !== 'string') fail('invalid-content')
    const html = validateTiptapHTML(content, policy, notices)
    if (typeof window === 'undefined' || !window.DOMParser) fail('not-ready')
    const context = converter(policy)
    return validateTiptapJSON(
      parseValidatedTiptapHTML(html, context.schema),
      context.schema,
      policy,
      notices,
      true,
    )
  })
}

export { validateTiptapHTML } from './html'
export { isSafeTiptapUrl, TIPTAP_LIMITS, ADMONITION_TYPES, ADMONITION_TITLES } from './policy'
export type { AdmonitionType } from './policy'
