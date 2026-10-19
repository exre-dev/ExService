import {
  generateHTML,
  getSchema,
  flattenExtensions,
  InputRule,
  type Attributes,
  type AnyExtension,
  type JSONContent,
  type NodeViewRenderer,
} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'
import Image from '@tiptap/extension-image'
import Mention, { type MentionOptions } from '@tiptap/extension-mention'
import Highlight from '@tiptap/extension-highlight'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extensions/placeholder'
import type { TiptapContentPolicy } from '../types'
import { isSafeTiptapUrl } from '../conversion/policy'
import { Admonition, AdmonitionTitle } from './admonition'
import { controlledHtmlTokenizer } from './html-markdown'
import { validateTiptapHTML } from '../conversion/html'
import { validateTiptapJSON } from '../conversion/validate'
import { parseValidatedTiptapHTML } from '../conversion/dom'
import { liftMarkdownBlockImages } from './block-images'
import { imageLayoutNodeView } from './image-layout'
import { tableExtensions } from './table'
import { ContentHistory } from '../history'

/** Internal factory: purposes share one schema; only editing owns query/history/resize plugins.
 * The caller owns suggestion cancellation/rendering. Never register Markdown or React DragHandle here.
 * Every call returns fresh extensions and mutable storage. */
export interface TiptapExtensionOptions {
  purpose: 'editing' | 'viewing' | 'conversion'
  policy?: TiptapContentPolicy
  mentionSuggestion?: Partial<MentionOptions['suggestion']>
  tableNodeView?: NodeViewRenderer
  placeholder?: false
}

function needsHtml(node: JSONContent): boolean {
  if (node.type === 'paragraph') {
    const text = (node.content ?? []).map((child) => child.text ?? '').join('')
    // Blank lines split paragraphs in Markdown; whitespace-only text disappears.
    if (text && (!text.trim() || /\n[\t ]*\n/.test(text))) return true
  }
  // ATX Markdown cannot retain an empty heading created by the block menu.
  if (node.type === 'heading' && !node.content?.length) return true
  if (['mention', 'details', 'underline', 'highlight', 'textStyle'].includes(node.type ?? ''))
    return true
  // A lifted image can leave a hard break at either paragraph edge. Conventional
  // Markdown cannot retain that edge, so preserve the complete paragraph in HTML.
  if (
    node.type === 'paragraph' &&
    (node.content?.[0]?.type === 'hardBreak' || node.content?.at(-1)?.type === 'hardBreak')
  )
    return true
  // Splitting a Markdown heading around a block image can expose spaces at
  // either edge. ATX heading syntax trims them; controlled HTML preserves them.
  if (
    node.type === 'heading' &&
    (/^\s/.test(node.content?.[0]?.text ?? '') || /\s$/.test(node.content?.at(-1)?.text ?? ''))
  )
    return true
  if (node.type === 'image' && (node.attrs?.width != null || node.attrs?.height != null))
    return true
  if (node.attrs?.textAlign != null || (node.type === 'orderedList' && node.attrs?.type != null))
    return true
  // Conventional Markdown moves whitespace outside marks. HTML retains its mark
  // ownership, including text runs created on either side of a lifted block image.
  if (node.type === 'text' && node.marks?.length && /^\s|\s$/.test(node.text ?? '')) return true
  // GFM auto-links otherwise turn intentionally unlinked JSON text into Link
  // marks on re-import. Keep the complete owning subtree in controlled HTML.
  // Literal code and existing links already have unambiguous official syntax.
  if (
    node.type === 'text' &&
    !node.marks?.some((mark) => mark.type === 'code' || mark.type === 'link') &&
    /(?:https?:\/\/|ftp:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(node.text ?? '')
  )
    return true
  if (
    node.marks?.some(
      (mark) =>
        ['underline', 'highlight', 'textStyle'].includes(mark.type) ||
        (mark.type === 'link' && (mark.attrs?.target != null || mark.attrs?.rel != null)),
    )
  )
    return true
  // Images nested inside a container need an explicit block boundary; the official
  // list serializer otherwise merges their surrounding paragraphs with soft breaks.
  return (
    node.content?.some(
      (child) => child.type === 'admonition' || child.type === 'image' || needsHtml(child),
    ) ?? false
  )
}

export function createTiptapExtensions(options: TiptapExtensionOptions): AnyExtension[] {
  const editing = options.purpose === 'editing'
  let extensions: AnyExtension[] = []
  const html = (node: JSONContent) =>
    validateTiptapHTML(generateHTML({ type: 'doc', content: [node] }, extensions), options.policy)
  const parseHtml = (source: string, inline: boolean) => {
    const parsed = parseValidatedTiptapHTML(
      validateTiptapHTML(source, options.policy),
      getSchema(extensions),
    )
    return inline
      ? (parsed.content ?? []).flatMap((node: JSONContent) =>
          node.type === 'paragraph' ? (node.content ?? []) : [node],
        )
      : (parsed.content ?? [])
  }
  const SafeImage = Image.extend({
    addNodeView() {
      return options.purpose === 'conversion' ? null : imageLayoutNodeView(this.parent?.())
    },
    addAttributes() {
      const attrs: Attributes = this.parent?.() ?? {}
      return {
        ...attrs,
        width: {
          ...attrs.width,
          parseHTML: (element) =>
            element.getAttribute('width') ? Number(element.getAttribute('width')) : null,
        },
        height: {
          ...attrs.height,
          parseHTML: (element) =>
            element.getAttribute('height') ? Number(element.getAttribute('height')) : null,
        },
      }
    },
    addCommands() {
      const parent = this.parent?.()
      return {
        ...parent,
        setImage: (attrs) => (props) => {
          try {
            validateTiptapJSON(
              { type: 'doc', content: [{ type: 'image', attrs }] },
              props.state.schema,
              options.policy,
            )
          } catch {
            return false
          }
          return parent?.setImage?.(attrs)(props) ?? false
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
              isSafeTiptapUrl(props.match[3], 'image', options.policy) ? rule.handler(props) : null,
          }),
      )
    },
    renderMarkdown(node, helpers, context) {
      return needsHtml(node) ? html(node) : (this.parent?.(node, helpers, context) ?? '')
    },
  }).configure({
    inline: false,
    allowBase64: options.policy?.allowRasterDataImages === true,
    resize: editing
      ? { enabled: true, minWidth: 50, minHeight: 50, alwaysPreserveAspectRatio: true }
      : false,
  })
  const AdaptedStarter = StarterKit.extend({
    addExtensions() {
      return (this.parent?.() ?? []).map((extension) => {
        if (extension.type !== 'node') return extension
        if (extension.name === 'codeBlock')
          return extension.extend({
            renderMarkdown(node) {
              const text = (node.content ?? []).map((n: JSONContent) => n.text ?? '').join('')
              const ticks = [...text.matchAll(/`+/g)].map((m) => m[0].length)
              const fence = '`'.repeat(Math.max(3, ...ticks.map((n) => n + 1)))
              return `${fence}${node.attrs?.language ?? ''}\n${text}\n${fence}`
            },
          })
        if (
          !['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem'].includes(
            extension.name,
          )
        )
          return extension
        return extension.extend({
          parseMarkdown(token, helpers) {
            return liftMarkdownBlockImages(this.parent?.(token, helpers) ?? [])
          },
          renderMarkdown(node, helpers, context) {
            if (needsHtml(node) || (node.type === 'paragraph' && !node.content?.length))
              return html(node)
            let rendered = this.parent?.(node, helpers, context) ?? ''
            // Escape literal paragraph prefixes before list/container serializers
            // add their own structural markers.
            if (node.type === 'paragraph')
              rendered = rendered
                .replace(/(^|\n)(?=[#>+\-])/g, '$1\\')
                .replace(/(^|\n)(\d+)([.)])(?=\s)/g, '$1$2\\$3')
            return rendered.replace(/(^|\n)(:{3,})(?=\s|$)/g, '$1\\$2')
          },
        })
      })
    },
  })
  const SafeMention = Mention.extend({
    addProseMirrorPlugins() {
      return editing && options.mentionSuggestion ? (this.parent?.() ?? []) : []
    },
    renderMarkdown: (node) => html(node),
    markdownTokenName: 'tiptapHtmlInline',
    markdownTokenizer: controlledHtmlTokenizer(true),
    parseMarkdown: (token) => parseHtml(String(token.raw), true),
  }).configure({ suggestion: { ...options.mentionSuggestion, char: '@' } })
  extensions = [
    ...(editing && options.placeholder !== false
      ? [
          Placeholder.configure({
            placeholder: ({ node }) =>
              node.type.name === 'paragraph'
                ? '输入，或者按 "/" 查看命令，按 "@" @成员，按 "$" 打开 Emoji。'
                : '',
            showOnlyCurrent: true,
            showOnlyWhenEditable: true,
            includeChildren: false,
          }),
        ]
      : []),
    AdaptedStarter.configure({
      heading: { levels: [1, 2, 3, 4] },
      undoRedo: false,
      trailingNode: { node: 'paragraph', notAfter: ['paragraph'] },
      link: {
        openOnClick: options.purpose === 'viewing',
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { target: null, rel: null },
        isAllowedUri: (url) => isSafeTiptapUrl(url, 'link'),
      },
    }),
    ...(editing ? [ContentHistory.configure({})] : []),
    TaskList.extend({
      renderMarkdown(node, helpers, context) {
        return needsHtml(node) ? html(node) : (this.parent?.(node, helpers, context) ?? '')
      },
    }),
    TaskItem.extend({
      parseMarkdown(token, helpers) {
        return liftMarkdownBlockImages(this.parent?.(token, helpers) ?? [])
      },
    }).configure({ nested: true, onReadOnlyChecked: () => false }),
    Details.extend({
      renderMarkdown: (node) => html(node),
      markdownTokenName: 'tiptapHtmlBlock',
      markdownTokenizer: controlledHtmlTokenizer(false),
      parseMarkdown: (token) => parseHtml(String(token.raw), false),
    }).configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => {
        // Decorate only the live NodeView, keeping glass out of document/clipboard HTML.
        element.parentElement?.classList.add('ex-glass')
        element.setAttribute('aria-label', isOpen ? '收起详细内容' : '展开详细内容')
        element.setAttribute('aria-expanded', String(isOpen))
      },
    }),
    DetailsSummary.configure({}),
    DetailsContent.configure({}),
    SafeImage,
    SafeMention,
    ...tableExtensions(needsHtml, html, options.purpose === 'conversion', options.tableNodeView),
    Highlight.configure({ multicolor: true }),
    TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    Admonition.configure({
      renderTitle: (node) =>
        needsHtml(node) ||
        node.content?.some((child) => child.text && /[\t\r\n]|^ | $| {2,}/.test(child.text))
          ? `<span>${html({ type: 'paragraph', content: node.content }).slice(3, -4)}</span>`
          : undefined,
    }),
    AdmonitionTitle.configure({}),
  ]
  const names = flattenExtensions(extensions).map((extension) => extension.name)
  if (new Set(names).size !== names.length) throw new Error('Duplicate Tiptap extension names')
  return extensions
}

export { Admonition, AdmonitionTitle } from './admonition'
