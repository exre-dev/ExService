import type { JSONContent } from '@tiptap/core'
import type { TiptapIssue } from '../types'
import { createIsolatedMarked } from '../conversion/marked'
import { ContentFailure, fail } from '../conversion/policy'
import { markdownKey } from './validate'

export function normalizationNotice(): TiptapIssue {
  return new ContentFailure('normalized-content').issue
}

/** Exchange-only snapshot: it never mutates the live editor or deletes text. */
export function canonicalMarkdownJSON(
  input: JSONContent,
  notices: TiptapIssue[] = [],
): JSONContent {
  let changed = false
  const marked = createIsolatedMarked()
  const append = (out: JSONContent[], node: JSONContent) => {
    const previous = out.at(-1)
    if (
      previous?.type === 'text' &&
      node.type === 'text' &&
      markdownKey(previous.marks ?? []) === markdownKey(node.marks ?? [])
    )
      previous.text = (previous.text ?? '') + node.text
    else out.push(node)
  }
  function inline(nodes: JSONContent[], table: boolean): JSONContent[] {
    const out: JSONContent[] = []
    for (const raw of nodes) {
      const node = JSON.parse(JSON.stringify(raw)) as JSONContent
      if (node.type !== 'text') {
        out.push(node)
        continue
      }
      if (node.marks?.length) node.marks.sort((a, b) => a.type.localeCompare(b.type))
      const code = node.marks?.some((mark) => mark.type === 'code')
      const chunks: JSONContent[] = []
      if (!code && node.marks?.length) {
        const text = node.text ?? ''
        const lead = text.match(/^\s+/)?.[0] ?? ''
        const rest = text.slice(lead.length)
        const tail = rest.match(/\s+$/)?.[0] ?? ''
        if (lead || tail) changed = true
        if (lead) chunks.push({ type: 'text', text: lead })
        if (rest.length > tail.length)
          chunks.push({ ...node, text: rest.slice(0, rest.length - tail.length) })
        if (tail) chunks.push({ type: 'text', text: tail })
      } else chunks.push(node)
      for (const chunk of chunks) {
        if (chunk.marks?.some((mark) => mark.type === 'code' || mark.type === 'link')) {
          append(out, chunk)
          continue
        }
        const tokens = marked.Lexer.lexInline(chunk.text ?? '', { gfm: true, breaks: false })
        for (const token of tokens) {
          // Explicit [link] syntax in ordinary JSON text stays ordinary text.
          const autolink = token.type === 'link' && !token.raw.startsWith('[')
          append(
            out,
            autolink
              ? {
                  ...chunk,
                  text: token.raw,
                  marks: [
                    ...(chunk.marks ?? []),
                    { type: 'link', attrs: { href: token.href, title: null } },
                  ].sort((a, b) => a.type.localeCompare(b.type)),
                }
              : { ...chunk, text: token.raw },
          )
          if (autolink) changed = true
        }
      }
    }
    if (table) {
      const first = out[0],
        last = out.at(-1)
      if (first?.type === 'text' && !first.marks?.length) {
        const text = first.text!.replace(/^ +/, '')
        if (text !== first.text) changed = true
        first.text = text
      }
      if (last?.type === 'text' && !last.marks?.length) {
        const text = last.text!.replace(/ +$/, '')
        if (text !== last.text) changed = true
        last.text = text
      }
    }
    return out.filter((node) => node.type !== 'text' || node.text)
  }
  function visit(node: JSONContent, table = false): JSONContent | null {
    if (node.type === 'codeBlock') return JSON.parse(JSON.stringify(node)) as JSONContent
    const result: JSONContent = { ...node, ...(node.attrs ? { attrs: { ...node.attrs } } : {}) }
    if (node.type === 'paragraph' || node.type === 'heading') {
      const content = inline(node.content ?? [], table)
      if (!content.length && !table) {
        changed = true
        return null
      }
      result.content = content
      return result
    }
    if (node.content) {
      result.content = node.content
        .map((child) =>
          visit(child, table || node.type === 'tableCell' || node.type === 'tableHeader'),
        )
        .filter((child): child is JSONContent => !!child)
      if (
        ['listItem', 'taskItem'].includes(node.type ?? '') &&
        result.content[0]?.type !== 'paragraph'
      ) {
        // Empty list items cannot be represented by a standalone empty marker.
        if (!result.content.length) fail('conversion-failed')
        result.content.unshift({ type: 'paragraph', content: [] })
      }
      if (node.type === 'blockquote' && !result.content.length) fail('conversion-failed')
    }
    return result
  }
  const result = visit(input)!
  if (changed) notices.push(normalizationNotice())
  return result
}
