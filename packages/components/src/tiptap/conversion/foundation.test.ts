// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, flattenExtensions, getSchema, type JSONContent } from '@tiptap/core'
import { marked } from 'marked'
import { parseTiptapContent, serializeTiptapMarkdown } from './index'
import { createTiptapExtensions } from '../extensions'
import { createIsolatedMarked } from './marked'

const p = (text?: string): JSONContent => ({
  type: 'paragraph',
  ...(text ? { content: [{ type: 'text', text }] } : {}),
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
function roundtrip(content: JSONContent) {
  const normalized = parseTiptapContent({ format: 'json', content })
  expect(normalized.ok).toBe(true)
  const exported = serializeTiptapMarkdown(content)
  expect(exported).toMatchObject({ ok: true })
  if (!exported.ok || !normalized.ok) throw new Error('Expected successful conversion')
  expect(parseTiptapContent({ format: 'markdown', content: exported.value })).toMatchObject({
    ok: true,
    value: normalized.value,
  })
  return exported.value
}

describe('Tiptap conversion foundation', () => {
  it('isolates complete callable Marked facades and dynamically follows defaults', () => {
    const before = marked.defaults
    const a = createIsolatedMarked(),
      b = createIsolatedMarked()
    a.setOptions({ breaks: true })
    a.use({
      extensions: [
        {
          name: 'probe',
          level: 'inline',
          tokenizer: (src) =>
            src.startsWith('!!') ? { type: 'text', raw: '!!', text: 'isolated' } : undefined,
        },
      ],
    })
    expect(a.defaults.breaks).toBe(true)
    expect(b.defaults.breaks).toBe(false)
    expect(JSON.stringify(a.lexer('!!'))).toContain('isolated')
    expect(b('plain', { async: false })).toContain('plain')
    expect(marked.defaults).toBe(before)
    expect(b.getDefaults()).toBeDefined()
  })
  it('uses unique extension names and identical schemas for all purposes', () => {
    const sets = (['editing', 'viewing', 'conversion'] as const).map((purpose) =>
      createTiptapExtensions({ purpose }),
    )
    for (const extensions of sets) {
      const names = flattenExtensions(extensions).map((extension) => extension.name)
      expect(new Set(names).size).toBe(names.length)
    }
    const signatures = sets.map((extensions) => {
      const schema = getSchema(extensions)
      const meaningful = (spec: Record<string, unknown>) =>
        Object.fromEntries(
          [
            'content',
            'marks',
            'group',
            'inline',
            'atom',
            'selectable',
            'draggable',
            'code',
            'whitespace',
            'defining',
            'isolating',
            'inclusive',
            'excludes',
            'spanning',
            'attrs',
          ].map((key) => [key, spec[key]]),
        )
      return {
        nodes: Object.fromEntries(
          Object.entries(schema.nodes).map(([name, type]) => [name, meaningful(type.spec)]),
        ),
        marks: Object.fromEntries(
          Object.entries(schema.marks).map(([name, type]) => [name, meaningful(type.spec)]),
        ),
      }
    })
    expect(signatures[0]).toEqual(signatures[1])
    expect(signatures[1]).toEqual(signatures[2])
  })
  it('normalizes only the required trailing paragraph and keeps other empty paragraphs', () => {
    expect(parseTiptapContent({ format: 'json', content: doc() })).toMatchObject({
      ok: true,
      value: doc(p()),
    })
    roundtrip(doc(p(), p('body'), p(), p()))
    roundtrip(
      doc({ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'heading' }] }),
    )
  })
  it.each([
    doc({ type: 'paragraph', attrs: { unknown: true } }),
    doc({ type: 'paragraph', secret: true } as JSONContent),
    doc({ type: 'heading', attrs: { level: 5 } }),
    doc({ type: 'details', attrs: { open: 'true' } }),
    doc({ type: 'image', attrs: { src: '//example.com/x' } }),
    doc({ type: 'mention', attrs: { id: '' } }),
    doc({ type: 'admonitionTitle' }),
    doc(p('x'), { type: 'text', text: 'bad' }),
    doc({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'x',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        },
      ],
    }),
  ])('rejects invalid JSON before permissive official parsing: %j', (content) => {
    expect(parseTiptapContent({ format: 'json', content }).ok).toBe(false)
  })
  it.each([
    '<script>alert(1)</script>',
    '<p onclick="x">x</p>',
    '<p data-surprise="x">x</p>',
    '<iframe></iframe>',
    '<img src="https://example.com/x" srcset="x">',
    '##### h5',
    '<div>unknown</div>',
    '<p style="color:var(--x)">x</p>',
    '::: unknown\nx\n:::',
    '::: info\nnot closed',
  ])('rejects unsafe or unsupported markdown atomically: %s', (content) => {
    expect(parseTiptapContent({ format: 'markdown', content }).ok).toBe(false)
  })
  it('preserves literal HTML inside code and escaped ordinary text', () => {
    roundtrip(
      doc({
        type: 'codeBlock',
        attrs: { language: 'html' },
        content: [{ type: 'text', text: '<script>literal</script>\n```\n' }],
      }),
    )
    expect(
      parseTiptapContent({ format: 'markdown', content: '\\<script>ordinary\\</script>' }).ok,
    ).toBe(true)
  })
  it.each([
    '1. a',
    '2) a',
    '# title',
    '> quote',
    '- item',
    '---',
    '::: info',
    ' ',
    ' \t ',
    'a\n\nb',
    'a\n \nb',
  ])('roundtrips literal paragraph text without interpreting syntax or layout: %j', (text) => {
    roundtrip(doc(p(text)))
  })
  it('does not silently normalize literal CRLF paragraph text during export', () => {
    expect(serializeTiptapMarkdown(doc(p('a\r\nb')))).toMatchObject({
      ok: false,
      issues: [{ code: 'conversion-failed' }],
    })
  })
  it('roundtrips lists, tasks, marks, hard breaks and ordered start', () => {
    roundtrip(
      doc(
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [{ type: 'listItem', content: [p('first')] }],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [
                p('done'),
                {
                  type: 'taskList',
                  content: [
                    { type: 'taskItem', attrs: { checked: false }, content: [p('nested')] },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold',
              marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'strike' }],
            },
            { type: 'hardBreak' },
            { type: 'text', text: 'end' },
          ],
        },
        { type: 'horizontalRule' },
      ),
    )
  })
  it('roundtrips complete controlled HTML subtrees and identities', () => {
    const output = roundtrip(
      doc(
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'styled',
              marks: [
                {
                  type: 'textStyle',
                  attrs: { color: '#ff0000', fontSize: '1.25rem', backgroundColor: '#00ff00' },
                },
                { type: 'underline' },
                { type: 'bold' },
              ],
            },
            { type: 'mention', attrs: { id: 'a&b', label: 'A < B', mentionSuggestionChar: '@' } },
          ],
        },
        { type: 'image', attrs: { src: '/image.png', width: 320, height: 200, alt: 'A < B' } },
        {
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'summary' }] },
            { type: 'detailsContent', content: [p('body')] },
          ],
        },
      ),
    )
    expect(output).toContain('<details open="">')
    expect(output).toContain('data-id="a&amp;b"')
    expect(output).not.toContain('**styled**')
  })
  it('normalizes finite colors/sizes and checks raster data signatures', () => {
    const result = parseTiptapContent({
      format: 'markdown',
      content: '<p><span style="color: rgb(255, 0, 0); font-size: 20px">red</span></p>',
    })
    expect(result).toMatchObject({
      ok: true,
      value: {
        content: [
          {
            content: [
              { marks: [{ type: 'textStyle', attrs: { color: '#ff0000', fontSize: '1.25rem' } }] },
            ],
          },
        ],
      },
    })
    const fake = doc({ type: 'image', attrs: { src: 'data:image/png;base64,PHN2Zz4=' } })
    expect(
      parseTiptapContent({ format: 'json', content: fake }, { allowRasterDataImages: true }).ok,
    ).toBe(false)
  })
  it('roundtrips nested admonitions with empty titles and code containing fences', () => {
    const content = doc({
      type: 'admonition',
      attrs: { type: 'tip' },
      content: [
        {
          type: 'admonitionTitle',
          content: [
            { type: 'text', text: 'Title', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
            { type: 'text', text: 'next' },
          ],
        },
        {
          type: 'admonition',
          attrs: { type: 'info' },
          content: [{ type: 'admonitionTitle' }, p('nested')],
        },
        { type: 'codeBlock', content: [{ type: 'text', text: '::: warning\n:::' }] },
        p(':::'),
      ],
    })
    expect(roundtrip(content)).toContain(':::: tip')
  })
  it('wraps, switches and unwraps the current admonition in undoable transactions', () => {
    const editor = new Editor({
      extensions: createTiptapExtensions({ purpose: 'editing' }),
      content: doc(p('body'), p('after')),
    })
    expect(editor.commands.setAdmonition('tip')).toBe(true)
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'admonition',
      attrs: { type: 'tip' },
    })
    expect(editor.commands.setAdmonition('warning')).toBe(true)
    expect(editor.commands.unsetAdmonition()).toBe(true)
    expect(editor.getText()).toContain('提示')
    expect(editor.getText()).toContain('body')
    expect(editor.commands.undo()).toBe(true)
    editor.destroy()
  })
  it('rejects excessive bytes, nodes and nesting before official conversion', () => {
    expect(
      parseTiptapContent({ format: 'markdown', content: 'a'.repeat(8 * 1024 * 1024 + 1) }),
    ).toMatchObject({ ok: false, issues: [{ code: 'limit-exceeded' }] })
    expect(
      parseTiptapContent({
        format: 'json',
        content: doc(...Array.from({ length: 10_001 }, () => p())),
      }),
    ).toMatchObject({ ok: false, issues: [{ code: 'limit-exceeded' }] })
    let nested = p('deep')
    for (let i = 0; i < 33; i++) nested = { type: 'blockquote', content: [nested] }
    expect(parseTiptapContent({ format: 'json', content: doc(nested) })).toMatchObject({
      ok: false,
      issues: [{ code: 'limit-exceeded' }],
    })
  })
})
