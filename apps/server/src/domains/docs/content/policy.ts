import { DocsError } from '../errors.js'

/** 内容失败只使用这四个 Docs 错误码，由内容层的 `fail` 统一抛出。 */
export type DocsContentErrorCode =
  | 'DOCS_INVALID_CONTENT'
  | 'DOCS_UNSUPPORTED_CONTENT'
  | 'DOCS_UNSAFE_CONTENT'
  | 'DOCS_LIMIT_EXCEEDED'

/**
 * Docs profile 1 的内容预算与有限值域规则。
 *
 * 这些规则在 Server 领域内显式维护：自研 Admonition、heading 1–4、对齐与跨度等
 * 值域不由上游 Schema 的默认值提供，也不从组件包运行时 import。
 * 预算数值与内容附录第 5 节一致；`bytes` 是解码后 JSON 的紧凑 UTF-8 表示，
 * 不是 JS 字符数、HTTP Content-Length 或 PostgreSQL jsonb 的物理大小。
 */
export const DOCS_CONTENT_LIMITS = {
  bytes: 8 * 1024 * 1024,
  nodes: 10_000,
  depth: 32,
  /** JSON 容器最大嵌套；给 32 层内容的对象/数组与属性结构留足空间。 */
  jsonDepth: 96,
  marksPerNode: 8,
  gridPerTable: 10_000,
  /** 整篇所有表累计的虚拟网格上界，是 Docs 相对浏览器校验额外增加的资源边界。 */
  cumulativeGrid: 10_000,
  span: 10_000,
  dimension: 8192,
  fontSizeRem: { min: 0.75, max: 3 },
} as const

export const ADMONITION_TYPES = ['tip', 'info', 'warning', 'error'] as const
export type AdmonitionType = (typeof ADMONITION_TYPES)[number]

export const ORDERED_LIST_TYPES = ['1', 'a', 'A', 'i', 'I'] as const
export const TEXT_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const
export const CELL_ALIGNMENTS = ['left', 'center', 'right'] as const

export function fail(code: DocsContentErrorCode): never {
  throw new DocsError(code)
}

/**
 * PostgreSQL 的 `jsonb` 不能保存 NUL 与未配对 surrogate。
 * 对所有字符串显式拒绝，不以 replacement character 静默替换。
 */
export function assertStorableText(value: string): void {
  if (value.includes('\u0000')) fail('DOCS_INVALID_CONTENT')
  // 未配对 UTF-16 surrogate 会让 `encodeURIComponent` 抛出 URIError。
  try {
    encodeURIComponent(value)
  } catch {
    fail('DOCS_INVALID_CONTENT')
  }
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/

/** 只接受 `#rgb/#rgba/#rrggbb/#rrggbbaa`，统一小写并展开短格式。 */
export function normalizeColor(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') fail('DOCS_INVALID_CONTENT')
  const input = value.trim().toLowerCase()
  if (!HEX_COLOR.test(input)) fail('DOCS_UNSAFE_CONTENT')
  if (/^#[0-9a-f]{3,4}$/.test(input))
    return `#${input
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')}`
  return input
}

/** 只接受 px/rem，转换为 0.75–3 rem 的有限数值。 */
export function normalizeFontSize(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') fail('DOCS_INVALID_CONTENT')
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(rem|px)$/i)
  if (!match) fail('DOCS_UNSAFE_CONTENT')
  const size = Number(match[1]) / (match[2]!.toLowerCase() === 'px' ? 16 : 1)
  if (size < DOCS_CONTENT_LIMITS.fontSizeRem.min || size > DOCS_CONTENT_LIMITS.fontSizeRem.max)
    fail('DOCS_INVALID_CONTENT')
  return `${size}rem`
}

/** 控制字符、空格、DEL 与反斜杠；协议相对地址另行拒绝。 */
const URL_FORBIDDEN = /[\u0000-\u0020\u007f\\]/

/**
 * profile 1 的有限 URL 策略：拒绝控制字符、空格、反斜杠、协议相对 `//` 与含凭据的地址；
 * 允许单个 `/` 开头的站内相对地址，或无用户名/密码的绝对 HTTP(S)。
 * Link 另允许有目标的 mailto；Image 不允许 mailto。全部 Data URL 一律关闭。
 */
export function isSafeDocsUrl(value: unknown, kind: 'link' | 'image'): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  if (URL_FORBIDDEN.test(value)) return false
  if (value.startsWith('//')) return false
  if (value.startsWith('/')) return true
  try {
    const url = new URL(value)
    if (url.username || url.password) return false
    if (url.protocol === 'http:' || url.protocol === 'https:') return true
    return kind === 'link' && url.protocol === 'mailto:' && url.pathname.length > 0
  } catch {
    return false
  }
}

const REL_TOKENS = ['noopener', 'noreferrer', 'nofollow'] as const

/** `_blank` 必须补入 noopener/noreferrer，去重并固定字典序。 */
export function normalizeLinkRel(value: unknown, target: unknown): string | null {
  if (value !== null && typeof value !== 'string') fail('DOCS_INVALID_CONTENT')
  const tokens = typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : []
  if (tokens.some((token) => !REL_TOKENS.includes(token as (typeof REL_TOKENS)[number])))
    fail('DOCS_UNSAFE_CONTENT')
  if (target === '_blank') tokens.push('noopener', 'noreferrer')
  return [...new Set(tokens)].sort().join(' ') || null
}

export function checkBytes(value: string): void {
  if (Buffer.byteLength(value, 'utf8') > DOCS_CONTENT_LIMITS.bytes) fail('DOCS_LIMIT_EXCEEDED')
}

/** codeBlock 语言：可为空串，只允许 ASCII 字母、数字、下划线、加号与连字符。 */
export function isSafeLanguage(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Za-z0-9_+\-]*$/.test(value)
}
