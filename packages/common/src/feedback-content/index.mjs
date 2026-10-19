import { toMarkdown } from 'mdast-util-to-markdown'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

export const FEEDBACK_LIMITS = Object.freeze({
  titleCodePoints: 200,
  userContentBytes: 65536,
  fileBytes: 20971520,
  files: 5,
  totalFileBytes: 104857600,
})
const BUG_TEXT_BYTES = 16384
const markdownParser = unified().use(remarkParse).use(remarkGfm)
const MAX_MARKDOWN_NODES = 4096
const MAX_MARKDOWN_DEPTH = 32
const FOOTER_PROBE = '\n\n---\n\nFeedback footer marker'
export const FREQUENCIES = Object.freeze({
  always: '每次',
  often: '经常',
  sometimes: '偶尔',
  once: '仅一次',
})
export const utf8Bytes = (value) => new TextEncoder().encode(value).length

/** AST text is serialized, never parsed as user-authored Markdown. */
export function escapePlainText(value) {
  const normalized = value.replace(/\r\n?/g, '\n')
  // Explicit hard breaks preserve each newline, including empty lines.
  const children = normalized
    .split('\n')
    .flatMap((line, index) => [
      ...(index ? [{ type: 'break' }] : []),
      { type: 'text', value: line },
    ])
  return toMarkdown({ type: 'root', children: [{ type: 'paragraph', children }] }).replace(
    /\n$/,
    '',
  )
}

function safeUrl(value, image) {
  if (/[\\\s\u0000-\u001f\u007f-\u009f]/.test(value)) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    if (
      image
        ? !['http:', 'https:'].includes(url.protocol)
        : !['http:', 'https:', 'mailto:'].includes(url.protocol)
    )
      return false
    return (
      !url.username &&
      !url.password &&
      (url.protocol === 'mailto:' ? Boolean(url.pathname) : Boolean(url.hostname))
    )
  } catch {
    return false
  }
}
function markdownReason(raw) {
  let tree
  try {
    tree = markdownParser.parse(raw)
  } catch {
    return 'invalid'
  }
  let nodes = 0
  let visible = false
  const stack = [{ node: tree, depth: 0 }]
  while (stack.length) {
    const { node, depth } = stack.pop()
    if (++nodes > MAX_MARKDOWN_NODES || depth > MAX_MARKDOWN_DEPTH) return 'invalid'
    if (
      node.type === 'html' ||
      node.type === 'footnoteDefinition' ||
      node.type === 'footnoteReference'
    )
      return 'invalid'
    if (
      (node.type === 'link' || node.type === 'image' || node.type === 'definition') &&
      !safeUrl(node.url, node.type === 'image')
    )
      return 'invalid'
    if (node.type === 'image') visible = true
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code')
      visible ||= Boolean(node.value?.trim())
    if (Array.isArray(node.children))
      for (let i = node.children.length - 1; i >= 0; i--)
        stack.push({ node: node.children[i], depth: depth + 1 })
  }
  // The server appends the submission-number paragraph after a thematic break.
  // Probe that exact block shape here so an open fence or container cannot
  // absorb the marker after a body that looked valid in isolation.
  const footer = markdownParser.parse(raw + FOOTER_PROBE).children
  const separator = footer.at(-2)
  const marker = footer.at(-1)
  if (
    separator?.type !== 'thematicBreak' ||
    separator.position?.start.offset !== raw.length + 2 ||
    marker?.type !== 'paragraph' ||
    marker.position?.start.offset !== raw.length + 7 ||
    marker.children.length !== 1 ||
    marker.children[0].type !== 'text' ||
    marker.children[0].value !== 'Feedback footer marker'
  )
    return 'invalid'
  return visible ? null : 'empty'
}
function analyze(raw, markdown, fieldLimit, format) {
  if (format === 'markdown') {
    if (utf8Bytes(raw) > fieldLimit || utf8Bytes(markdown) > FEEDBACK_LIMITS.userContentBytes)
      return { valid: false, markdown, reason: 'too_large' }
    const reason = markdownReason(raw)
    return { valid: reason === null, markdown, reason }
  }
  const reason = !raw.trim()
    ? 'empty'
    : utf8Bytes(raw) > fieldLimit || utf8Bytes(markdown) > FEEDBACK_LIMITS.userContentBytes
      ? 'too_large'
      : null
  return { valid: reason === null, markdown, reason }
}
export function analyzeRequest(text, format) {
  return analyze(
    text,
    format === 'markdown' ? text : escapePlainText(text),
    FEEDBACK_LIMITS.userContentBytes,
    format,
  )
}
export function composeBug(details, format) {
  const sections = [
    ['问题描述', details.description],
    ['复现步骤', details.reproductionSteps],
    ['预期结果', details.expectedResult],
    ['实际结果', details.actualResult],
    ['发生频率', details.frequency === null ? null : FREQUENCIES[details.frequency]],
  ]
  const included = sections.filter(([, value]) => value?.trim())
  const chunks = included.map(
    ([label, value]) => `## ${label}\n\n${format === 'markdown' ? value : escapePlainText(value)}`,
  )
  const markdown = chunks.join('\n\n')
  const oversized = sections.some(
    ([, value]) => value !== null && utf8Bytes(value) > BUG_TEXT_BYTES,
  )
  const result = analyze(details.description, markdown, BUG_TEXT_BYTES, format)
  if (format === 'markdown' && !oversized) {
    for (const [, value] of included) {
      const reason = markdownReason(value)
      if (reason !== null) return { ...result, valid: false, reason }
    }
    const headings = markdownParser
      .parse(markdown)
      .children.filter((node) => node.type === 'heading' && node.depth === 2)
    let offset = 0
    for (const [index, [label]] of included.entries()) {
      if (
        !headings.some(
          (node) =>
            node.position?.start.offset === offset &&
            node.children.map((child) => child.value).join('') === label,
        )
      )
        return { ...result, valid: false, reason: 'invalid' }
      offset += chunks[index].length + 2
    }
  }
  return oversized ? { ...result, valid: false, reason: 'too_large' } : result
}
export function normalizeMime(value) {
  return value.length <= 127 && /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(value)
    ? value.toLowerCase()
    : 'application/octet-stream'
}
