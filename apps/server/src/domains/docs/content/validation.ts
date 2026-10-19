import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { docsSchema } from './schema.js'
import { createGridBudget, validateTableGrid } from './table-grid.js'
import {
  ADMONITION_TYPES,
  CELL_ALIGNMENTS,
  DOCS_CONTENT_LIMITS,
  ORDERED_LIST_TYPES,
  TEXT_ALIGNMENTS,
  assertStorableText,
  checkBytes,
  fail,
  isSafeDocsUrl,
  isSafeLanguage,
  normalizeColor,
  normalizeFontSize,
  normalizeLinkRel,
} from './policy.js'

export interface DocsMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface DocsContentNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocsContentNode[]
  marks?: DocsMark[]
  text?: string
}

export interface DocsDocument {
  type: 'doc'
  content: DocsContentNode[]
}

export interface NormalizedDocsContent {
  /** 规范化后的完整正文快照；Server 保存并返回同一份。 */
  content: DocsDocument
  /** 派生文本投影，最多 8 MiB UTF-8；不是正文的事实来源。 */
  textContent: string
}

const NODE_KEYS = ['type', 'attrs', 'content', 'marks', 'text']
const MARK_KEYS = ['type', 'attrs']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value) as unknown
  return prototype === Object.prototype || prototype === null
}

/**
 * 迭代预检 JSON 容器：在任何递归处理之前限制嵌套、拒绝循环引用与非 JSON 值。
 *
 * 不能直接对未经检查的深对象调用递归 `JSON.stringify`：循环引用会先抛错，
 * 而深层嵌套可能压爆调用栈。
 */
export function assertJsonShape(value: unknown): void {
  const stack: Set<object> = new Set()
  const walk = (current: unknown, depth: number): void => {
    if (depth > DOCS_CONTENT_LIMITS.jsonDepth) fail('DOCS_LIMIT_EXCEEDED')
    if (Array.isArray(current)) {
      stack.add(current)
      for (const entry of current) walk(entry, depth + 1)
      stack.delete(current)
      return
    }
    if (isPlainObject(current)) {
      if (stack.has(current)) fail('DOCS_INVALID_CONTENT')
      stack.add(current)
      for (const entry of Object.values(current)) walk(entry, depth + 1)
      stack.delete(current)
      return
    }
    if (typeof current === 'string') {
      assertStorableText(current)
      return
    }
    if (typeof current === 'number' || typeof current === 'boolean' || current === null) return
    fail('DOCS_INVALID_CONTENT')
  }
  walk(value, 0)
}

/**
 * 在默认递归 AJV 之前识别未知节点、Mark 与属性。
 *
 * Contract 的递归 union 也会拒绝这些内容，但那会给出通用的 400 `BAD_REQUEST`；
 * 内容附录第 6 节要求未知节点/属性明确报 `DOCS_UNSUPPORTED_CONTENT`。
 * 这里只做有界的形状识别，不做完整规范化，成功时不做任何断言。
 */
export function assertKnownContentShape(value: unknown): void {
  const walk = (current: unknown, isMark: boolean, depth: number): void => {
    if (depth > DOCS_CONTENT_LIMITS.depth) fail('DOCS_LIMIT_EXCEEDED')
    if (Array.isArray(current)) {
      for (const entry of current) walk(entry, isMark, depth + 1)
      return
    }
    if (!isPlainObject(current)) return
    const type = current.type
    if (typeof type !== 'string') return
    const spec = (isMark ? docsSchema.marks[type] : docsSchema.nodes[type]) as
      { spec: { attrs?: object } } | undefined
    if (!spec) fail('DOCS_UNSUPPORTED_CONTENT')
    if (current.attrs !== undefined) {
      if (!isPlainObject(current.attrs)) fail('DOCS_INVALID_CONTENT')
      const allowed = new Set(Object.keys(spec.spec.attrs ?? {}))
      for (const key of Object.keys(current.attrs))
        if (!allowed.has(key)) fail('DOCS_UNSUPPORTED_CONTENT')
    }
    if (current.content !== undefined) {
      if (!Array.isArray(current.content)) fail('DOCS_INVALID_CONTENT')
      for (const child of current.content) walk(child, false, depth + 1)
    }
    if (current.marks !== undefined) {
      if (!Array.isArray(current.marks)) fail('DOCS_INVALID_CONTENT')
      for (const child of current.marks) walk(child, true, depth + 1)
    }
  }
  walk(value, false, 0)
}

class Budget {
  private count = 0

  visit(depth: number): void {
    this.count += 1
    if (this.count > DOCS_CONTENT_LIMITS.nodes || depth > DOCS_CONTENT_LIMITS.depth)
      fail('DOCS_LIMIT_EXCEEDED')
  }
}

function normalizeAttrs(
  type: string,
  provided: unknown,
  defaults: Record<string, unknown>,
  allowedKeys: readonly string[],
): Record<string, unknown> | undefined {
  if (provided !== undefined && !isPlainObject(provided)) fail('DOCS_INVALID_CONTENT')
  // 没有声明任何属性的节点（doc、text、hardBreak…）出现显式 attrs 就是未知字段，
  // 不能因为对象为空就当作规范化后丢弃。
  if (provided !== undefined && allowedKeys.length === 0) fail('DOCS_UNSUPPORTED_CONTENT')
  const attrs: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(provided ?? {})) {
    if (!allowedKeys.includes(key)) fail('DOCS_UNSUPPORTED_CONTENT')
    attrs[key] = value
  }
  // 按 schema 默认顺序定值：`colspan` 先于 `colwidth`，`target` 先于 `rel`。
  for (const key of Object.keys(attrs)) {
    let normalized = attrs[key]
    switch (key) {
      case 'align':
        if (normalized !== null && !CELL_ALIGNMENTS.includes(normalized as never))
          fail('DOCS_INVALID_CONTENT')
        break
      case 'colspan':
      case 'rowspan':
        if (
          !Number.isSafeInteger(normalized) ||
          (normalized as number) < 1 ||
          (normalized as number) > DOCS_CONTENT_LIMITS.span
        ) {
          fail('DOCS_INVALID_CONTENT')
        }
        break
      case 'colwidth':
        if (normalized !== null) {
          if (!Array.isArray(normalized) || normalized.length !== attrs.colspan)
            fail('DOCS_INVALID_CONTENT')
          if (
            normalized.some(
              (width) =>
                !Number.isInteger(width) ||
                (width as number) < 0 ||
                (width as number) > DOCS_CONTENT_LIMITS.dimension,
            )
          ) {
            fail('DOCS_INVALID_CONTENT')
          }
        }
        break
      case 'textAlign':
        if (normalized !== null && !TEXT_ALIGNMENTS.includes(normalized as never))
          fail('DOCS_INVALID_CONTENT')
        break
      case 'level':
        // heading level 5 也能通过 ProseMirror schema，只能由值域层按 profile 1 拒绝。
        if (
          !Number.isInteger(normalized) ||
          (normalized as number) < 1 ||
          (normalized as number) > 4
        )
          fail('DOCS_INVALID_CONTENT')
        break
      case 'start':
        if (!Number.isSafeInteger(normalized) || (normalized as number) < 1)
          fail('DOCS_INVALID_CONTENT')
        break
      case 'type':
        if (type === 'admonition') {
          if (!ADMONITION_TYPES.includes(normalized as never)) fail('DOCS_INVALID_CONTENT')
        } else if (
          normalized !== null &&
          (typeof normalized !== 'string' || !ORDERED_LIST_TYPES.includes(normalized as never))
        ) {
          fail('DOCS_INVALID_CONTENT')
        }
        break
      case 'open':
      case 'checked':
        if (typeof normalized !== 'boolean') fail('DOCS_INVALID_CONTENT')
        break
      case 'src':
        if (!isSafeDocsUrl(normalized, 'image')) fail('DOCS_UNSAFE_CONTENT')
        break
      case 'href':
        if (!isSafeDocsUrl(normalized, 'link')) fail('DOCS_UNSAFE_CONTENT')
        break
      case 'width':
      case 'height':
        if (
          normalized !== null &&
          (!Number.isInteger(normalized) ||
            (normalized as number) < 1 ||
            (normalized as number) > DOCS_CONTENT_LIMITS.dimension)
        ) {
          fail('DOCS_INVALID_CONTENT')
        }
        break
      case 'alt':
      case 'title':
      case 'label':
        if (normalized !== null && typeof normalized !== 'string') fail('DOCS_INVALID_CONTENT')
        if (typeof normalized === 'string') assertStorableText(normalized)
        if (type === 'image' && normalized === '') normalized = null
        break
      case 'id':
        if (typeof normalized !== 'string' || !normalized.trim()) fail('DOCS_INVALID_CONTENT')
        assertStorableText(normalized as string)
        break
      case 'mentionSuggestionChar':
        if (normalized !== '@') fail('DOCS_INVALID_CONTENT')
        break
      case 'color':
      case 'backgroundColor':
        normalized = normalizeColor(normalized)
        break
      case 'fontSize':
        normalized = normalizeFontSize(normalized)
        break
      case 'target':
        if (normalized !== null && normalized !== '_self' && normalized !== '_blank')
          fail('DOCS_UNSAFE_CONTENT')
        break
      case 'rel':
        normalized = normalizeLinkRel(normalized, attrs.target)
        break
      case 'class':
        if (normalized !== null) fail('DOCS_UNSAFE_CONTENT')
        break
      case 'language':
        if (normalized !== null && !isSafeLanguage(normalized)) fail('DOCS_INVALID_CONTENT')
        break
      default:
        fail('DOCS_UNSUPPORTED_CONTENT')
    }
    attrs[key] = normalized
  }
  return Object.keys(attrs).length ? attrs : undefined
}

/** 重复 Mark、互斥组合都明确拒绝，不靠合并或丢弃修复。 */
function assertMarksUsable(marks: readonly DocsMark[]): void {
  const seen = new Set<string>()
  for (const mark of marks) {
    if (seen.has(mark.type)) fail('DOCS_INVALID_CONTENT')
    seen.add(mark.type)
  }
  if (seen.has('code') && seen.size > 1) fail('DOCS_INVALID_CONTENT')
}

function normalizeNode(
  value: unknown,
  budget: Budget,
  depth: number,
  isMark = false,
): DocsContentNode | DocsMark {
  if (!isMark) budget.visit(depth)
  if (!isPlainObject(value)) fail('DOCS_INVALID_CONTENT')
  if (typeof value.type !== 'string') fail('DOCS_INVALID_CONTENT')
  const spec = (isMark ? docsSchema.marks[value.type] : docsSchema.nodes[value.type]) as
    { spec: { attrs?: Record<string, unknown> } } | undefined
  if (!spec) fail('DOCS_UNSUPPORTED_CONTENT')
  const allowed = isMark ? MARK_KEYS : NODE_KEYS
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('DOCS_UNSUPPORTED_CONTENT')

  const defaults = Object.fromEntries(
    Object.entries((spec.spec.attrs ?? {}) as Record<string, { default?: unknown }>).map(
      ([key, attr]) => [key, attr.default ?? null],
    ),
  )
  const attrs = normalizeAttrs(value.type, value.attrs, defaults, Object.keys(defaults))
  const result: DocsContentNode = { type: value.type }
  if (attrs !== undefined) result.attrs = attrs

  if (isMark) return result

  if (value.type === 'text') {
    if (typeof value.text !== 'string' || value.text.length === 0) fail('DOCS_INVALID_CONTENT')
    if (value.content !== undefined || value.attrs !== undefined) fail('DOCS_INVALID_CONTENT')
    result.text = value.text
  } else if (value.text !== undefined) {
    fail('DOCS_INVALID_CONTENT')
  }

  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) fail('DOCS_INVALID_CONTENT')
    result.content = value.content.map(
      (child) => normalizeNode(child, budget, depth + 1) as DocsContentNode,
    )
  }
  if (value.marks !== undefined) {
    if (!Array.isArray(value.marks) || value.marks.length > DOCS_CONTENT_LIMITS.marksPerNode)
      fail('DOCS_INVALID_CONTENT')
    const marks = value.marks.map(
      (child) => normalizeNode(child, budget, depth + 1, true) as DocsMark,
    )
    assertMarksUsable(marks)
    result.marks = marks
  }
  return result
}

/** 每个文本叶只取一次；Mention 取 label（无 label 用 id），图片只取 alt。 */
function projectNode(node: ProseMirrorNode, out: string[]): void {
  const name = node.type.name
  if (node.isText) {
    out.push(node.text ?? '')
    return
  }
  if (name === 'hardBreak') {
    out.push('\n')
    return
  }
  if (name === 'mention') {
    const label = node.attrs.label
    out.push(typeof label === 'string' && label.length > 0 ? label : String(node.attrs.id ?? ''))
    return
  }
  if (name === 'image') {
    const alt = node.attrs.alt
    if (typeof alt === 'string') out.push(alt)
    out.push('\n')
    return
  }
  node.forEach((child) => projectNode(child, out))
  // 块与换行边界各用有界分隔符；不展开表格跨度，不重复祖先文本。
  if (node.isTextblock || name === 'horizontalRule') out.push('\n')
}

function projectText(node: ProseMirrorNode): string {
  const parts: string[] = []
  projectNode(node, parts)
  const text = parts.join('')
  if (Buffer.byteLength(text, 'utf8') > DOCS_CONTENT_LIMITS.bytes) fail('DOCS_LIMIT_EXCEEDED')
  return text
}

/**
 * Docs profile 1 的完整校验与规范化入口。
 *
 * 顺序不能颠倒：先迭代预检 JSON 容器，再逐节点拒绝未知字段与错误值域，
 * 然后在独立快照上补默认值与有限规范化，接着交给纯 ProseMirror 做语法与网格检查，
 * 最后重新核对预算并提取投影。失败一律抛出固定 DocsError，不保存部分结果。
 */
export function validateDocsContent(input: unknown): NormalizedDocsContent {
  assertJsonShape(input)
  const budget = new Budget()
  const root = normalizeNode(input, budget, 0)
  if (root.type !== 'doc') fail('DOCS_INVALID_CONTENT')
  if ('attrs' in root || 'marks' in root || 'text' in root) fail('DOCS_INVALID_CONTENT')
  const document = root as DocsDocument
  document.content ??= []
  checkBytes(JSON.stringify(document))
  // 空 doc 与末尾不是 paragraph 都规范化：至少一个 paragraph。
  if (
    document.content.length === 0 ||
    document.content[document.content.length - 1]!.type !== 'paragraph'
  ) {
    budget.visit(1)
    document.content.push({ type: 'paragraph', attrs: { textAlign: null } })
  }
  checkBytes(JSON.stringify(document))

  let node: ProseMirrorNode
  try {
    node = docsSchema.nodeFromJSON(document)
    node.check()
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    )
      throw error
    fail('DOCS_INVALID_CONTENT')
  }
  const grid = createGridBudget()
  node.descendants((child) => {
    if (child.type.name === 'table') validateTableGrid(child, grid)
    return true
  })

  const content = node.toJSON() as DocsDocument
  checkBytes(JSON.stringify(content))
  return { content, textContent: projectText(node) }
}

/**
 * 读取数据库内容时复核同一 profile。
 *
 * 存量 profile 1 内容真实损坏时返回固定 500，不能在 GET 静默修补或回写。
 */
export function assertStoredDocsContent(value: unknown): void {
  validateDocsContent(value)
}
