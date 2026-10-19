import type { JSONContent } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'
import { validateTableGrid } from './table-validation'
import type { TiptapContentPolicy, TiptapIssue } from '../types'
import {
  ADMONITION_TYPES,
  TIPTAP_LIMITS,
  ContentBudget,
  ContentFailure,
  checkBytes,
  fail,
  isSafeTiptapUrl,
  normalizeColor,
  normalizeFontSize,
  normalizeLinkRel,
  notice,
} from './policy'

function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  )
}
function attrsFor(
  type: string,
  input: unknown,
  allowed: readonly string[],
  defaults: Record<string, unknown>,
  policy: TiptapContentPolicy,
  notices: TiptapIssue[],
  path: string,
  htmlValues: boolean,
): Record<string, unknown> {
  if (input !== undefined && !record(input)) fail('invalid-content', path)
  const attrs: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!allowed.includes(key)) fail('unsupported-content', `${path}.${key}`)
    attrs[key] = value
  }
  for (const [key, value] of Object.entries(attrs)) {
    let normalized = value
    switch (key) {
      case 'align':
        if (value !== null && !['left', 'center', 'right'].includes(String(value)))
          fail('invalid-content', path)
        break
      case 'colspan':
      case 'rowspan':
        if (
          !Number.isSafeInteger(value) ||
          Number(value) < 1 ||
          Number(value) > TIPTAP_LIMITS.nodes
        )
          fail('invalid-content', path)
        break
      case 'colwidth':
        if (
          value !== null &&
          (!Array.isArray(value) ||
            value.length !== attrs.colspan ||
            value.some((width) => !Number.isInteger(width) || width < 0 || width > 8192))
        )
          fail('invalid-content', path)
        break
      case 'textAlign':
        if (value !== null && !['left', 'center', 'right', 'justify'].includes(String(value)))
          fail('invalid-content', path)
        break
      case 'level':
        if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 4)
          fail('invalid-content', path)
        break
      case 'start':
        if (!Number.isSafeInteger(value) || Number(value) < 1) fail('invalid-content', path)
        break
      case 'type':
        if (
          type === 'admonition'
            ? !ADMONITION_TYPES.includes(value as never)
            : value !== null &&
              (typeof value !== 'string' || !['1', 'a', 'A', 'i', 'I'].includes(value))
        )
          fail('invalid-content', path)
        break
      case 'open':
      case 'checked':
        if (typeof value !== 'boolean') fail('invalid-content', path)
        break
      case 'src':
      case 'href':
        if (!isSafeTiptapUrl(value, key === 'src' ? 'image' : 'link', policy))
          fail('unsafe-content', path)
        break
      case 'width':
      case 'height':
        if (
          value !== null &&
          (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 8192)
        )
          fail('invalid-content', path)
        break
      case 'alt':
      case 'title':
      case 'label':
        if (value !== null && typeof value !== 'string') fail('invalid-content', path)
        if (type === 'image' && value === '') normalized = null
        break
      case 'id':
        if (typeof value !== 'string' || !value.trim()) fail('invalid-content', path)
        break
      case 'mentionSuggestionChar':
        if (value !== '@') fail('invalid-content', path)
        break
      case 'color':
      case 'backgroundColor':
        normalized = normalizeColor(value, htmlValues)
        break
      case 'fontSize':
        normalized = normalizeFontSize(htmlValues && value === '' ? null : value)
        break
      case 'target':
        if (value !== null && value !== '_self' && value !== '_blank') fail('unsafe-content', path)
        break
      case 'rel':
        normalized = normalizeLinkRel(value, attrs.target)
        break
      case 'class':
        if (value !== null) fail('unsafe-content', path)
        break
      case 'language':
        if (value !== null && (typeof value !== 'string' || !/^[\w+-]*$/.test(value)))
          fail('invalid-content', path)
        break
      default:
        fail('unsupported-content', path)
    }
    if (normalized !== value) notices.push(notice(`${path}.${key}`))
    attrs[key] = normalized
  }
  return attrs
}

/** Reject unknown fields BEFORE ProseMirror drops them, then use its full structural check. */
export function validateTiptapJSON(
  input: unknown,
  schema: Schema,
  policy: TiptapContentPolicy = {},
  notices: TiptapIssue[] = [],
  htmlValues = false,
): JSONContent {
  const budget = new ContentBudget()
  const seen = new Set<object>()
  function visit(value: unknown, depth: number, path: string, mark = false): JSONContent {
    if (!mark) budget.visit(depth)
    if (!record(value) || seen.has(value)) return fail('invalid-content', path)
    seen.add(value)
    if (typeof value.type !== 'string') return fail('invalid-content', path)
    const spec = mark ? schema.marks[value.type] : schema.nodes[value.type]
    if (!spec) return fail('unsupported-content', path)
    for (const key of Object.keys(value))
      if (!(mark ? ['type', 'attrs'] : ['type', 'attrs', 'content', 'marks', 'text']).includes(key))
        fail('unsupported-content', `${path}.${key}`)
    const defaults = Object.fromEntries(
      Object.entries(spec.spec.attrs ?? {}).map(([key, attr]) => [key, attr.default]),
    )
    const attrs = attrsFor(
      value.type,
      value.attrs,
      Object.keys(spec.spec.attrs ?? {}),
      defaults,
      policy,
      notices,
      `${path}.attrs`,
      htmlValues,
    )
    const result: JSONContent = { type: value.type }
    if (Object.keys(attrs).length) result.attrs = attrs
    if (!mark) {
      if (value.type === 'text') {
        if (
          typeof value.text !== 'string' ||
          !value.text ||
          value.content !== undefined ||
          value.attrs !== undefined
        )
          fail('invalid-content', path)
        result.text = value.text as string
      } else if (value.text !== undefined) fail('invalid-content', path)
      if (value.content !== undefined) {
        if (!Array.isArray(value.content)) return fail('invalid-content', path)
        result.content = value.content.map((child, index) =>
          visit(child, depth + 1, `${path}.content[${index}]`),
        )
      }
      if (value.marks !== undefined) {
        if (!Array.isArray(value.marks) || value.marks.length > Object.keys(schema.marks).length)
          return fail('invalid-content', path)
        result.marks = value.marks.map((child, index) =>
          visit(child, depth + 1, `${path}.marks[${index}]`, true),
        ) as NonNullable<JSONContent['marks']>
      }
    }
    seen.delete(value)
    return result
  }
  const document = visit(input, 0, 'doc')
  checkBytes(JSON.stringify(document))
  if (document.type !== 'doc') fail('invalid-content', 'doc')
  document.content ??= []
  if (document.content.at(-1)?.type !== 'paragraph') {
    budget.visit(1)
    document.content.push({ type: 'paragraph', attrs: { textAlign: null } })
    notices.push(notice('doc.content'))
  }
  checkBytes(JSON.stringify(document))
  try {
    const node = schema.nodeFromJSON(document)
    node.check()
    node.descendants((table) => {
      if (table.type.name === 'table') validateTableGrid(table)
    })
    const normalized = node.toJSON()
    checkBytes(JSON.stringify(normalized))
    return normalized
  } catch (error) {
    if (error instanceof ContentFailure) throw error
    return fail('invalid-content', 'doc')
  }
}

/** Stable property ordering and ProseMirror mark ranking are provided by normalization. */
export function semanticJSON(content: JSONContent): string {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : record(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, stable(value[key])]),
          )
        : value
  return JSON.stringify(stable(content))
}
