import { defineConfig } from 'fumadocs-mdx/config'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'

export function normalizeCodeLanguages() {
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    sh: 'bash',
    txt: 'text',
    plaintext: 'text',
  }
  const supported = new Set(['lua', 'javascript', 'typescript', 'json', 'yaml', 'bash', 'text'])
  return (tree: Root) =>
    visit(tree, 'code', (node) => {
      const label = node.lang ?? 'text'
      const language = aliases[label] ?? label
      if (!supported.has(language)) {
        node.meta = `title=${JSON.stringify(label.replace(/[\r\n"\\]/g, ''))}`
        node.lang = 'text'
      } else node.lang = language
    })
}
export const contentConfig = defineConfig({
  mdxOptions: {
    remarkPlugins: [normalizeCodeLanguages],
    rehypeCodeOptions: {
      themes: { light: 'github-light', dark: 'github-dark' },
      icon: false,
      tab: false,
      transformers: [
        {
          pre(node) {
            node.properties.rawCode = this.source
          },
        },
      ],
    },
  },
})
