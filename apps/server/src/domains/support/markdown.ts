import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { utf8Bytes } from '@workspace/common/feedback-content'

const FINAL_CONTENT_BYTES = 66560
export function finalMarkdown(userMarkdown: string, submissionId: string): string {
  const result = `${userMarkdown}\n\n---\n\nExWebsite 提交编号：${submissionId}`
  if (utf8Bytes(result) > FINAL_CONTENT_BYTES)
    throw new Error('Feedback content exceeds final byte limit')
  return result
}
const legacyParser = unified().use(remarkParse)
const gfmParser = unified().use(remarkParse).use(remarkGfm)
function isText(value: unknown): value is { type: 'text'; value: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'text' &&
    'value' in value &&
    typeof value.value === 'string'
  )
}
function automaticLinkText(value: object): string | undefined {
  const node = value as Record<string, unknown>
  if (
    node.type !== 'link' ||
    node.title != null ||
    typeof node.url !== 'string' ||
    !Array.isArray(node.children) ||
    !node.children.every(isText)
  )
    return undefined
  const label = node.children.map((child) => child.value).join('')
  if (
    label !== node.url ||
    !/^https?:\/\//i.test(label) ||
    /[\\\s\u0000-\u0020\u007f-\u009f]/.test(label)
  )
    return undefined
  try {
    const url = new URL(label)
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      url.hostname
    )
      return label
  } catch {
    /* Invalid URLs retain their link structure and fail the text comparison. */
  }
  return undefined
}
function canonical(value: unknown, remoteLinks = false): unknown {
  if (Array.isArray(value)) {
    const nodes: unknown[] = []
    for (const node of value.map((node) => canonical(node, remoteLinks))) {
      const previous = nodes[nodes.length - 1]
      if (isText(previous) && isText(node)) previous.value += node.value
      else nodes.push(node)
    }
    return nodes
  }
  if (value !== null && typeof value === 'object') {
    const linkText = remoteLinks ? automaticLinkText(value) : undefined
    if (linkText !== undefined) return { type: 'text', value: linkText }
    // ClickUp returns visible line breaks as soft newlines inside text. Keep
    // every newline while retaining all other inline and block node types.
    if ('type' in value && value.type === 'break') return { type: 'text', value: '\n' }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'position')
        .map(([key, field]) => [key, canonical(field, remoteLinks)]),
    )
  }
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : value
}
/** Accept visible newlines and exact remote URL autolinks; preserve other AST structure. */
export function equivalentMarkdown(expected: string, remote: string, format?: 'markdown'): boolean {
  if (utf8Bytes(remote) > FINAL_CONTENT_BYTES) return false
  const parser = format === 'markdown' ? gfmParser : legacyParser
  // GFM parses bare URLs as links on both sides. Legacy content was escaped
  // before submission and still needs ClickUp's remote-only autolink allowance.
  const remoteLinks = format !== 'markdown'
  return (
    JSON.stringify(canonical(parser.parse(expected))) ===
    JSON.stringify(canonical(parser.parse(remote), remoteLinks))
  )
}
