// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, flattenExtensions, getSchema, type JSONContent } from '@tiptap/core'
import { createMarkdownExtensions } from './extensions'
import { parseMarkdownContent, serializeMarkdownContent } from './conversion'
import { TIPTAP_LIMITS } from '../conversion/policy'

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
function roundtrip(source: string) {
  const parsed = parseMarkdownContent({ format: 'markdown', content: source })
  expect(parsed).toMatchObject({ ok: true })
  if (!parsed.ok) throw new Error('parse failed')
  const exported = serializeMarkdownContent(parsed.value)
  expect(exported).toMatchObject({ ok: true })
  if (!exported.ok) throw new Error('export failed')
  const again = parseMarkdownContent({ format: 'markdown', content: exported.value })
  expect(again).toMatchObject({ ok: true })
  if (!again.ok) throw new Error('reparse failed')
  expect(serializeMarkdownContent(again.value)).toMatchObject({ ok: true, value: exported.value })
  return { parsed: parsed.value, markdown: exported.value }
}

describe('pure GFM preset and conversion', () => {
  it('uses independent, equal schemas without duplicate names or rich-only content', () => {
    const extensions = ['editing', 'viewing', 'conversion'].map((purpose) =>
      createMarkdownExtensions({ purpose: purpose as 'editing' }),
    )
    expect(extensions[0]![0]).not.toBe(extensions[1]![0])
    const schemas = extensions.map((list) => getSchema(list))
    expect(JSON.stringify(schemas[0]!.spec.nodes.toObject())).toBe(
      JSON.stringify(schemas[1]!.spec.nodes.toObject()),
    )
    expect(JSON.stringify(schemas[1]!.spec.nodes.toObject())).toBe(
      JSON.stringify(schemas[2]!.spec.nodes.toObject()),
    )
    for (const list of extensions) {
      const names = flattenExtensions(list).map((extension) => extension.name)
      expect(new Set(names).size).toBe(names.length)
    }
    expect(Object.keys(schemas[0]!.nodes)).not.toContain('details')
    expect(Object.keys(schemas[0]!.marks)).not.toContain('underline')
    expect(Object.keys(schemas[0]!.nodes.image!.spec.attrs!)).toEqual(['src', 'alt', 'title'])
    expect(Object.keys(schemas[0]!.marks.link!.spec.attrs!)).toEqual(['href', 'title'])
  })
  it('roundtrips headings, nested lists, task state, fences, inline images, aligned tables and Emoji', () => {
    roundtrip(
      '# H1\n\n###### H6\n\n- outer\n  - inner\n\n- [x] checked 👩🏽‍💻\n- [ ] pending\n\n> quote **bold** *italic* ~~strike~~ `code`\n\n```js\n<div>literal</div>\n```\n\nBefore ![a](https://example.test/image.png) after\n\n| A | B |\n| :--- | ---: |\n| **bold** | ![x](/a.png) |\n\n---',
    )
  })
  it.each(['<b>raw</b>', '<!-- comment -->', '| A |\n| --- |\n| <i>raw</i> |'])(
    'rejects raw HTML %s',
    (content) => {
      expect(parseMarkdownContent({ format: 'markdown', content })).toMatchObject({
        ok: false,
        issues: [{ code: 'unsupported-content' }],
      })
    },
  )
  it('allows autolinks and literal HTML inside code', () => {
    roundtrip('<https://example.test> and ` <b> `\n\n```html\n<b>x</b>\n```')
  })
  it.each([
    doc({ ...paragraph('x'), extra: true }),
    doc({ type: 'paragraph', attrs: { textAlign: 'left' } }),
    doc({
      type: 'paragraph',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'underline' }] }],
    }),
    doc({ type: 'paragraph', content: [{ type: 'image', attrs: { src: '/a.png', width: 5 } }] }),
  ])('rejects unsupported JSON before schema discards it', (content) => {
    expect(parseMarkdownContent({ format: 'json', content })).toMatchObject({
      ok: false,
      issues: [{ code: 'unsupported-content' }],
    })
  })
  it('rejects image command dimensions before schema discards them', () => {
    const editor = new Editor({ extensions: createMarkdownExtensions({ purpose: 'editing' }) })
    expect(editor.commands.setImage({ src: '/a.png', width: 5 })).toBe(false)
    expect(editor.state.doc.textContent).toBe('')
    editor.destroy()
  })
  it('preserves special image/link strings and code fence text', () => {
    const content = doc(
      {
        type: 'paragraph',
        content: [
          {
            type: 'image',
            attrs: { src: 'https://example.test/a(b).png', alt: 'a [b] \\ c', title: 'a "b" \\ c' },
          },
          {
            type: 'text',
            text: 'a [link]',
            marks: [
              { type: 'link', attrs: { href: 'https://example.test/a(b)', title: 'say "hi"' } },
            ],
          },
        ],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'js' },
        content: [{ type: 'text', text: '```\n<div> 👩🏽‍💻\n' }],
      },
    )
    const exported = serializeMarkdownContent(content)
    expect(exported).toMatchObject({ ok: true })
    if (exported.ok) roundtrip(exported.value)
  })
  it.each([
    '# plain',
    '> plain',
    '- plain',
    '1. plain',
    '---',
    '```plain',
    '    indent',
    '\tindent',
    'inside\ttab',
    'a <b> & c',
  ])('keeps ordinary paragraph text %s', (text) => {
    const exported = serializeMarkdownContent(doc(paragraph(text)))
    expect(exported).toMatchObject({ ok: true })
    if (exported.ok) {
      const parsed = parseMarkdownContent({ format: 'markdown', content: exported.value })
      expect(parsed).toMatchObject({
        ok: true,
        value: { content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
      })
    }
  })
  it('normalizes empty layout and mark edges while keeping characters', () => {
    expect(
      serializeMarkdownContent(
        doc({ type: 'heading', attrs: { level: 6 } }, { type: 'paragraph' }),
      ),
    ).toMatchObject({ ok: true, value: '', notices: [{ code: 'normalized-content' }] })
    const content = doc({
      type: 'paragraph',
      content: [{ type: 'text', text: ' bold ', marks: [{ type: 'bold' }] }],
    })
    expect(serializeMarkdownContent(content)).toMatchObject({
      ok: true,
      value: expect.any(String),
      notices: [{ code: 'normalized-content' }],
    })
    expect(content.content![0]!.content![0]!.text).toBe(' bold ')
  })
  it('normalizes unlinked GFM autolinks without swallowing punctuation', () => {
    const exported = serializeMarkdownContent(
      doc(paragraph('See https://example.test/path). a@example.test!')),
    )
    expect(exported).toMatchObject({ ok: true })
    if (exported.ok) roundtrip(exported.value)
  })
  it('preserves inline code ticks/spaces and GFM table pipes including images and links', () => {
    roundtrip(
      '`` a`b `` and ```x``y```\n\n| A | B |\n| --- | --- |\n| `a\\|b` | ![a\\|b](<https://example.test/a\\|b.png>) [x](<https://example.test/a\\|b>) |',
    )
  })
  it('supports image commands with omitted alt/title defaults', () => {
    const editor = new Editor({ extensions: createMarkdownExtensions({ purpose: 'editing' }) })
    expect(editor.commands.setImage({ src: '/a.png' })).toBe(true)
    expect(serializeMarkdownContent(editor.getJSON())).toMatchObject({ ok: true })
    editor.destroy()
  })
  it('normalizes only table edge spaces, rejects internal Unicode whitespace losses', () => {
    const source = parseMarkdownContent({ format: 'markdown', content: '| A |\n| --- |\n| B |' })
    if (!source.ok) throw new Error('fixture')
    const text = source.value.content![0]!.content![1]!.content![0]!.content![0]!.content![0]!
    text.text = ' B '
    expect(serializeMarkdownContent(source.value)).toMatchObject({
      ok: true,
      notices: [{ code: 'normalized-content' }],
    })
    for (const loss of ['B\u00a0C', 'B\u001fC', 'B\u2003C', 'B\nC']) {
      text.text = loss
      expect(serializeMarkdownContent(source.value)).toMatchObject({
        ok: false,
        issues: [{ code: 'conversion-failed' }],
      })
    }
    text.text = 'B\tC'
    expect(serializeMarkdownContent(source.value)).toMatchObject({ ok: true })
  })
  it('rejects cyclic/prototyped JSON, unsafe URLs, excessive nodes/depth/bytes', () => {
    const cyclic: JSONContent = doc()
    cyclic.content = [cyclic]
    expect(parseMarkdownContent({ format: 'json', content: cyclic })).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-content' }],
    })
    expect(
      parseMarkdownContent({ format: 'json', content: Object.create({ type: 'doc' }) }),
    ).toMatchObject({ ok: false, issues: [{ code: 'invalid-content' }] })
    expect(
      parseMarkdownContent({
        format: 'json',
        content: doc({
          type: 'paragraph',
          content: [{ type: 'image', attrs: { src: 'javascript:bad' } }],
        }),
      }),
    ).toMatchObject({ ok: false, issues: [{ code: 'unsafe-content' }] })
    expect(
      parseMarkdownContent({
        format: 'json',
        content: doc(...Array.from({ length: TIPTAP_LIMITS.nodes }, () => ({ type: 'paragraph' }))),
      }),
    ).toMatchObject({ ok: false, issues: [{ code: 'limit-exceeded' }] })
    let nested = paragraph('x')
    for (let i = 0; i < 33; i++) nested = { type: 'blockquote', content: [nested] }
    expect(parseMarkdownContent({ format: 'json', content: doc(nested) })).toMatchObject({
      ok: false,
      issues: [{ code: 'limit-exceeded' }],
    })
    expect(
      parseMarkdownContent({ format: 'markdown', content: 'x'.repeat(TIPTAP_LIMITS.bytes + 1) }),
    ).toMatchObject({ ok: false, issues: [{ code: 'limit-exceeded' }] })
  })
  it('preserves overlapping inline marks and code whitespace', () => {
    const content = doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'b', marks: [{ type: 'bold' }, { type: 'italic' }] },
        { type: 'text', text: 'c', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' \t code \t ', marks: [{ type: 'code' }] },
      ],
    })
    expect(serializeMarkdownContent(content)).toMatchObject({ ok: true })
  })
  it.each(['a*b*c', '中*文*字', 'a*(b)*c', '*first*, *second*', '**a *b* c**', '_a **b** c_'])(
    'exports valid context-sensitive italic %s',
    (source) => {
      roundtrip(source)
    },
  )
  it.each([
    'x***a***y',
    '中***粗斜***字',
    '😀***a***😀',
    '*a*\u0301',
    '\u0301*a*',
    '***a***\u0301',
    '\u0301***a***',
    'a*e\u0301*c',
    '😀*a*😀',
    '**a**_b_c',
    'a*b***c**',
    '**a***b*c',
    'a*b*`c`',
    '`a`*b*c',
    '[a](/x)*b*c',
    'a*b*[c](/x)',
    '*a*~~b~~c',
    '~~a~~*b*c',
    'a*‧*b',
    'a *b*!',
  ])('retains real outer GFM boundary context %s', (source) => {
    roundtrip(source)
  })
  it('keeps word-internal combined marks as both bold and italic', () => {
    const { parsed } = roundtrip('x***a***y')
    expect(parsed.content![0]!.content![1]!.marks).toEqual([{ type: 'bold' }, { type: 'italic' }])
  })
})
