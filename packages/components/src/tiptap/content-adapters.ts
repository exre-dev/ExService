import { parseTiptapContent, serializeTiptapMarkdown } from './conversion'
import { validateTiptapJSON } from './conversion/validate'
import { parseMarkdownContent, serializeMarkdownContent } from './markdown/conversion'
import { validateMarkdownJSON } from './markdown/validate'
import type { ContentAdapter } from './content-session'
import type { TiptapContentPolicy } from './types'

export const markdownContentAdapter: ContentAdapter = {
  parse: parseMarkdownContent,
  validate: (content, schema) => validateMarkdownJSON(content, schema, false),
  serialize: serializeMarkdownContent,
}

export function createTiptapContentAdapter(
  policy: () => TiptapContentPolicy | undefined,
): ContentAdapter {
  return {
    parse: (input) => parseTiptapContent(input, policy()),
    validate: (content, schema) => validateTiptapJSON(content, schema, policy()),
    serialize: (content) => serializeTiptapMarkdown(content, policy()),
  }
}
