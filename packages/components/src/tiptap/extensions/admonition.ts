import {
  Node,
  mergeAttributes,
  findParentNode,
  type MarkdownTokenizer,
  type JSONContent,
} from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import {
  ADMONITION_TYPES,
  ADMONITION_TITLES,
  fail,
  type AdmonitionType,
} from '../conversion/policy'
import { controlledHtmlEnd } from './html-markdown'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    admonition: {
      setAdmonition: (type: AdmonitionType) => ReturnType
      unsetAdmonition: () => ReturnType
    }
  }
}

export const admonitionTokenizer: MarkdownTokenizer = {
  name: 'admonition',
  level: 'block',
  start: (src) => {
    const match = /\n:{3,}[ \t]+\S/.exec(src)
    return match ? match.index + 1 : -1
  },
  tokenize(src, _tokens, lexer) {
    const opening = src.match(/^(:{3,})[ \t]+(\S+)(?:[ \t]+([^\n]*))?\n/)
    if (!opening) {
      if (/^:{3,}(?:\s|$)/.test(src)) fail('invalid-content')
      return
    }
    if (!ADMONITION_TYPES.includes(opening[2] as AdmonitionType)) fail('unsupported-content')
    const stack = [opening[1]!.length]
    let fence: { char: string; length: number } | undefined
    let offset = opening[0].length
    while (offset < src.length) {
      const newline = src.indexOf('\n', offset)
      const line = src.slice(offset, newline < 0 ? src.length : newline + 1)
      if (!fence && /^<(?:p|h[1-4]|blockquote|ul|ol|pre|details|aside|div)(?=[\s/>])/i.test(line)) {
        const end = controlledHtmlEnd(src.slice(offset))
        if (end !== undefined) {
          offset += end
          continue
        }
      }
      const code = line.match(/^ {0,3}(`{3,}|~{3,})(.*?)(?:\n)?$/)
      if (code) {
        if (!fence) fence = { char: code[1]![0]!, length: code[1]!.length }
        else if (fence.char === code[1]![0]! && code[1]!.length >= fence.length && !code[2]!.trim())
          fence = undefined
      } else if (!fence) {
        const boundary = line.match(/^(:{3,})(?:[ \t]+(\S+)(?:[ \t]+.*)?)?[ \t]*(?:\n)?$/)
        if (boundary) {
          if (boundary[2]) {
            if (!ADMONITION_TYPES.includes(boundary[2] as AdmonitionType))
              fail('unsupported-content')
            stack.push(boundary[1]!.length)
            if (stack.length > 32) fail('limit-exceeded')
          } else if (boundary[1]!.length === stack.at(-1)) {
            stack.pop()
            if (stack.length === 0) {
              return {
                type: 'admonition',
                raw: src.slice(0, offset + line.length),
                admonitionType: opening[2],
                titleTokens: lexer.inlineTokens(opening[3] ?? ''),
                tokens: lexer.blockTokens(src.slice(opening[0].length, offset)),
              }
            }
          }
        }
      }
      offset += line.length
    }
    return fail('invalid-content')
  },
}

export const AdmonitionTitle = /*#__PURE__*/ Node.create({
  name: 'admonitionTitle',
  content: 'inline*',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="admonitionTitle"]' }],
  renderHTML: () => ['div', { 'data-type': 'admonitionTitle' }, 0],
  renderMarkdown: (node, helpers) => helpers.renderChildren(node.content ?? []),
})

export const Admonition = /*#__PURE__*/ Node.create<{
  renderTitle?: (node: JSONContent) => string | undefined
}>({
  name: 'admonition',
  group: 'block',
  content: 'admonitionTitle block+',
  defining: true,
  addOptions: () => ({}),
  addAttributes: () => ({
    type: {
      default: 'info',
      parseHTML: (element) => element.getAttribute('data-admonition-type') ?? 'info',
      renderHTML: (attrs) => ({ 'data-admonition-type': attrs.type }),
    },
  }),
  parseHTML: () => [{ tag: 'aside[data-type="admonition"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'aside',
    mergeAttributes(HTMLAttributes, { 'data-type': 'admonition' }),
    0,
  ],
  markdownTokenizer: admonitionTokenizer,
  parseMarkdown: (token, helpers) =>
    helpers.createNode('admonition', { type: token.admonitionType }, [
      helpers.createNode('admonitionTitle', {}, helpers.parseInline(token.titleTokens)),
      ...helpers.parseChildren(token.tokens ?? []),
    ]),
  renderMarkdown(node, helpers) {
    const htmlTitle = this.options.renderTitle?.(node.content?.[0] ?? { type: 'admonitionTitle' })
    const title =
      htmlTitle !== undefined
        ? htmlTitle.replace(/\n/g, '&#10;').replace(/\r/g, '&#13;')
        : helpers
            .renderChildren(node.content?.[0]?.content ?? [])
            .replace(/ {2}\n/g, '<br>')
            .replace(/\n/g, '&#10;')
    const body = helpers.renderChildren(node.content?.slice(1) ?? [], '\n\n')
    const innerLengths = [...body.matchAll(/^(:{3,})/gm)].map((m) => m[1]!.length)
    const fence = ':'.repeat(Math.max(3, ...innerLengths.map((n) => n + 1)))
    return `${fence} ${node.attrs?.type}${title ? ` ${title}` : ''}\n${body}\n${fence}`
  },
  addCommands() {
    return {
      setAdmonition:
        (type) =>
        ({ state, dispatch, tr }) => {
          if (!ADMONITION_TYPES.includes(type)) return false
          const parent = findParentNode((node) => node.type === this.type)(state.selection)
          if (parent) {
            if (dispatch)
              closeHistory(tr).setNodeMarkup(parent.pos, undefined, { ...parent.node.attrs, type })
            return true
          }
          const range = state.selection.$from.blockRange(state.selection.$to)
          if (!range) return false
          const body = tr.doc.slice(range.start, range.end).content
          const title = state.schema.nodes.admonitionTitle!.create(
            null,
            state.schema.text(ADMONITION_TITLES[type]),
          )
          const content = Fragment.from(title).append(body)
          if (
            !this.type.validContent(content) ||
            !range.parent.canReplaceWith(range.startIndex, range.endIndex, this.type)
          )
            return false
          if (dispatch) {
            closeHistory(tr)
            tr.replaceWith(range.start, range.end, this.type.create({ type }, content))
            tr.setSelection(TextSelection.near(tr.doc.resolve(range.start + 2)))
          }
          return true
        },
      unsetAdmonition:
        () =>
        ({ state, dispatch, tr }) => {
          const parent = findParentNode((node) => node.type === this.type)(state.selection)
          if (!parent) return false
          const children = []
          const title = parent.node.firstChild!
          if (title.content.size)
            children.push(state.schema.nodes.paragraph!.create(null, title.content))
          parent.node.forEach((node, _offset, index) => {
            if (index > 0) children.push(node)
          })
          const fragment = Fragment.fromArray(children)
          const $pos = tr.doc.resolve(parent.pos)
          if (!$pos.parent.canReplace($pos.index(), $pos.index() + 1, fragment)) return false
          if (dispatch) {
            closeHistory(tr)
            tr.replaceWith(parent.pos, parent.pos + parent.node.nodeSize, fragment)
            tr.setSelection(TextSelection.near(tr.doc.resolve(parent.pos + 1)))
          }
          return true
        },
    }
  },
})
