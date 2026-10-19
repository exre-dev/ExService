import { describe, expect, it } from 'vitest'
import { docsSchema } from './schema.js'
import { validateDocsContent, type DocsContentNode } from './validation.js'

/**
 * Docs profile 1 的纯 Node 内容校验。
 *
 * 本文件刻意位于 `apps/server` 且不带 jsdom 标记：它同时证明内容模块不需要 DOM。
 * 语法与网格规则对照 `.notes/docs-service/specs/2026-10-16-docs-server-v1.2-content.md`
 * 与 `packages/components/src/tiptap/conversion/{validate,policy,table-validation}.ts`。
 */

const p = (text?: string): DocsContentNode =>
  (text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }) as DocsContentNode
const doc = (...content: DocsContentNode[]): DocsContentNode =>
  ({ type: 'doc', content }) as DocsContentNode

function codeOf(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return String((error as { code?: unknown }).code)
  }
  return 'NO_ERROR'
}

describe('Docs 内容 profile 1', () => {
  it('mirrors the complete browser preset: 24 nodes and 8 marks', () => {
    expect(Object.keys(docsSchema.nodes)).toHaveLength(24)
    expect(Object.keys(docsSchema.marks)).toHaveLength(8)
    expect(docsSchema.topNodeType.name).toBe('doc')
  })

  it('normalizes an empty document to exactly one paragraph', () => {
    expect(validateDocsContent(doc()).content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: null } }],
    })
  })

  it('appends a trailing paragraph only when the document does not end with one', () => {
    expect(
      validateDocsContent(
        doc({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'h' }],
        } as DocsContentNode),
      ).content.content,
    ).toHaveLength(2)
  })

  it('rejects a non-doc root and root-level attrs, marks or text', () => {
    expect(codeOf(() => validateDocsContent({ type: 'paragraph' }))).toBe('DOCS_INVALID_CONTENT')
    expect(codeOf(() => validateDocsContent({ type: 'doc', content: [], attrs: {} }))).toBe(
      'DOCS_UNSUPPORTED_CONTENT',
    )
    // 根上的 marks/text 是结构违规，不是未知字段。
    expect(codeOf(() => validateDocsContent({ type: 'doc', content: [], marks: [] }))).toBe(
      'DOCS_INVALID_CONTENT',
    )
    expect(codeOf(() => validateDocsContent({ type: 'doc', content: [], text: 'x' }))).toBe(
      'DOCS_INVALID_CONTENT',
    )
  })

  it('accepts a tableRow fully covered by an earlier rowspan', () => {
    const result = validateDocsContent(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [{ type: 'tableCell', attrs: { rowspan: 2 }, content: [p('A')] }],
          },
          { type: 'tableRow', content: [] },
        ],
      } as DocsContentNode),
    )
    expect(JSON.stringify(result.content)).toContain('"rowspan":2')
  })

  it.each([
    [
      'uncovered empty row',
      doc({
        type: 'table',
        content: [
          { type: 'tableRow', content: [{ type: 'tableCell', content: [p('A')] }] },
          { type: 'tableRow', content: [] },
        ],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'zero-width table is structural, not a limit',
      doc({ type: 'table', content: [{ type: 'tableRow', content: [] }] } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'ragged grid',
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [p('A')] },
              { type: 'tableCell', content: [p('B')] },
            ],
          },
          { type: 'tableRow', content: [{ type: 'tableCell', content: [p('C')] }] },
        ],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    // heading level 5 也能通过 ProseMirror schema，只能由值域层拒绝。
    [
      'heading level 5',
      doc({
        type: 'heading',
        attrs: { level: 5 },
        content: [{ type: 'text', text: 'x' }],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    ['unknown node', doc({ type: 'mystery' } as DocsContentNode), 'DOCS_UNSUPPORTED_CONTENT'],
    [
      'persist is not a document attribute',
      doc({
        type: 'details',
        attrs: { open: false, persist: true },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 's' }] },
          { type: 'detailsContent', content: [p('b')] },
        ],
      } as DocsContentNode),
      'DOCS_UNSUPPORTED_CONTENT',
    ],
    [
      'javascript url',
      doc({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'x',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      } as DocsContentNode),
      'DOCS_UNSAFE_CONTENT',
    ],
    [
      'protocol-relative url',
      doc({ type: 'image', attrs: { src: '//evil.test/x' } } as DocsContentNode),
      'DOCS_UNSAFE_CONTENT',
    ],
    [
      'data url is closed in profile 1',
      doc({ type: 'image', attrs: { src: 'data:image/png;base64,AAAA' } } as DocsContentNode),
      'DOCS_UNSAFE_CONTENT',
    ],
    [
      'duplicate marks',
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'bold' }] }],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'code mark excludes others',
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'x', marks: [{ type: 'code' }, { type: 'bold' }] }],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'mention without id',
      doc({
        type: 'paragraph',
        content: [{ type: 'mention', attrs: { id: '  ' } }],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'colwidth length must match colspan',
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', attrs: { colspan: 2, colwidth: [120] }, content: [p('A')] },
            ],
          },
        ],
      } as DocsContentNode),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'cyclic input',
      (() => {
        const node: Record<string, unknown> = { type: 'paragraph' }
        node.content = [node]
        return { type: 'doc', content: [node] } as unknown as DocsContentNode
      })(),
      'DOCS_INVALID_CONTENT',
    ],
    [
      'depth beyond 32',
      (() => {
        let nested: DocsContentNode = p('deep')
        for (let i = 0; i < 40; i += 1)
          nested = { type: 'blockquote', content: [nested] } as DocsContentNode
        return doc(nested)
      })(),
      'DOCS_LIMIT_EXCEEDED',
    ],
    [
      'bytes beyond 8 MiB',
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'x'.repeat(8 * 1024 * 1024 + 1) }],
      } as DocsContentNode),
      'DOCS_LIMIT_EXCEEDED',
    ],
    // 累计网格必须用跨度构造：按单元格铺的话节点数会先撞上 10,000 的节点预算，
    // 断言就会在节点预算上通过，而它声称的累计网格从未被触达。
    // 这里两张表各 60 个 `colspan: 100` 的单元格 = 12,000 虚拟格，节点数不到 400。
    [
      'cumulative grid beyond 10 000 cells',
      doc(
        ...Array.from(
          { length: 2 },
          () =>
            ({
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: Array.from({ length: 60 }, () => ({
                    type: 'tableCell',
                    attrs: { colspan: 100 },
                    content: [p('x')],
                  })),
                },
              ],
            }) as DocsContentNode,
        ),
      ),
      'DOCS_LIMIT_EXCEEDED',
    ],
  ])('rejects %s', (_name, content, expected) => {
    expect(codeOf(() => validateDocsContent(content))).toBe(expected)
  })

  it('normalizes finite colors, font sizes and link rel', () => {
    const result = validateDocsContent(
      doc({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'x',
            marks: [
              { type: 'textStyle', attrs: { color: '#ABC', fontSize: '20px' } },
              { type: 'link', attrs: { href: 'https://example.com', target: '_blank' } },
            ],
          },
        ],
      } as DocsContentNode),
    )
    const json = JSON.stringify(result.content)
    expect(json).toContain('#aabbcc')
    expect(json).toContain('1.25rem')
    expect(json).toContain('"rel":"noopener noreferrer"')
  })

  it('keeps details.open, ordered list types and nested admonitions', () => {
    const result = validateDocsContent(
      doc(
        {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 's' }] },
            { type: 'detailsContent', content: [p('b')] },
          ],
        } as DocsContentNode,
        {
          type: 'orderedList',
          attrs: { start: 3, type: 'i' },
          content: [{ type: 'listItem', content: [p('a')] }],
        } as DocsContentNode,
        {
          type: 'admonition',
          attrs: { type: 'tip' },
          content: [
            {
              type: 'admonitionTitle',
              content: [{ type: 'text', text: 'T', marks: [{ type: 'bold' }] }],
            },
            {
              type: 'admonition',
              attrs: { type: 'info' },
              content: [{ type: 'admonitionTitle' }, p('nested')],
            },
            p('body'),
          ],
        } as DocsContentNode,
      ),
    )
    const json = JSON.stringify(result.content)
    expect(json).toContain('"open":false')
    expect(json).toContain('"type":"i"')
    expect(json).toContain('"type":"tip"')
  })

  it('projects text once per leaf with bounded separators', () => {
    const result = validateDocsContent(
      doc(
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hello' },
            { type: 'mention', attrs: { id: 'u1' } },
          ],
        } as DocsContentNode,
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const a = 1\n' }],
        } as DocsContentNode,
        { type: 'image', attrs: { src: '/a.png', alt: 'Alt' } } as DocsContentNode,
      ),
    )
    expect(result.textContent).toBe('hellou1\nconst a = 1\n\nAlt\n\n')
  })

  it('keeps the returned content identical to the stored snapshot on revalidation', () => {
    const first = validateDocsContent(doc(p('round trip')))
    const second = validateDocsContent(first.content)
    expect(second.content).toEqual(first.content)
  })
})
