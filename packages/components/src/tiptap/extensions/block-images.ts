import type { JSONContent, MarkdownParseResult } from '@tiptap/core'

/** Adapt the official parser's inline Markdown image tokens to this shared block
 * image schema. Split runs retain their original text/marks/attributes and order. */
export function liftMarkdownBlockImages(parsed: MarkdownParseResult): MarkdownParseResult {
  function lift(node: JSONContent): JSONContent[] {
    if (!node.content) return [node]
    if (
      (node.type === 'paragraph' || node.type === 'heading') &&
      node.content.some((child) => child.type === 'image')
    ) {
      const blocks: JSONContent[] = []
      let inline: JSONContent[] = []
      const flush = () => {
        if (inline.length) blocks.push({ ...node, content: inline })
        inline = []
      }
      for (const child of node.content) {
        if (child.type === 'image') {
          flush()
          blocks.push(child)
        } else inline.push(child)
      }
      flush()
      return blocks
    }
    const content = node.content.flatMap(lift)
    if (['listItem', 'taskItem'].includes(node.type ?? '') && content[0]?.type !== 'paragraph')
      content.unshift({ type: 'paragraph' })
    return [{ ...node, content }]
  }
  if (Array.isArray(parsed)) return parsed.flatMap(lift)
  if ('mark' in parsed) return { ...parsed, content: (parsed.content ?? []).flatMap(lift) }
  const nodes = lift(parsed)
  return nodes.length === 1 ? nodes[0]! : nodes
}
