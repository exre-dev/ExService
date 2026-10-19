import type { JSONContent } from '@tiptap/core'
import { DOMParser as ProseMirrorDOMParser, type Schema } from '@tiptap/pm/model'

/** Parse already AST-approved HTML with the public schema parser. Full whitespace
 * preserves editable document text; the AST gate removes container indentation only. */
export function parseValidatedTiptapHTML(html: string, schema: Schema): JSONContent {
  const document = new window.DOMParser().parseFromString(html, 'text/html')
  return ProseMirrorDOMParser.fromSchema(schema)
    .parse(document.body, { preserveWhitespace: 'full' })
    .toJSON()
}
