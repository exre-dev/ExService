import type { JSONContent } from '@tiptap/core'
import type { Node, Schema } from '@tiptap/pm/model'
import {
  ContentBudget,
  ContentFailure,
  checkBytes,
  fail,
  isSafeTiptapUrl,
} from '../conversion/policy'

export function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  )
}
function attributes(type: string, input: unknown, defaults: Record<string, unknown>, path: string) {
  if (input !== undefined && !record(input)) fail('invalid-content', path)
  const result = { ...defaults }
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!(key in defaults)) fail('unsupported-content', `${path}.${key}`)
    result[key] = value
  }
  for (const [key, value] of Object.entries(result)) {
    switch (key) {
      case 'level':
        if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 6)
          fail('invalid-content', path)
        break
      case 'start':
        if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 999999999)
          fail('invalid-content', path)
        break
      case 'language':
        if (value !== null && (typeof value !== 'string' || !/^[\w+-]*$/.test(value)))
          fail('invalid-content', path)
        break
      case 'checked':
        if (typeof value !== 'boolean') fail('invalid-content', path)
        break
      case 'src':
      case 'href':
        if (!isSafeTiptapUrl(value, key === 'src' ? 'image' : 'link')) fail('unsafe-content', path)
        break
      case 'alt':
      case 'title':
        if (value !== null && typeof value !== 'string') fail('invalid-content', path)
        break
      case 'colspan':
      case 'rowspan':
        if (value !== 1) fail('unsupported-content', path)
        break
      case 'colwidth':
        if (value !== null) fail('unsupported-content', path)
        break
      case 'align':
        if (value !== null && !['left', 'center', 'right'].includes(String(value)))
          fail('invalid-content', path)
        break
      default:
        fail('unsupported-content', `${path}.${key}`)
    }
  }
  // Empty strings and null have distinct exchange semantics for alt/title.
  return result
}
export function validateMarkdownTables(doc: Node): void {
  doc.descendants((table) => {
    if (table.type.name !== 'table') return
    const columns = table.firstChild?.childCount ?? 0
    if (!columns) fail('invalid-content')
    const aligns = Array.from(
      { length: columns },
      (_, col) => table.firstChild!.child(col).attrs.align,
    )
    table.forEach((row, _offset, index) => {
      if (row.childCount !== columns) fail('unsupported-content')
      row.forEach((cell, _cellOffset, col) => {
        if (
          cell.type.name !== (index ? 'tableCell' : 'tableHeader') ||
          cell.attrs.colspan !== 1 ||
          cell.attrs.rowspan !== 1 ||
          cell.attrs.colwidth !== null ||
          cell.attrs.align !== aligns[col] ||
          cell.childCount !== 1 ||
          cell.firstChild?.type.name !== 'paragraph'
        )
          fail('unsupported-content')
        cell.descendants((node) => {
          if (node.type.name === 'hardBreak' || node.type.name === 'table')
            fail('unsupported-content')
        })
      })
    })
  })
}

/** Unknown input keys must be rejected before ProseMirror silently drops them. */
export function validateMarkdownJSON(input: unknown, schema: Schema, trailing = true): JSONContent {
  const budget = new ContentBudget()
  const seen = new Set<object>()
  function visit(value: unknown, depth: number, path: string, mark = false): JSONContent {
    if (!mark) budget.visit(depth)
    if (!record(value) || seen.has(value) || typeof value.type !== 'string')
      return fail('invalid-content', path)
    seen.add(value)
    const spec = mark ? schema.marks[value.type] : schema.nodes[value.type]
    if (!spec) return fail('unsupported-content', path)
    for (const key of Object.keys(value))
      if (!(mark ? ['type', 'attrs'] : ['type', 'attrs', 'content', 'marks', 'text']).includes(key))
        fail('unsupported-content', `${path}.${key}`)
    const defaults = Object.fromEntries(
      Object.entries(spec.spec.attrs ?? {}).map(([key, attr]) => [key, attr.default]),
    )
    const attrs = attributes(value.type, value.attrs, defaults, `${path}.attrs`)
    const result: JSONContent = {
      type: value.type,
      ...(Object.keys(attrs).length ? { attrs } : {}),
    }
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
        if (new Set(result.marks.map((item) => item.type)).size !== result.marks.length)
          fail('invalid-content', path)
      }
    }
    seen.delete(value)
    return result
  }
  const json = visit(input, 0, 'doc')
  if (json.type !== 'doc') fail('invalid-content')
  json.content ??= []
  if (!json.content.length || (trailing && json.content.at(-1)?.type !== 'paragraph')) {
    budget.visit(1)
    json.content.push({ type: 'paragraph' })
  }
  checkBytes(JSON.stringify(json))
  try {
    const node = schema.nodeFromJSON(json)
    node.check()
    validateMarkdownTables(node)
    const normalized = node.toJSON()
    checkBytes(JSON.stringify(normalized))
    return normalized
  } catch (error) {
    if (error instanceof ContentFailure) throw error
    return fail('invalid-content')
  }
}

export function markdownKey(value: unknown): string {
  const stable = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(stable)
      : record(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, stable(item[key])]),
          )
        : item
  return JSON.stringify(stable(value))
}
