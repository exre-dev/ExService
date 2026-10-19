import {
  decodeHtmlEntities,
  flattenExtensions,
  InputRule,
  type AnyExtension,
  type JSONContent,
  type MarkdownToken,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { isSafeTiptapUrl } from '../conversion/policy'
import { validateMarkdownJSON } from './validate'
import { ContentHistory } from '../history'
import { createMarkdownGuard } from './guard'
import type { MarkdownExtensionOptions } from './types'

const unescape = (text: string) =>
  decodeHtmlEntities(text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1'))
const literal = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]~]/g, '\\$&')
const destination = (url: string) =>
  `<${url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}>`
const title = (value: string | null | undefined) =>
  value == null
    ? ''
    : ` "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`

/** Encode only a paragraph's inline rendering, never list indentation or code. */
function paragraphText(rendered: string, leading = true, trailing = true): string {
  return rendered
    .replace(/\t/g, '&#9;')
    .replace(/(^|\n)( +)/g, (match, boundary: string, spaces: string) =>
      boundary || leading ? boundary + '&#32;'.repeat(spaces.length) : match,
    )
    .replace(/ +(\n|$)/g, (match, boundary: string) =>
      boundary || trailing ? '&#32;'.repeat(match.length - boundary.length) + boundary : match,
    )
    .replace(/(^|\n)(?=[#>+\-])/g, '$1\\')
    .replace(/(^|\n)(\d+)([.)])(?=\s)/g, '$1$2\\$3')
}
function codeSpan(text: string): string {
  const fence = '`'.repeat(
    Math.max(1, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)),
  )
  const padding =
    text.startsWith('`') || text.endsWith('`') || (/^ .* $/.test(text) && !/^ +$/.test(text))
      ? ' '
      : ''
  return `${fence}${padding}${text}${padding}${fence}`
}
interface InlineBoundary {
  before: string
  after: string
}
const firstCharacter = (value: string) => (value ? String.fromCodePoint(value.codePointAt(0)!) : '')
const lastCharacter = (value: string) => {
  const start =
    value.length >= 2 &&
    /[\uDC00-\uDFFF]/.test(value.at(-1)!) &&
    /[\uD800-\uDBFF]/.test(value.at(-2)!)
      ? value.length - 2
      : value.length - 1
  return start >= 0 ? value.slice(start) : ''
}
const punctuationOrSpace = (value: string) =>
  !value || /[\s\p{P}\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/u.test(value)

function renderInline(
  nodes: JSONContent[],
  helpers: MarkdownRendererHelpers,
  boundary: InlineBoundary = { before: '', after: '' },
): string {
  let output = ''
  const identity = (mark: NonNullable<JSONContent['marks']>[number]) =>
    JSON.stringify([mark.type, mark.attrs ?? {}])
  const same = (
    a: NonNullable<JSONContent['marks']>[number],
    b: NonNullable<JSONContent['marks']>[number],
  ) => identity(a) === identity(b)
  const priority: Record<string, number> = { link: 5, bold: 4, italic: 3, strike: 2, code: 1 }
  const ends: Map<string, number>[] = new Array(nodes.length)
  for (let index = nodes.length - 1; index >= 0; index--) {
    ends[index] = new Map(
      (nodes[index]!.marks ?? []).map((mark) => [
        identity(mark),
        ends[index + 1]?.get(identity(mark)) ?? index + 1,
      ]),
    )
  }
  for (let index = 0; index < nodes.length;) {
    const node = nodes[index]!
    if (!node.marks?.length) {
      const rendered = helpers.renderChildren([node])
      output +=
        node.type === 'text'
          ? paragraphText(rendered, index === 0, index === nodes.length - 1)
          : rendered
      index++
      continue
    }
    // Prefer the mark continuing farthest as the outer wrapper. Closing and
    // reopening an earlier mark converts crossed ranges to nested GFM ranges.
    const runs = node.marks
      .map((mark) => ({ mark, end: ends[index]!.get(identity(mark))! }))
      .sort((a, b) => b.end - a.end || (priority[b.mark.type] ?? 0) - (priority[a.mark.type] ?? 0))
    const mark = runs[0]!.mark
    let end = runs[0]!.end
    for (let boundary = index + 1; boundary < end; boundary++) {
      const crossing = nodes[boundary]!.marks?.some((candidate) => {
        if (same(candidate, mark)) return false
        return ends[boundary]!.get(identity(candidate))! > end
      })
      if (crossing) {
        end = boundary
        break
      }
    }
    const children = nodes
      .slice(index, end)
      .map((child) => ({ ...child, marks: child.marks?.filter((next) => !same(mark, next)) }))
    if (mark.type === 'code') output += codeSpan(children.map((child) => child.text ?? '').join(''))
    else {
      // Use the installed extension's public rendering hook for each wrapper,
      // with an opaque placeholder rather than MarkdownManager private methods.
      const placeholder = '\uE000EXREMARKCONTENT\uE001'
      let template = helpers.renderChildren([{ type: 'text', text: placeholder, marks: [mark] }])
      const next = nodes[end]
      const before = output ? lastCharacter(output) : boundary.before
      const after = next
        ? next.marks?.length
          ? ''
          : firstCharacter(next.text ?? '')
        : boundary.after
      if (mark.type === 'italic') {
        // GFM flanking uses whitespace and punctuation, including ASCII symbol
        // punctuation, not merely letters/numbers. Combining marks and Emoji
        // can also be non-punctuation neighbors. Keep the outer real boundary
        // when this italic run is nested inside another mark's delimiters.
        if (!punctuationOrSpace(before) || !punctuationOrSpace(after))
          template = '*' + template.slice(1, -1) + '*'
      }
      output += template.replace(placeholder, () =>
        renderInline(children, helpers, { before, after }),
      )
    }
    index = end
  }
  return output
}
export function createMarkdownExtensions(options: MarkdownExtensionOptions): AnyExtension[] {
  const editing = options.purpose === 'editing'
  const kit = StarterKit.extend({
    addExtensions() {
      return (this.parent?.() ?? []).map((extension) => {
        if (extension.name === 'link')
          return extension.extend({
            addAttributes: () => ({ href: { default: null }, title: { default: null } }),
            parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
              helpers.applyMark('link', helpers.parseInline(token.tokens ?? []), {
                href: unescape(String(token.href ?? '')),
                title: token.title == null ? null : unescape(String(token.title)),
              }),
            renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) =>
              `[${helpers.renderChildren(node.content ?? [])}](${destination(node.attrs?.href ?? '')}${title(node.attrs?.title)})`,
            addPasteRules: () => [],
          })
        if (extension.name === 'orderedList')
          return extension.extend({
            addAttributes: () => ({
              start: {
                default: 1,
                parseHTML: (element: HTMLElement) => Number(element.getAttribute('start') ?? 1),
              },
            }),
          })
        if (extension.name === 'paragraph')
          return extension.extend({
            parseMarkdown: (token, helpers) =>
              helpers.createNode('paragraph', undefined, helpers.parseInline(token.tokens ?? [])),
            renderMarkdown: (node, helpers) => renderInline(node.content ?? [], helpers),
          })
        if (extension.name === 'heading')
          return extension.extend({
            renderMarkdown: (node, helpers) =>
              `${'#'.repeat(node.attrs?.level ?? 1)} ${renderInline(node.content ?? [], helpers)}`,
          })
        if (extension.name === 'hardBreak')
          return extension.extend({ renderMarkdown: () => '\\\n' })
        if (extension.name === 'codeBlock')
          return extension.extend({
            renderMarkdown(node) {
              const text = (node.content ?? [])
                .map((child: JSONContent) => child.text ?? '')
                .join('')
              const fence = '`'.repeat(
                Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1)),
              )
              return `${fence}${node.attrs?.language ?? ''}\n${text}\n${fence}`
            },
          })
        if (extension.name === 'code') return extension.extend({ addPasteRules: () => [] })
        if (extension.name === 'italic')
          return extension.extend({
            markdownOptions: { htmlReopen: undefined },
            renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) =>
              `_${helpers.renderChildren(node.content ?? [])}_`,
            addPasteRules: () => [],
          })
        if (extension.type === 'mark')
          return extension.extend({
            markdownOptions: { htmlReopen: undefined },
            addPasteRules: () => [],
          })
        return extension
      })
    },
  }).configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    underline: false,
    undoRedo: false,
    trailingNode: editing ? { node: 'paragraph', notAfter: ['paragraph'] } : false,
    link: {
      openOnClick: options.purpose === 'viewing',
      autolink: true,
      linkOnPaste: false,
      defaultProtocol: 'https',
      HTMLAttributes: { target: null, rel: null },
      isAllowedUri: (url) => isSafeTiptapUrl(url, 'link'),
    },
  })
  const image = Image.extend({
    addAttributes: () => ({
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    }),
    addCommands() {
      return {
        setImage: (attrs) => (props) => {
          try {
            validateMarkdownJSON(
              {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }],
              },
              props.state.schema,
            )
          } catch {
            return false
          }
          return props.commands.insertContent({ type: 'image', attrs })
        },
      }
    },
    addInputRules() {
      return (this.parent?.() ?? []).map(
        (rule) =>
          new InputRule({
            find: rule.find,
            undoable: rule.undoable,
            handler: (props) =>
              isSafeTiptapUrl(props.match[3], 'image') ? rule.handler(props) : null,
          }),
      )
    },
    parseMarkdown: (token, helpers) =>
      helpers.createNode('image', {
        src: unescape(String(token.href ?? '')),
        alt: token.text ? unescape(String(token.text)) : null,
        title: token.title == null ? null : unescape(String(token.title)),
      }),
    renderMarkdown: (node) =>
      `![${literal(node.attrs?.alt ?? '')}](${destination(node.attrs?.src ?? '')}${title(node.attrs?.title)})`,
  }).configure({ inline: true, allowBase64: false, resize: false })
  const extensions: AnyExtension[] = [
    kit,
    TaskList,
    TaskItem.configure({ nested: true, onReadOnlyChecked: () => false }),
    image,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph' }),
    TableCell.extend({ content: 'paragraph' }),
    ...(editing ? [ContentHistory, createMarkdownGuard(options)] : []),
  ]
  const names = flattenExtensions(extensions).map((extension) => extension.name)
  if (new Set(names).size !== names.length) throw new Error('Duplicate Markdown extension names')
  return extensions
}
