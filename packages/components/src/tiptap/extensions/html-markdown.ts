import { Tokenizer } from 'parse5'
import type { MarkdownTokenizer } from '@tiptap/core'
import { fail } from '../conversion/policy'

/** Complete HTML islands prevent Marked blank-line splitting and nested-span truncation.
 * Source locations come from the non-active parse5 AST; semantic validation runs before DOM parsing. */
export function controlledHtmlTokenizer(inline: boolean): MarkdownTokenizer {
  const names = inline
    ? 'span|a|mark|u|strong|b|em|i|s|del|code|br'
    : 'p|h[1-4]|blockquote|ul|ol|pre|details|aside|div|hr|img|table'
  const starts = new RegExp(`^<(?:${names})(?=[\\s/>])`, 'i')
  return {
    name: inline ? 'tiptapHtmlInline' : 'tiptapHtmlBlock',
    level: inline ? 'inline' : 'block',
    start: (src) => {
      const match = new RegExp(`\\n<(?:${names})(?=[\\s/>])`, 'i').exec(src)
      return match ? match.index + 1 : -1
    },
    tokenize(src) {
      if (!starts.test(src)) return
      const end = controlledHtmlEnd(src)
      if (end === undefined) return fail('invalid-content')
      return {
        type: inline ? 'tiptapHtmlInline' : 'tiptapHtmlBlock',
        raw: src.slice(0, end),
        block: !inline,
      }
    },
  }
}

/** Scan only this HTML island, avoiding a full parse of the remaining Markdown per node. */
export function controlledHtmlEnd(src: string): number | undefined {
  let root: string | undefined,
    nesting = 0,
    end: number | undefined
  const tokenizer = new Tokenizer(
    { sourceCodeLocationInfo: true },
    {
      onStartTag(token) {
        root ??= token.tagName
        if (token.tagName === root) nesting++
        if (nesting === 1 && ['br', 'hr', 'img'].includes(root)) {
          end = token.location?.endOffset
          tokenizer.pause()
        }
      },
      onEndTag(token) {
        if (token.tagName === root && --nesting === 0) {
          end = token.location?.endOffset
          tokenizer.pause()
        }
      },
      onComment: () => {},
      onDoctype: () => {},
      onEof: () => {},
      onCharacter: () => {},
      onWhitespaceCharacter: () => {},
      onNullCharacter: () => {},
    },
  )
  tokenizer.write(src, true)
  return end
}
