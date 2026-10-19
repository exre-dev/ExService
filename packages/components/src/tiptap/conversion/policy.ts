import type { TiptapContentPolicy, TiptapIssue, TiptapIssueCode } from '../types'

export const TIPTAP_LIMITS = {
  bytes: 8 * 1024 * 1024,
  nodes: 10_000,
  depth: 32,
  imageBytes: 2 * 1024 * 1024,
  mentions: 20,
} as const
export const ADMONITION_TYPES = ['tip', 'info', 'warning', 'error'] as const
export type AdmonitionType = (typeof ADMONITION_TYPES)[number]
export const ADMONITION_TITLES: Record<AdmonitionType, string> = {
  tip: '提示',
  info: '信息',
  warning: '警告',
  error: '危险',
}
export class ContentFailure extends Error {
  readonly issue: TiptapIssue
  constructor(code: TiptapIssueCode, path?: string) {
    super(code)
    this.issue = {
      code,
      message: {
        'not-ready': '编辑器尚未准备就绪。',
        'invalid-content': '文档结构或属性无效。',
        'unsupported-content': '内容包含不支持的结构。',
        'unsafe-content': '内容包含不允许的地址或 HTML。',
        'limit-exceeded': '内容超出允许的大小或复杂度。',
        'conversion-failed': '内容无法完整转换。',
        'upload-failed': '图片上传失败。',
        'mention-failed': '提及查询失败。',
        'normalized-content': '内容已按 Markdown 规范统一。',
        'downgraded-content': '已保留支持的内容并简化不兼容格式。',
      }[code],
      ...(path ? { path } : {}),
    }
  }
}
export const fail = (code: TiptapIssueCode, path?: string): never => {
  throw new ContentFailure(code, path)
}
export const notice = (path?: string): TiptapIssue => ({
  code: 'invalid-content',
  message: '内容已按文档规范统一。',
  ...(path ? { path } : {}),
})
export function checkBytes(value: string): void {
  if (new TextEncoder().encode(value).length > TIPTAP_LIMITS.bytes) fail('limit-exceeded')
}
export class ContentBudget {
  private count = 0
  visit(depth: number): void {
    if (++this.count > TIPTAP_LIMITS.nodes || depth > TIPTAP_LIMITS.depth) fail('limit-exceeded')
  }
}
export function normalizeColor(value: unknown, html = false): string | null {
  if (value === null || (html && value === '')) return null
  if (typeof value !== 'string') return fail('invalid-content')
  const input = value.trim().toLowerCase()
  if (/^#[\da-f]{3,4}$/.test(input))
    return (
      '#' +
      input
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    )
  if (/^#(?:[\da-f]{6}|[\da-f]{8})$/.test(input)) return input
  const rgb =
    html &&
    input.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/,
    )
  if (rgb && rgb.slice(1, 4).every((n) => Number(n) <= 255))
    return (
      '#' +
      rgb
        .slice(1, 4)
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('') +
      (rgb[4] === undefined || Number(rgb[4]) === 1
        ? ''
        : Math.round(Number(rgb[4]) * 255)
            .toString(16)
            .padStart(2, '0'))
    )
  return fail('unsafe-content')
}
export function normalizeFontSize(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') return fail('invalid-content')
  const m = value.trim().match(/^(\d+(?:\.\d+)?)(rem|px)$/i)
  if (!m) return fail('unsafe-content')
  const size = Number(m[1]) / (m[2]!.toLowerCase() === 'px' ? 16 : 1)
  if (size < 0.75 || size > 3) return fail('invalid-content')
  return `${size}rem`
}
export function isSafeTiptapUrl(
  value: unknown,
  kind: 'link' | 'image',
  policy: TiptapContentPolicy = {},
): value is string {
  if (typeof value !== 'string' || value.length === 0 || /[\u0000-\u0020\u007f\\]/.test(value))
    return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  if (kind === 'image' && value.startsWith('data:')) {
    if (!policy.allowRasterDataImages) return false
    const m = value.match(/^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/)
    if (!m || m[2]!.length % 4 !== 0) return false
    let bytes: string
    try {
      bytes = atob(m[2]!)
    } catch {
      return false
    }
    if (bytes.length > TIPTAP_LIMITS.imageBytes) return false
    const starts = (...codes: number[]) => codes.every((c, i) => bytes.charCodeAt(i) === c)
    return m[1] === 'png'
      ? starts(137, 80, 78, 71, 13, 10, 26, 10)
      : m[1] === 'jpeg'
        ? starts(255, 216, 255)
        : m[1] === 'gif'
          ? /^GIF8[79]a/.test(bytes)
          : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'
  }
  try {
    const url = new URL(value)
    return (
      !url.username &&
      !url.password &&
      (url.protocol === 'http:' ||
        url.protocol === 'https:' ||
        (kind === 'link' && url.protocol === 'mailto:' && !!url.pathname))
    )
  } catch {
    return false
  }
}
export function normalizeLinkRel(value: unknown, target: unknown): string | null {
  if (value !== null && typeof value !== 'string') return fail('invalid-content')
  const tokens = typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : []
  if (tokens.some((token) => !['noopener', 'noreferrer', 'nofollow'].includes(token)))
    return fail('unsafe-content')
  if (target === '_blank') tokens.push('noopener', 'noreferrer')
  return [...new Set(tokens)].sort().join(' ') || null
}
