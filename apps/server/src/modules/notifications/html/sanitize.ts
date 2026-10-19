import { NotificationError } from '../errors.js'
import { classifyHref, isControlCodePoint, POLICY_VERSION } from './policy.js'
import {
  buildHtmlTree,
  DEFAULT_TREE_LIMITS,
  type ElementNode,
  type HtmlNode,
  type TreeLimits,
} from './tree.js'

/**
 * `notification-html-v1` 的规范化与序列化。
 *
 * 输入是不可信的发布内容，输出是不可变的安全 HTML 数据 + 由安全树派生的纯文本。
 * 策略是白名单，不是黑名单：
 *
 * - 主动内容与危险元素（`script`/`style`/`iframe`/`svg`/`form` 等）直接令发布失败；
 * - 元素上出现任何非白名单属性（含 `on*`、`style`、`class`、`id`、`name`、
 *   `data-*`、`aria-*`、`src`）同样令发布失败；正文不能携带它们；
 * - 不在白名单里的普通装饰标签**展开为安全子节点**，不静默丢正文；
 * - 链接只接受已核验的站内只读页面或已批准的外部 HTTPS 目标；
 * - 节点数与深度超限直接拒绝，避免渲染侧无限递归。
 *
 * 输出 HTML 由本模块自己序列化，不回显原始字节，也不保留任何原始属性。
 */

const FLOW = new Set([
  'p',
  'br',
  'h2',
  'h3',
  'strong',
  'em',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'hr',
  'a',
])
const TABLE = new Set(['table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td'])
const ALLOWED = new Set([...FLOW, ...TABLE])

/** 出现即失败：主动内容、内嵌资源、可执行组件、表单与文档级元素。 */
const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'noscript',
  'template',
  'slot',
  'svg',
  'math',
  'canvas',
  'img',
  'picture',
  'source',
  'audio',
  'video',
  'track',
  'map',
  'area',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'label',
  'fieldset',
  'legend',
  'output',
  'progress',
  'meter',
  'dialog',
  'portal',
  'base',
  'link',
  'meta',
  'title',
  'head',
  'body',
  'html',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'listing',
  'marquee',
  'blink',
  'font',
  'center',
  'big',
  'small',
  'tt',
  'strike',
  'u',
  'b',
  'i',
])

const VOID_ELEMENTS = new Set(['br', 'hr'])

/** 允许出现在指定父元素上下文中的元素。上下文不对时展开为子节点。 */
const CONTEXT: Record<string, Set<string>> = {
  '#root': new Set(['p', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'pre', 'hr', 'table']),
  p: new Set(['br', 'strong', 'em', 's', 'code', 'a']),
  h2: new Set(['br', 'strong', 'em', 's', 'code', 'a']),
  h3: new Set(['br', 'strong', 'em', 's', 'code', 'a']),
  li: new Set(['br', 'strong', 'em', 's', 'code', 'a', 'ul', 'ol']),
  blockquote: new Set(['p', 'br', 'strong', 'em', 's', 'code', 'a', 'ul', 'ol']),
  pre: new Set(['br', 'code']),
  ul: new Set(['li']),
  ol: new Set(['li']),
  a: new Set(['br', 'strong', 'em', 's', 'code']),
  strong: new Set(['br', 'em', 's', 'code', 'a']),
  em: new Set(['br', 'strong', 's', 'code', 'a']),
  s: new Set(['br', 'strong', 'em', 'code', 'a']),
  code: new Set(['br']),
  caption: new Set(['br', 'strong', 'em', 's', 'code', 'a']),
  table: new Set(['caption', 'thead', 'tbody', 'tr']),
  thead: new Set(['tr']),
  tbody: new Set(['tr']),
  tr: new Set(['th', 'td']),
  th: new Set(['br', 'strong', 'em', 's', 'code', 'a']),
  td: new Set(['br', 'strong', 'em', 's', 'code', 'a']),
}

/**
 * 任何元素（含最终会被展开的装饰标签）携带这些属性都令发布失败。
 * 正文不得携带事件处理器、样式或任何会加载/提交远端资源的属性。
 */
const DANGEROUS_ATTRIBUTE_NAMES = new Set([
  'style',
  'srcdoc',
  'src',
  'srcset',
  'formaction',
  'action',
  'background',
  'poster',
  'ping',
  'http-equiv',
  'content',
  'sandbox',
  'allow',
  'allowfullscreen',
  'xlink:href',
  'autofocus',
])

function hasDangerousAttribute(node: ElementNode): boolean {
  for (const name of Object.keys(node.attributes)) {
    if (name.startsWith('on')) return true
    if (DANGEROUS_ATTRIBUTE_NAMES.has(name)) return true
  }
  return false
}

const MAX_TABLE_ROWS = 20
const MAX_TABLE_COLUMNS = 6

export interface SanitizeResult {
  html: string
  text: string
  /** 被展开的普通装饰标签，供受控作者预览提示；不影响已发布结果。 */
  unwrappedTags: string[]
}

export interface SanitizeOptions extends Partial<TreeLimits> {
  maxHtmlBytes?: number
  maxTextCodePoints?: number
}

export interface SanitizeFailure {
  code: 'CONTENT_UNSAFE' | 'CONTENT_TOO_LARGE'
}

export type SanitizeOutcome =
  { ok: true; result: SanitizeResult } | { ok: false; failure: SanitizeFailure }

export function sanitizeNotificationHtml(
  input: string,
  options: SanitizeOptions = {},
): SanitizeOutcome {
  const maxHtmlBytes = options.maxHtmlBytes ?? 32 * 1024
  const maxTextCodePoints = options.maxTextCodePoints ?? 8000
  if (Buffer.byteLength(input, 'utf8') > maxHtmlBytes)
    return { ok: false, failure: { code: 'CONTENT_TOO_LARGE' } }

  let tree: HtmlNode[]
  try {
    tree = buildHtmlTree(input, {
      maxNodes: options.maxNodes ?? DEFAULT_TREE_LIMITS.maxNodes,
      maxDepth: options.maxDepth ?? DEFAULT_TREE_LIMITS.maxDepth,
    })
  } catch {
    // 分词/建树超限：按内容不安全拒绝，不回显原始输入。
    return { ok: false, failure: { code: 'CONTENT_UNSAFE' } }
  }

  const unwrapped = new Set<string>()
  const unsafe = (): SanitizeOutcome => ({ ok: false, failure: { code: 'CONTENT_UNSAFE' } })

  const headingBeforeTable = new Map<number, boolean>()
  markTableHeadings(tree, headingBeforeTable)

  let identity = 0
  const nextId = () => (identity += 1)

  const walk = (parentContext: string, nodes: HtmlNode[], depth: number): HtmlNode[] | null => {
    if (depth > (options.maxDepth ?? DEFAULT_TREE_LIMITS.maxDepth)) return null
    const output: HtmlNode[] = []
    for (const node of nodes) {
      if (node.type === 'text') {
        const value = normalizeText(node.value)
        if (value === null) return null
        if (value.length > 0) output.push({ type: 'text', value })
        continue
      }

      if (FORBIDDEN_ELEMENTS.has(node.name)) return null
      if (hasDangerousAttribute(node)) return null

      const permitted = CONTEXT[parentContext]
      if (!ALLOWED.has(node.name) || permitted === undefined || !permitted.has(node.name)) {
        // 普通装饰标签：展开为安全子节点，不能默默丢正文。
        unwrapped.add(node.name)
        const children = walk(parentContext, node.children, depth + 1)
        if (children === null) return null
        output.push(...children)
        continue
      }

      if (node.name === 'table') {
        const table = sanitizeTable(node, depth, nextId(), headingBeforeTable, walk)
        if (table === null) return null
        output.push(table)
        continue
      }

      const attributes: Record<string, string> = {}
      if (node.name === 'a') {
        const href = node.attributes.href
        if (href === undefined) return null
        const decision = classifyHref(href)
        if (decision.kind === 'rejected') return null
        attributes.href = decision.kind === 'internal' ? decision.path : decision.url
      } else if (node.name === 'th') {
        const scope = node.attributes.scope
        if (scope !== undefined) {
          if (scope !== 'row' && scope !== 'col') return null
          attributes.scope = scope
        }
      }
      for (const name of Object.keys(node.attributes)) {
        if (!((node.name === 'a' && name === 'href') || (node.name === 'th' && name === 'scope')))
          return null
      }

      const element: ElementNode = { type: 'element', name: node.name, attributes, children: [] }
      if (!VOID_ELEMENTS.has(node.name)) {
        const children = walk(node.name, node.children, depth + 1)
        if (children === null) return null
        element.children = children
        if (node.name === 'a' && isEmptyLink(element)) return null
      }
      output.push(element)
    }
    return output
  }

  const safeTree = walk('#root', tree, 1)
  if (safeTree === null) return unsafe()

  const html = serializeNodes(safeTree)
  if (Buffer.byteLength(html, 'utf8') > maxHtmlBytes)
    return { ok: false, failure: { code: 'CONTENT_TOO_LARGE' } }
  const text = deriveText(safeTree)
  // 至少要有非空可读文本：空正文或只剩被剥除脚本的输入不接受。
  if (text.trim().length === 0) return unsafe()
  if (Array.from(text).length > maxTextCodePoints)
    return { ok: false, failure: { code: 'CONTENT_TOO_LARGE' } }

  return { ok: true, result: { html, text, unwrappedTags: [...unwrapped].sort() } }
}

export function assertSafeNotificationHtml(
  input: string,
  options: SanitizeOptions = {},
): SanitizeResult {
  const outcome = sanitizeNotificationHtml(input, options)
  if (!outcome.ok) throw new NotificationError(outcome.failure.code)
  return outcome.result
}

export { POLICY_VERSION }

/** 单元格里不能出现块级或结构性内容：表格只承载文字。 */
const BLOCK_OR_STRUCTURE = new Set([
  'p',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'table',
  'caption',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])

/** 表格必须是纯文字单元格，且带 caption 或紧邻的语义标题。 */
function sanitizeTable(
  node: ElementNode,
  depth: number,
  tableId: number,
  headingBeforeTable: Map<number, boolean>,
  walk: (parent: string, nodes: HtmlNode[], depth: number) => HtmlNode[] | null,
): ElementNode | null {
  if (Object.keys(node.attributes).length > 0) return null
  if (
    !headingBeforeTable.get(tableId) &&
    !node.children.some((child) => child.type === 'element' && child.name === 'caption')
  ) {
    return null
  }

  // 在展开装饰标签**之前**按原始结构判定单元格：否则 `<td><ul><li>a</li></ul></td>`
  // 会先被展开成裸文本，从而绕过「表格仅文字单元格」。
  const rawRows = collectRows(node)
  if (rawRows.length === 0 || rawRows.length > MAX_TABLE_ROWS) return null
  for (const row of rawRows) {
    const cells = row.children.filter(
      (cell): cell is ElementNode =>
        cell.type === 'element' && (cell.name === 'th' || cell.name === 'td'),
    )
    if (cells.length > MAX_TABLE_COLUMNS) return null
    for (const cell of cells) {
      if (!rawCellIsTextOnly(cell)) return null
    }
  }

  const children = walk('table', node.children, depth + 1)
  if (children === null) return null

  const rows = collectRows({ type: 'element', name: 'table', attributes: {}, children })
  if (rows.length === 0 || rows.length > MAX_TABLE_ROWS) return null
  let columns = 0
  for (const row of rows) {
    const cells = row.children.filter((cell) => cell.type === 'element')
    columns = Math.max(columns, cells.length)
    if (cells.length > MAX_TABLE_COLUMNS) return null
  }
  if (columns === 0) return null
  return { type: 'element', name: 'table', attributes: {}, children }
}

/** 直接写在 `<table>` 下的 `<tr>` 与 thead/tbody 内的 `<tr>` 都算行。 */
function collectRows(table: ElementNode): ElementNode[] {
  const rows: ElementNode[] = []
  for (const child of table.children) {
    if (child.type !== 'element') continue
    if (child.name === 'tr') {
      rows.push(child)
      continue
    }
    if (child.name === 'thead' || child.name === 'tbody') {
      for (const row of child.children) {
        if (row.type === 'element' && row.name === 'tr') rows.push(row)
      }
    }
  }
  return rows
}

function rawCellIsTextOnly(node: ElementNode): boolean {
  for (const child of node.children) {
    if (child.type === 'text') continue
    if (BLOCK_OR_STRUCTURE.has(child.name)) return false
    if (!rawCellIsTextOnly(child)) return false
  }
  return true
}

function isEmptyLink(element: ElementNode): boolean {
  if (element.children.length === 0) return true
  return element.children.every((child) => child.type === 'text' && child.value.trim().length === 0)
}

function markTableHeadings(nodes: HtmlNode[], into: Map<number, boolean>): void {
  let tableIndex = 0
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!
    if (node.type === 'element' && node.name === 'table') {
      tableIndex += 1
      const previous = nodes[index - 1]
      into.set(
        tableIndex,
        previous !== undefined &&
          previous.type === 'element' &&
          (previous.name === 'h2' || previous.name === 'h3'),
      )
    }
  }
}

/** 文本只允许普通换行与 Tab；其余控制字符一律拒绝。 */
function normalizeText(value: string): string | null {
  let output = ''
  for (const char of value.replace(/\r\n?/g, '\n')) {
    const codePoint = char.codePointAt(0)!
    if (codePoint === 0x0a || codePoint === 0x09) {
      output += char
      continue
    }
    if (isControlCodePoint(codePoint)) return null
    output += char
  }
  return output
}

export function serializeNodes(nodes: HtmlNode[]): string {
  return nodes.map(serializeNode).join('')
}

function serializeNode(node: HtmlNode): string {
  if (node.type === 'text') return escapeText(node.value)
  const attributes = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
  if (VOID_ELEMENTS.has(node.name)) return `<${node.name}${attributes}>`
  return `<${node.name}${attributes}>${serializeNodes(node.children)}</${node.name}>`
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;')
}

/** 由安全树派生的可读纯文本：块级元素之间补换行，行内元素不补。 */
export function deriveText(nodes: HtmlNode[]): string {
  let output = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      output += node.value
      continue
    }
    if (node.name === 'br') {
      output += '\n'
      continue
    }
    output += deriveText(node.children)
    if (
      ['p', 'h2', 'h3', 'li', 'blockquote', 'pre', 'hr', 'tr', 'table', 'caption'].includes(
        node.name,
      )
    ) {
      output += '\n'
    }
  }
  return output
}

export function deriveSummary(text: string, maxCodePoints = 240): string {
  const collapsed = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
  const chars = Array.from(collapsed)
  if (chars.length <= maxCodePoints) return collapsed
  return `${chars.slice(0, maxCodePoints).join('')}…`
}
