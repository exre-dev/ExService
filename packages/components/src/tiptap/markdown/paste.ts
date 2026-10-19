import { parseFragment, Tokenizer, type DefaultTreeAdapterMap } from 'parse5'
import { DOMParser as SchemaParser, type Node, type Schema } from '@tiptap/pm/model'
import type { TiptapIssue, TiptapResult } from '../types'
import {
  ContentBudget,
  ContentFailure,
  checkBytes,
  fail,
  isSafeTiptapUrl,
} from '../conversion/policy'
import { validateMarkdownJSON } from './validate'

type Ast = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']
const discarded = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'source',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'canvas',
  'template',
  'noscript',
])
const semantic = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'code',
  'pre',
  'br',
  'hr',
  'blockquote',
  'ul',
  'ol',
  'li',
])
const inline = new Set(['strong', 'b', 'em', 'i', 's', 'del', 'code', 'a', 'img', 'span', 'u'])
const blocks = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'details',
  'summary',
  'section',
  'aside',
  'article',
  'header',
  'footer',
  'main',
  'nav',
  'address',
  'figure',
  'figcaption',
  'table',
  'tr',
])
const voids = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
const structuralContainers = new Set([
  'ul',
  'ol',
  'li',
  'blockquote',
  'details',
  'div',
  'section',
  'aside',
])
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const attrsOf = (el: Element) => Object.fromEntries(el.attrs.map((attr) => [attr.name, attr.value]))
const children = (node: Element) =>
  node.childNodes.filter((child): child is Element => 'tagName' in child)
function alignment(cell: Element): string | null | undefined {
  const attrs = attrsOf(cell)
  const value =
    attrs.align ??
    attrs.style
      ?.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/i)?.[1]
      ?.toLowerCase() ??
    null
  return value === null || ['left', 'center', 'right'].includes(value) ? value : undefined
}
function hidden(el: Element): boolean {
  const attrs = attrsOf(el)
  return (
    attrs.hidden !== undefined ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(
      attrs.style ?? '',
    )
  )
}

/** parse5 token/AST budgets precede every DOM operation. Only constructed attributes leave this function. */
export function parseMarkdownHTML(source: string, schema: Schema): TiptapResult<Node> {
  try {
    checkBytes(source)
    const tokens = new ContentBudget()
    const stack: string[] = []
    new Tokenizer(
      {},
      {
        onStartTag(token) {
          tokens.visit(stack.length)
          if (!token.selfClosing && !voids.has(token.tagName)) stack.push(token.tagName)
        },
        onEndTag(token) {
          const index = stack.lastIndexOf(token.tagName)
          if (index >= 0) stack.length = index
        },
        onCharacter: () => tokens.visit(stack.length),
        onWhitespaceCharacter: () => tokens.visit(stack.length),
        onNullCharacter: () => fail('unsafe-content'),
        onComment: () => tokens.visit(stack.length),
        onDoctype: () => {},
        onEof: () => {},
      },
    ).write(source, true)
    const fragment = parseFragment(source)
    const budget = new ContentBudget()
    function check(node: Ast, depth: number) {
      budget.visit(depth)
      if ('childNodes' in node) node.childNodes.forEach((child) => check(child, depth + 1))
    }
    check(fragment, 0)
    let downgraded = false
    const hiddenColumnMismatch = new WeakSet<Element>()
    function pruneHidden(node: Ast): void {
      if (!('childNodes' in node)) return
      if ('tagName' in node && node.tagName === 'table') {
        const masks: string[] = []
        const collect = (container: Element) => {
          for (const child of children(container)) {
            if (hidden(child)) continue
            if (child.tagName === 'tr')
              masks.push(
                children(child)
                  .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
                  .map((cell) => (hidden(cell) ? '0' : '1'))
                  .join(''),
              )
            else if (['thead', 'tbody', 'tfoot'].includes(child.tagName)) collect(child)
          }
        }
        collect(node)
        // Equal surviving widths are insufficient: the visible cells must
        // occupy the same original columns in every remaining row.
        if (new Set(masks).size > 1) hiddenColumnMismatch.add(node)
      }
      node.childNodes = node.childNodes.filter((child) => {
        if ('tagName' in child && hidden(child)) {
          downgraded = true
          return false
        }
        pruneHidden(child)
        return true
      })
    }
    // Visibility applies before specialized table traversal, so hidden groups,
    // rows and cells cannot bypass the same ancestor rule as ordinary elements.
    pruneHidden(fragment)
    // Browser clipboard wrappers insert formatting newlines outside their
    // actual fragment. Keep whitespace within paragraphs/inline/code content.
    const withoutIndentation = (nodes: Ast[]) =>
      nodes.filter((node) => !('value' in node && /^[\t \r\n]*[\r\n][\t \r\n]*$/.test(node.value)))
    function visibleText(node: Ast): string {
      if ('value' in node) return node.value
      if (!('tagName' in node) || discarded.has(node.tagName) || hidden(node)) return ''
      if (node.tagName === 'img') return attrsOf(node).alt ?? ''
      if (node.tagName === 'br') return '\n'
      if (node.tagName === 'input') return ''
      if (node.tagName === 'table') return tableTextBlocks(node).join('\n')
      if (node.tagName === 'tr')
        return children(node)
          .filter((cell) => cell.tagName === 'td' || cell.tagName === 'th')
          .map(visibleText)
          .join('\t')
      const nodeChildren =
        blocks.has(node.tagName) || ['td', 'th', 'tbody', 'thead'].includes(node.tagName)
          ? withoutIndentation(node.childNodes)
          : node.childNodes
      const parts = nodeChildren.map((child) => ({
        text: visibleText(child),
        block: 'tagName' in child && blocks.has(child.tagName),
      }))
      let text = ''
      parts.forEach((part, index) => {
        if (!part.text) return
        if (text && (part.block || parts[index - 1]?.block) && !text.endsWith('\n')) text += '\n'
        text += part.text
      })
      return text
    }
    function tableTextBlocks(node: Element): string[] {
      return withoutIndentation(node.childNodes).flatMap((child) => {
        if ('tagName' in child && ['thead', 'tbody', 'tfoot'].includes(child.tagName))
          return tableTextBlocks(child)
        const text = visibleText(child)
        return text ? [text] : []
      })
    }
    function tableRows(node: Element): Element[] {
      return children(node).flatMap((child) =>
        child.tagName === 'tr'
          ? [child]
          : ['thead', 'tbody', 'tfoot'].includes(child.tagName)
            ? children(child).filter((row) => row.tagName === 'tr')
            : [],
      )
    }
    function simpleTable(table: Element): boolean {
      if (hiddenColumnMismatch.has(table)) return false
      if (children(table).some((child) => child.tagName === 'caption')) return false
      const rows = tableRows(table)
      const width = rows[0] ? children(rows[0]).length : 0
      if (!width) return false
      const aligns = children(rows[0]!).map(alignment)
      return rows.every((row, index) => {
        const cells = children(row)
        return (
          cells.length === width &&
          cells.every((cell, col) => {
            const attrs = attrsOf(cell)
            if (
              cell.tagName !== (index ? 'td' : 'th') ||
              ![undefined, '1'].includes(attrs.colspan) ||
              ![undefined, '1'].includes(attrs.rowspan) ||
              alignment(cell) === undefined ||
              alignment(cell) !== aligns[col]
            )
              return false
            const elements = children(cell)
            const singleParagraph =
              elements.length === 1 &&
              elements[0]?.tagName === 'p' &&
              cell.childNodes.every(
                (child) => child === elements[0] || ('value' in child && !child.value.trim()),
              )
            const content = singleParagraph ? elements[0]!.childNodes : cell.childNodes
            const supportedInline = (node: Ast): boolean =>
              'value' in node ||
              ('tagName' in node &&
                inline.has(node.tagName) &&
                (!('childNodes' in node) || node.childNodes.every(supportedInline)))
            return (
              content.every(supportedInline) &&
              !/[\t\r\n\u001f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/.test(
                content.map(visibleText).join(''),
              )
            )
          })
        )
      })
    }
    function clean(node: Ast, task = false): string {
      if ('value' in node) return escape(node.value)
      if (!('tagName' in node)) {
        downgraded = true
        return ''
      }
      const el = node,
        tag = el.tagName,
        attrs = attrsOf(el)
      if (discarded.has(tag) || hidden(el) || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
        downgraded = true
        return ''
      }
      if (tag === 'table') {
        if (!simpleTable(el)) {
          downgraded = true
          return tableTextBlocks(el)
            .map((text) => `<p>${escape(text).replace(/\n/g, '<br>')}</p>`)
            .join('')
        }
        const rows = tableRows(el)
        return `<table>${rows
          .map(
            (row) =>
              `<tr>${children(row)
                .map((cell) => {
                  const attr = attrsOf(cell),
                    align = alignment(cell)
                  if (Object.keys(attr).some((key) => key !== 'align')) downgraded = true
                  return `<${cell.tagName}${align ? ` align="${escape(align)}"` : ''}>${withoutIndentation(
                    cell.childNodes,
                  )
                    .map((child) => clean(child))
                    .join('')}</${cell.tagName}>`
                })
                .join('')}</tr>`,
          )
          .join('')}</table>`
      }
      if (tag === 'a') {
        const content = el.childNodes.map((child) => clean(child)).join('')
        if (!isSafeTiptapUrl(attrs.href, 'link')) {
          downgraded = true
          return content
        }
        if (Object.keys(attrs).some((key) => !['href', 'title'].includes(key))) downgraded = true
        return `<a href="${escape(attrs.href!)}"${attrs.title !== undefined ? ` title="${escape(attrs.title)}"` : ''}>${content}</a>`
      }
      if (tag === 'img') {
        if (!isSafeTiptapUrl(attrs.src, 'image')) {
          downgraded = true
          return escape(attrs.alt ?? '')
        }
        if (Object.keys(attrs).some((key) => !['src', 'alt', 'title'].includes(key)))
          downgraded = true
        return `<img src="${escape(attrs.src!)}"${['alt', 'title'].map((key) => (attrs[key] === undefined ? '' : ` ${key}="${escape(attrs[key]!)}"`)).join('')}>`
      }
      if (tag === 'input') {
        if (!task) downgraded = true
        return ''
      }
      const isTaskList =
        tag === 'ul' &&
        (attrs['data-type'] === 'taskList' ||
          children(el).some((li) =>
            children(li).some(
              (child) => child.tagName === 'input' && attrsOf(child).type === 'checkbox',
            ),
          ))
      const childTask = tag === 'ul' || tag === 'ol' ? isTaskList : task
      const nodeChildren = structuralContainers.has(tag)
        ? withoutIndentation(el.childNodes)
        : el.childNodes
      if (!semantic.has(tag) && blocks.has(tag)) {
        downgraded = true
        let output = '',
          inlineContent = ''
        const flush = () => {
          if (inlineContent) output += `<p>${inlineContent}</p>`
          inlineContent = ''
        }
        for (const child of nodeChildren) {
          const content = clean(child, childTask)
          if ('tagName' in child && blocks.has(child.tagName) && content) {
            flush()
            output += content
          } else inlineContent += content
        }
        flush()
        return output
      }
      const content = nodeChildren.map((child) => clean(child, childTask)).join('')
      if (!semantic.has(tag)) {
        downgraded = true
        let output = tag === 'summary' ? `<p>${content}</p>` : content
        if (
          attrs.style &&
          /(?:^|;)\s*font-weight\s*:\s*(?:bold|[6-9]00)\s*(?:;|$)/i.test(attrs.style)
        )
          output = `<strong>${output}</strong>`
        if (attrs.style && /(?:^|;)\s*font-style\s*:\s*italic\s*(?:;|$)/i.test(attrs.style))
          output = `<em>${output}</em>`
        if (
          attrs.style &&
          /(?:^|;)\s*text-decoration(?:-line)?\s*:\s*line-through\s*(?:;|$)/i.test(attrs.style)
        )
          output = `<s>${output}</s>`
        return output
      }
      let attributes = ''
      if (isTaskList) attributes = ' data-type="taskList"'
      if (tag === 'li' && task) {
        const checkbox = children(el).find(
          (child) => child.tagName === 'input' && attrsOf(child).type === 'checkbox',
        )
        attributes = ` data-type="taskItem" data-checked="${checkbox ? attrsOf(checkbox).checked !== undefined : attrs['data-checked'] === 'true'}"`
      }
      if (tag === 'ol' && attrs.start && /^[1-9]\d{0,8}$/.test(attrs.start))
        attributes = ` start="${attrs.start}"`
      if (tag === 'code' && /^language-[\w+-]+$/.test(attrs.class ?? ''))
        attributes = ` class="${escape(attrs.class!)}"`
      if (
        Object.keys(attrs).some(
          (key) =>
            !['data-type', 'data-checked'].includes(key) &&
            !(tag === 'ol' && key === 'start') &&
            !(tag === 'code' && key === 'class'),
        )
      )
        downgraded = true
      return voids.has(tag) ? `<${tag}${attributes}>` : `<${tag}${attributes}>${content}</${tag}>`
    }
    const html = withoutIndentation(fragment.childNodes)
      .map((child) => clean(child))
      .join('')
    checkBytes(html)
    if (typeof window === 'undefined' || !window.DOMParser) fail('not-ready')
    const dom = new window.DOMParser().parseFromString(html, 'text/html')
    const parsed = SchemaParser.fromSchema(schema).parse(dom.body, { preserveWhitespace: 'full' })
    const json = validateMarkdownJSON(parsed.toJSON(), schema, false)
    return {
      ok: true,
      value: schema.nodeFromJSON(json),
      notices: downgraded ? [new ContentFailure('downgraded-content').issue] : [],
    }
  } catch (error) {
    return {
      ok: false,
      issues: [
        error instanceof ContentFailure
          ? error.issue
          : new ContentFailure('conversion-failed').issue,
      ],
    }
  }
}

export function plainTextDocument(text: string, schema: Schema): Node {
  checkBytes(text)
  const content = text.split(/\r\n?|\n/).map((line) => ({
    type: 'paragraph',
    ...(line ? { content: [{ type: 'text', text: line }] } : {}),
  }))
  return schema.nodeFromJSON(validateMarkdownJSON({ type: 'doc', content }, schema, false))
}
