import { parseFragment, serialize, Tokenizer, type DefaultTreeAdapterMap } from 'parse5'
import type { TiptapContentPolicy, TiptapIssue } from '../types'
import {
  ADMONITION_TYPES,
  ContentBudget,
  checkBytes,
  fail,
  isSafeTiptapUrl,
  normalizeColor,
  normalizeFontSize,
  normalizeLinkRel,
  notice,
} from './policy'
import { tableHtmlGuard } from './table-validation'

type AstNode = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']
const tags = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'ul',
  'ol',
  'li',
  'pre',
  'code',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'u',
  'a',
  'mark',
  'span',
  'img',
  'details',
  'summary',
  'aside',
  'div',
  'label',
  'input',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
])
const inlineTags = new Set([
  'br',
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'u',
  'a',
  'mark',
  'span',
  'code',
])
const elements = (node: Element) =>
  node.childNodes.filter((child): child is Element => 'tagName' in child)
const textOf = (node: AstNode): string =>
  'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(textOf).join('') : ''

/** Pure AST gate; runs before a DOM parser can create any document nodes. */
export function validateTiptapHTML(
  source: string,
  policy: TiptapContentPolicy = {},
  notices: TiptapIssue[] = [],
  budget = new ContentBudget(),
): string {
  checkBytes(source)
  const tableGuard = tableHtmlGuard()
  let linkOpen = false
  // The AST parser deliberately ignores invalid-context tags such as html/tr. The
  // same parse5 package's exported tokenizer guards that vocabulary before repair.
  new Tokenizer(
    {},
    {
      onStartTag: (token) => {
        if (!tags.has(token.tagName)) fail('unsupported-content')
        // Nested links are repaired before AST traversal, hiding the original
        // image/link ownership. Reject while the source relationship is intact.
        if (linkOpen && (token.tagName === 'a' || token.tagName === 'img')) fail('invalid-content')
        if (token.tagName === 'a') linkOpen = true
        tableGuard.start(token.tagName, token.selfClosing)
      },
      onEndTag: (token) => {
        if (!tags.has(token.tagName)) fail('unsupported-content')
        if (token.attrs.length || token.selfClosing) fail('unsafe-content')
        if (token.tagName === 'a') linkOpen = false
        tableGuard.end(token.tagName)
      },
      onComment: () => fail('unsupported-content'),
      onDoctype: () => fail('unsupported-content'),
      onCharacter: (token) => tableGuard.text(token.chars),
      onWhitespaceCharacter: () => {},
      onNullCharacter: () => fail('unsafe-content'),
      onEof: () => tableGuard.finish(),
      onParseError: (error) => {
        if (
          [
            'duplicate-attribute',
            'end-tag-with-attributes',
            'end-tag-with-trailing-solidus',
          ].includes(error.code)
        )
          fail('unsafe-content')
      },
    },
  ).write(source, true)
  const fragment = parseFragment(source, {
    onParseError: (error) => {
      if (
        [
          'duplicate-attribute',
          'unexpected-character-in-attribute-name',
          'unexpected-null-character',
        ].includes(error.code)
      )
        fail('unsafe-content')
    },
  })
  function walk(
    node: AstNode,
    depth: number,
    parent?: Element,
    grandparent?: Element,
    insideTitle = false,
    insideLink = false,
  ) {
    budget.visit(depth)
    if (node.nodeName === '#comment') fail('unsupported-content')
    if (!('tagName' in node)) return
    const el = node as Element
    const tag = el.tagName
    if (insideTitle && !inlineTags.has(tag)) fail('invalid-content')
    if (!tags.has(tag) || el.namespaceURI !== 'http://www.w3.org/1999/xhtml')
      fail('unsupported-content')
    const attrs = Object.fromEntries(
      el.attrs.map((attr) => {
        if (attr.namespace || attr.prefix) fail('unsafe-content')
        return [attr.name, attr.value]
      }),
    )
    const original = JSON.stringify(attrs)
    const allowed = new Set<string>()
    const allow = (...names: string[]) => names.forEach((name) => allowed.add(name))
    const isTaskItem = tag === 'li' && attrs['data-type'] === 'taskItem'
    const taskParent =
      parent?.tagName === 'li' &&
      parent.attrs.some((a) => a.name === 'data-type' && a.value === 'taskItem')
    const taskLabel =
      parent?.tagName === 'label' &&
      grandparent?.tagName === 'li' &&
      grandparent.attrs.some((a) => a.name === 'data-type' && a.value === 'taskItem')
    if (['p', 'h1', 'h2', 'h3', 'h4', 'span', 'mark', 'td', 'th'].includes(tag)) allow('style')
    if (tag === 'td' || tag === 'th') {
      allow('colspan', 'rowspan', 'colwidth', 'align')
      for (const key of ['colspan', 'rowspan'])
        if (attrs[key] !== undefined) {
          if (!/^[1-9]\d*$/.test(attrs[key]) || Number(attrs[key]) > 10_000) fail('invalid-content')
        }
      if (
        attrs.colwidth !== undefined &&
        (!/^\d+(,\d+)*$/.test(attrs.colwidth) ||
          attrs.colwidth.split(',').length !== Number(attrs.colspan ?? 1) ||
          attrs.colwidth.split(',').some((width) => Number(width) > 8192))
      )
        fail('invalid-content')
      if (attrs.align !== undefined && !['left', 'center', 'right'].includes(attrs.align))
        fail('invalid-content')
      const styleAlign = attrs.style?.match(/(?:^|;)\s*text-align\s*:\s*([^;]+)/)?.[1]?.trim()
      if (attrs.align && styleAlign && attrs.align !== styleAlign) fail('invalid-content')
    }
    if (tag === 'a') {
      allow('href', 'title', 'target', 'rel')
      if (!isSafeTiptapUrl(attrs.href, 'link', policy)) fail('unsafe-content')
      if (attrs.target === '') {
        delete attrs.target
        notices.push(notice())
      }
      if (attrs.target !== undefined && !['_blank', '_self'].includes(attrs.target))
        fail('unsafe-content')
      const rel = normalizeLinkRel(attrs.rel ?? null, attrs.target)
      if (rel) attrs.rel = rel
      else delete attrs.rel
    }
    if (tag === 'img') {
      // Block images cannot retain an enclosing inline Link mark.
      if (insideLink) fail('invalid-content')
      allow('src', 'alt', 'title', 'width', 'height')
      if (!isSafeTiptapUrl(attrs.src, 'image', policy)) fail('unsafe-content')
      for (const key of ['width', 'height'])
        if (attrs[key] !== undefined) {
          if (attrs[key] === '') {
            delete attrs[key]
            notices.push(notice())
            continue
          }
          if (!/^\d+$/.test(attrs[key]) || Number(attrs[key]) < 1 || Number(attrs[key]) > 8192)
            fail('invalid-content')
          attrs[key] = String(Number(attrs[key]))
        }
    }
    if (tag === 'ol') {
      allow('start', 'type')
      if (
        attrs.start !== undefined &&
        (!/^\d+$/.test(attrs.start) ||
          !Number.isSafeInteger(Number(attrs.start)) ||
          Number(attrs.start) < 1)
      )
        fail('invalid-content')
      if (attrs.start !== undefined) attrs.start = String(Number(attrs.start))
      if (attrs.type !== undefined && !['1', 'a', 'A', 'i', 'I'].includes(attrs.type))
        fail('invalid-content')
    }
    if (tag === 'details') {
      allow('open')
      if (attrs.open !== undefined) attrs.open = ''
      const children = elements(el)
      if (
        children.length !== 2 ||
        children[0]?.tagName !== 'summary' ||
        children[1]?.tagName !== 'div' ||
        !children[1].attrs.some((a) => a.name === 'data-type' && a.value === 'detailsContent')
      )
        fail('invalid-content')
      if (el.childNodes.some((child) => child.nodeName === '#text' && textOf(child).trim()))
        fail('invalid-content')
    }
    if (tag === 'summary' && parent?.tagName !== 'details') fail('invalid-content')
    if (tag === 'span' && attrs['data-type'] === 'mention') {
      allow('data-type', 'data-id', 'data-label', 'data-mention-suggestion-char')
      if (
        !attrs['data-id']?.trim() ||
        (attrs['data-mention-suggestion-char'] !== undefined &&
          attrs['data-mention-suggestion-char'] !== '@')
      )
        fail('invalid-content')
      attrs['data-mention-suggestion-char'] = '@'
      if (
        el.childNodes.length &&
        (elements(el).length || textOf(el) !== `@${attrs['data-label'] ?? attrs['data-id']}`)
      )
        fail('invalid-content')
    } else if (tag === 'span' && taskLabel) {
      if (el.childNodes.length) fail('unsupported-content')
    }
    if (tag === 'ul' && attrs['data-type'] === 'taskList') {
      allow('data-type')
      if (
        elements(el).some(
          (child) =>
            child.tagName !== 'li' ||
            !child.attrs.some((a) => a.name === 'data-type' && a.value === 'taskItem'),
        )
      )
        fail('invalid-content')
    }
    if (isTaskItem) {
      allow('data-type', 'data-checked')
      if (attrs['data-checked'] === '') attrs['data-checked'] = 'true'
      if (!['true', 'false'].includes(attrs['data-checked']!)) fail('invalid-content')
      if (
        parent &&
        !(
          parent.tagName === 'ul' &&
          parent.attrs.some((a) => a.name === 'data-type' && a.value === 'taskList')
        )
      )
        fail('invalid-content')
      const children = elements(el)
      if (
        children.length !== 2 ||
        children[0]!.tagName !== 'label' ||
        children[1]!.tagName !== 'div'
      )
        fail('invalid-content')
    }
    if (tag === 'label') {
      if (
        !taskParent ||
        elements(el).length !== 2 ||
        elements(el)[0]!.tagName !== 'input' ||
        elements(el)[1]!.tagName !== 'span'
      )
        fail('unsupported-content')
      if (
        el.childNodes.some(
          (child) => child.nodeName === '#text' && 'value' in child && child.value.trim(),
        )
      )
        fail('unsupported-content')
    }
    if (tag === 'input') {
      if (!taskLabel || attrs.type !== 'checkbox') fail('unsupported-content')
      allow('type', 'checked', 'disabled', 'readonly')
      for (const key of ['checked', 'disabled', 'readonly'])
        if (attrs[key] !== undefined) attrs[key] = ''
      const checked = grandparent?.attrs.find((a) => a.name === 'data-checked')?.value
      if ((attrs.checked !== undefined) !== (checked === 'true' || checked === ''))
        fail('invalid-content')
      attrs.disabled = ''
      attrs.readonly = ''
    }
    if (tag === 'div') {
      if (attrs['data-type'] === 'detailsContent') {
        allow('data-type')
        if (parent?.tagName !== 'details') fail('invalid-content')
      } else if (attrs['data-type'] === 'admonitionTitle') {
        allow('data-type')
        if (parent?.tagName !== 'aside' || elements(parent)[0] !== el) fail('invalid-content')
      } else if (!taskParent) fail('unsupported-content')
    }
    if (tag === 'aside') {
      allow('data-type', 'data-admonition-type')
      if (
        attrs['data-type'] !== 'admonition' ||
        !ADMONITION_TYPES.includes(attrs['data-admonition-type'] as never)
      )
        fail('invalid-content')
      const children = elements(el)
      if (
        children[0]?.tagName !== 'div' ||
        !children[0].attrs.some((a) => a.name === 'data-type' && a.value === 'admonitionTitle') ||
        children.length < 2
      )
        fail('invalid-content')
      const bodyTags = [
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'blockquote',
        'ul',
        'ol',
        'pre',
        'hr',
        'img',
        'details',
        'aside',
        'table',
      ]
      if (
        children.slice(1).some((child) => !bodyTags.includes(child.tagName)) ||
        el.childNodes.some((child) => child.nodeName === '#text' && textOf(child).trim())
      )
        fail('invalid-content')
    }
    if (tag === 'code' && attrs.class !== undefined) {
      allow('class')
      if (parent?.tagName !== 'pre' || !/^language-[\w+-]+$/.test(attrs.class))
        fail('unsafe-content')
    }
    if (tag === 'mark') {
      allow('data-color')
      if (attrs['data-color'] !== undefined)
        attrs['data-color'] = normalizeColor(attrs['data-color'], true)!
    }
    if (attrs.style !== undefined) {
      const declarations: Record<string, string> = {}
      for (const declaration of attrs.style.split(';')) {
        if (!declaration.trim()) continue
        const index = declaration.indexOf(':')
        if (index < 1) fail('unsafe-content')
        const key = declaration.slice(0, index).trim().toLowerCase(),
          value = declaration.slice(index + 1).trim()
        if (Object.hasOwn(declarations, key)) fail('unsafe-content')
        if (
          key === 'text-align' &&
          ['p', 'h1', 'h2', 'h3', 'h4', 'td', 'th'].includes(tag) &&
          (['td', 'th'].includes(tag)
            ? ['left', 'center', 'right']
            : ['left', 'center', 'right', 'justify']
          ).includes(value)
        )
          declarations[key] = value
        else if (key === 'color' && tag === 'mark' && value === 'inherit') declarations[key] = value
        else if (
          (tag === 'span' && ['color', 'background-color'].includes(key)) ||
          (tag === 'mark' && key === 'background-color')
        )
          declarations[key] = normalizeColor(value, true)!
        else if (key === 'font-size' && tag === 'span')
          declarations[key] = normalizeFontSize(value)!
        else fail('unsafe-content')
      }
      if (tag === 'mark' && (declarations['background-color'] || attrs['data-color'])) {
        if (
          !declarations['background-color'] ||
          !attrs['data-color'] ||
          declarations['background-color'] !== attrs['data-color']
        )
          fail('invalid-content')
      }
      attrs.style = Object.entries(declarations)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ')
      if (!attrs.style) delete attrs.style
    }
    if (tag === 'mark' && attrs['data-color'] && !attrs.style) fail('invalid-content')
    for (const key of Object.keys(attrs)) if (!allowed.has(key)) fail('unsafe-content')
    el.attrs = Object.entries(attrs).map(([name, value]) => ({ name, value }))
    if (original !== JSON.stringify(attrs)) notices.push(notice())
    for (const child of el.childNodes)
      walk(
        child,
        depth + 1,
        el,
        parent,
        insideTitle ||
          tag === 'summary' ||
          (tag === 'div' && attrs['data-type'] === 'admonitionTitle'),
        insideLink || tag === 'a',
      )
  }
  for (const child of fragment.childNodes) walk(child, 0)
  // Pretty-print indentation belongs to block-container structure. Textblock and
  // inline whitespace remains untouched for preserveWhitespace:'full' downstream.
  function removeLayoutWhitespace(node: AstNode) {
    if (!('childNodes' in node)) return
    const structural =
      !('tagName' in node) ||
      [
        'blockquote',
        'ul',
        'ol',
        'li',
        'details',
        'aside',
        'table',
        'thead',
        'tbody',
        'tr',
        'td',
        'th',
      ].includes(node.tagName) ||
      (node.tagName === 'div' &&
        node.attrs.some((a) => a.name === 'data-type' && a.value === 'detailsContent')) ||
      (node.tagName === 'div' &&
        node.parentNode &&
        'tagName' in node.parentNode &&
        node.parentNode.tagName === 'li')
    if (structural && node.childNodes.some((child) => 'tagName' in child)) {
      node.childNodes = node.childNodes.filter((child, index, siblings) => {
        if (child.nodeName === '#text' && !textOf(child).trim()) {
          const neighbors = [siblings[index - 1], siblings[index + 1]]
          if (
            neighbors.some(
              (neighbor) => neighbor && 'tagName' in neighbor && inlineTags.has(neighbor.tagName),
            )
          )
            return true
          notices.push(notice())
          return false
        }
        return true
      })
    }
    for (const child of node.childNodes) removeLayoutWhitespace(child)
  }
  removeLayoutWhitespace(fragment)
  const result = serialize(fragment)
  if (result !== source) notices.push(notice())
  return result
}
