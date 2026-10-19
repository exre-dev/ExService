// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { createTiptapExtensions } from '../extensions'
import { parseTiptapContent, parseTiptapHTML, serializeTiptapMarkdown } from './index'
import { isSafeTiptapUrl } from './policy'

describe('strict content boundaries', () => {
  it.each([
    '<a href="/destination"><img src="/image.png"></a>',
    '<p><a href="/destination"><strong><img src="/image.png"></strong></a></p>',
    '<a href="/a"><a href="/b">inner</a><img src="/x"></a>',
    '<details><summary><p>Title</p></summary><div data-type="detailsContent"><p>Body</p></div></details>',
    '<details><summary><span><p>Title</p></span></summary><div data-type="detailsContent"><p>Body</p></div></details>',
  ])('rejects HTML whose image link or summary structure cannot be retained: %s', (html) => {
    expect(parseTiptapHTML(html)).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-content' }],
    })
    expect(parseTiptapContent({ format: 'markdown', content: html })).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-content' }],
    })
  })
  it.each(
    ['spaces', 'backslash'].flatMap((syntax) =>
      ['image-first', 'image-last', 'surrounded'].map((position) => ({ syntax, position })),
    ),
  )(
    'preserves exact hardBreak paragraph edges with $syntax syntax and $position image',
    ({ syntax, position }) => {
      const hardBreak = syntax === 'spaces' ? '  \n' : '\\\n'
      const text = (value: string, mark?: string): JSONContent => ({
        type: 'text',
        text: value,
        ...(mark ? { marks: [{ type: mark }] } : {}),
      })
      const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
      const image: JSONContent = { type: 'image', attrs: { src: '/x', alt: 'x' } }
      const br: JSONContent = { type: 'hardBreak' }
      const markdown =
        position === 'image-first'
          ? `![x](/x)${hardBreak}**after**`
          : position === 'image-last'
            ? `**before**${hardBreak}![x](/x) after`
            : `**before** ![x](/x)${hardBreak}*after*`
      const expectedBlocks =
        position === 'image-first'
          ? [image, paragraph(br, text('after', 'bold'))]
          : position === 'image-last'
            ? [paragraph(text('before', 'bold'), br), image, paragraph(text(' after'))]
            : [
                paragraph(text('before', 'bold'), text(' ')),
                image,
                paragraph(br, text('after', 'italic')),
              ]
      const expected = parseTiptapContent({
        format: 'json',
        content: { type: 'doc', content: expectedBlocks },
      })
      const imported = parseTiptapContent({ format: 'markdown', content: markdown })
      expect(expected.ok).toBe(true)
      expect(imported.ok).toBe(true)
      if (!expected.ok || !imported.ok) return
      expect(imported.value).toEqual(expected.value)
      const exported = serializeTiptapMarkdown(imported.value)
      expect(exported).toMatchObject({ ok: true })
      if (exported.ok)
        expect(parseTiptapContent({ format: 'markdown', content: exported.value })).toMatchObject({
          ok: true,
          value: expected.value,
        })
    },
  )
  it.each(['a  b', ' leading', 'trailing ', 'a\nb', 'a\tb', '  a\n\tb  '])(
    'retains exact HTML-island whitespace across blocks, containers and titles: %j',
    (text) => {
      const paragraph: JSONContent = {
        type: 'paragraph',
        content: [{ type: 'text', text, marks: [{ type: 'underline' }] }],
      }
      const title: JSONContent = {
        type: 'admonitionTitle',
        content: [{ type: 'text', text, marks: [{ type: 'underline' }] }],
      }
      const input: JSONContent = {
        type: 'doc',
        content: [
          paragraph,
          {
            type: 'details',
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text }] },
              { type: 'detailsContent', content: [paragraph] },
            ],
          },
          { type: 'admonition', attrs: { type: 'tip' }, content: [title, paragraph] },
          {
            type: 'admonition',
            attrs: { type: 'info' },
            content: [{ type: 'admonitionTitle', content: [{ type: 'text', text }] }, paragraph],
          },
          { type: 'paragraph' },
        ],
      }
      const normalized = parseTiptapContent({ format: 'json', content: input })
      const output = serializeTiptapMarkdown(input)
      expect(output).toMatchObject({ ok: true })
      if (output.ok && normalized.ok)
        expect(parseTiptapContent({ format: 'markdown', content: output.value })).toMatchObject({
          ok: true,
          value: normalized.value,
        })
      expect(parseTiptapHTML(`<p>${text}</p>`)).toMatchObject({
        ok: true,
        value: { content: [{ content: [{ type: 'text', text }] }] },
      })
    },
  )
  it('ignores only structural HTML formatting whitespace, keeping textblock whitespace', () => {
    expect(
      parseTiptapHTML(
        '\n<details>\n  <summary>  title\t </summary>\n  <div data-type="detailsContent">\n    <p>  body\n </p>\n  </div>\n</details>\n',
      ),
    ).toMatchObject({
      ok: true,
      value: {
        content: [
          {
            type: 'details',
            content: [
              { type: 'detailsSummary', content: [{ text: '  title\t ' }] },
              {
                type: 'detailsContent',
                content: [{ type: 'paragraph', content: [{ text: '  body\n ' }] }],
              },
            ],
          },
          { type: 'paragraph' },
        ],
      },
    })
  })
  it('retains whitespace between inline HTML islands in an implicit paragraph', () => {
    const html = '<span>a</span> \t <strong>b</strong>'
    const expected = {
      ok: true,
      value: {
        content: [
          {
            type: 'paragraph',
            content: [{ text: 'a \t ' }, { text: 'b', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    }
    expect(parseTiptapHTML(html)).toMatchObject(expected)
    expect(parseTiptapContent({ format: 'markdown', content: html })).toMatchObject(expected)
  })
  it.each([
    '<p><code class="language-js">inline</code></p>',
    '<p><mark style="color:#ff0000">red</mark></p>',
    '<p><mark data-color="#aabbcc" style="background-color:#aabbcc;color:#ff0000">red</mark></p>',
  ])('rejects attributes at schema-inexpressible locations: %s', (html) => {
    expect(parseTiptapHTML(html).ok).toBe(false)
    expect(parseTiptapContent({ format: 'markdown', content: html }).ok).toBe(false)
  })
  it('keeps codeBlock language and nested TextStyle/Highlight combinations', () => {
    expect(parseTiptapHTML('<pre><code class="language-js"> x\n</code></pre>')).toMatchObject({
      ok: true,
      value: {
        content: [
          { type: 'codeBlock', attrs: { language: 'js' }, content: [{ text: ' x\n' }] },
          { type: 'paragraph' },
        ],
      },
    })
    expect(
      parseTiptapHTML(
        '<p><mark data-color="#aabbcc" style="background-color:#aabbcc;color:inherit"><span style="color:#ff0000">red</span></mark></p>',
      ),
    ).toMatchObject({
      ok: true,
      value: {
        content: [
          {
            content: [
              {
                marks: expect.arrayContaining([
                  { type: 'highlight', attrs: { color: '#aabbcc' } },
                  expect.objectContaining({
                    type: 'textStyle',
                    attrs: expect.objectContaining({ color: '#ff0000' }),
                  }),
                ]),
              },
            ],
          },
        ],
      },
    })
  })
  it.each([
    '<div data-type="admonitionTitle">A</div><div data-type="admonitionTitle">B</div><p>C</p>',
    '<p>C</p><div data-type="admonitionTitle">B</div>',
    '<div data-type="admonitionTitle">A</div><summary>invalid body</summary>',
    '<div data-type="admonitionTitle"><p>invalid title block</p></div><p>C</p>',
    '<div data-type="admonitionTitle"><span><p>nested invalid block</p></span></div><p>C</p>',
  ])('rejects malformed Admonition content before schema repair: %s', (inside) => {
    const html = `<aside data-type="admonition" data-admonition-type="info">${inside}</aside>`
    expect(parseTiptapHTML(html).ok).toBe(false)
    expect(parseTiptapContent({ format: 'markdown', content: html }).ok).toBe(false)
  })
  it('rejects duplicate/late JSON titles and preserves legal nested containers', () => {
    const title: JSONContent = { type: 'admonitionTitle' },
      paragraph: JSONContent = { type: 'paragraph' }
    for (const content of [
      [title, title, paragraph],
      [paragraph, title],
      [title, paragraph, title, paragraph],
    ])
      expect(
        parseTiptapContent({
          format: 'json',
          content: { type: 'doc', content: [{ type: 'admonition', content }] },
        }).ok,
      ).toBe(false)
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'admonition',
          content: [title, { type: 'admonition', content: [title, paragraph] }],
        },
        paragraph,
      ],
    }
    const output = serializeTiptapMarkdown(json)
    expect(output).toMatchObject({ ok: true })
    const normalized = parseTiptapContent({ format: 'json', content: json })
    if (output.ok && normalized.ok)
      expect(parseTiptapContent({ format: 'markdown', content: output.value })).toMatchObject({
        ok: true,
        value: normalized.value,
      })
  })
  it.each([
    '<p>x</p onclick="x">',
    '<p>x</p data-unknown="x">',
    '<p>x</p title="discarded">',
    '<p>x</p/>',
    '<p data-unknown="x">x</p>',
    '<p><strong>x</strong data-unknown="x"></p>',
  ])('rejects original tag attributes before parser repair: %s', (html) => {
    expect(parseTiptapHTML(html).ok).toBe(false)
    expect(parseTiptapContent({ format: 'markdown', content: html }).ok).toBe(false)
  })
  it.each([9997, 9998, 9999])(
    'checks final normalized node count at the boundary with %i empty paragraphs',
    (count) => {
      const content: JSONContent = {
        type: 'doc',
        content: [
          ...Array.from({ length: count }, () => ({ type: 'paragraph' })),
          { type: 'heading', attrs: { level: 1 } },
        ],
      }
      const parsed = parseTiptapContent({ format: 'json', content })
      if (count === 9997) {
        expect(parsed.ok).toBe(true)
        if (parsed.ok)
          expect(parseTiptapContent({ format: 'json', content: parsed.value }).ok).toBe(true)
      } else expect(parsed).toMatchObject({ ok: false, issues: [{ code: 'limit-exceeded' }] })
    },
  )
  it('checks final normalized UTF-8 bytes after adding the trailing paragraph', () => {
    const make = (text: string): JSONContent => ({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: null },
          content: [{ type: 'text', text }],
        },
      ],
    })
    const overhead = new TextEncoder().encode(JSON.stringify(make(''))).length
    const content = make('x'.repeat(8 * 1024 * 1024 - overhead))
    expect(new TextEncoder().encode(JSON.stringify(content)).length).toBe(8 * 1024 * 1024)
    expect(parseTiptapContent({ format: 'json', content })).toMatchObject({
      ok: false,
      issues: [{ code: 'limit-exceeded' }],
    })
    const smaller = make('x'.repeat(8 * 1024 * 1024 - overhead - 100))
    const parsed = parseTiptapContent({ format: 'json', content: smaller })
    expect(parsed.ok).toBe(true)
    if (parsed.ok)
      expect(parseTiptapContent({ format: 'json', content: parsed.value }).ok).toBe(true)
  })
  it.each([-1, 0, 1])('enforces final normalized byte boundary %+i', (offset) => {
    const empty: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: null },
          content: [{ type: 'text', text: '' }],
        },
        { type: 'paragraph', attrs: { textAlign: null } },
      ],
    }
    const overhead = new TextEncoder().encode(JSON.stringify(empty)).length
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1, textAlign: null },
          content: [{ type: 'text', text: 'x'.repeat(8 * 1024 * 1024 - overhead + offset) }],
        },
      ],
    }
    const parsed = parseTiptapContent({ format: 'json', content: input })
    expect(parsed.ok).toBe(offset <= 0)
    if (parsed.ok) {
      expect(new TextEncoder().encode(JSON.stringify(parsed.value)).length).toBe(
        8 * 1024 * 1024 + offset,
      )
      expect(parseTiptapContent({ format: 'json', content: parsed.value }).ok).toBe(true)
    } else expect(parsed).toMatchObject({ issues: [{ code: 'limit-exceeded' }] })
  })
  it.each([
    '![x](/x) **after**',
    '**before** ![x](/x) *after*',
    '**before** ![x](/x)',
    '![x](/x)![y](/y)',
    '**before ![x](/x) after**',
  ])('lifts Markdown block images with surrounding order and Marks: %s', (markdown) => {
    const parsed = parseTiptapContent({ format: 'markdown', content: markdown })
    expect(parsed).toMatchObject({ ok: true })
    if (parsed.ok) {
      const output = serializeTiptapMarkdown(parsed.value)
      expect(output).toMatchObject({ ok: true })
      if (output.ok)
        expect(parseTiptapContent({ format: 'markdown', content: output.value })).toMatchObject({
          ok: true,
          value: parsed.value,
        })
      const flat = parsed.value.content ?? []
      expect(flat.filter((node) => node.type === 'image').map((node) => node.attrs?.src)).toEqual(
        markdown.includes('/y') ? ['/x', '/y'] : ['/x'],
      )
      expect(
        flat
          .flatMap((node) => node.content ?? [])
          .filter((node) => node.text?.includes('before') || node.text?.includes('after'))
          .every((node) => node.marks?.length),
      ).toBe(true)
      const sequence = flat.flatMap((node) =>
        node.type === 'image'
          ? [`image:${node.attrs?.src}`]
          : (node.content ?? []).map(
              (leaf) => `${leaf.text}:${leaf.marks?.map((mark) => mark.type).join(',') ?? ''}`,
            ),
      )
      const expected: Record<string, string[]> = {
        '![x](/x) **after**': ['image:/x', ' :', 'after:bold'],
        '**before** ![x](/x) *after*': ['before:bold', ' :', 'image:/x', ' :', 'after:italic'],
        '**before** ![x](/x)': ['before:bold', ' :', 'image:/x'],
        '![x](/x)![y](/y)': ['image:/x', 'image:/y'],
        '**before ![x](/x) after**': ['before :bold', 'image:/x', ' after:bold'],
      }
      expect(sequence).toEqual(expected[markdown])
    }
  })
  it.each([
    '> **before** ![x](/x) *after*',
    '- **before** ![x](/x) *after*',
    '1. ![x](/x) **after**',
    '- [x] ![x](/x) **after**',
    '::: tip Title\n**before** ![x](/x) *after*\n:::',
  ])('lifts images through supported Markdown containers: %s', (markdown) => {
    const parsed = parseTiptapContent({ format: 'markdown', content: markdown })
    expect(parsed).toMatchObject({ ok: true })
    if (parsed.ok) {
      expect(JSON.stringify(parsed.value)).toContain('"src":"/x"')
      const output = serializeTiptapMarkdown(parsed.value)
      expect(output).toMatchObject({ ok: true })
      if (output.ok)
        expect(parseTiptapContent({ format: 'markdown', content: output.value })).toMatchObject({
          ok: true,
          value: parsed.value,
        })
    }
  })
  it.each([
    '<html lang="en"><body>lost</body></html>',
    '<p>text</p><tr><td>lost</td></tr>',
    '<details><summary>s</summary><p>missing wrapper</p></details>',
    '<div data-type="admonitionTitle">orphan</div>',
    '<div data-type="detailsContent"><p>orphan</p></div>',
    '<p><span data-type="mention" data-id="42">different text</span></p>',
    '<ul data-type="taskList"><li>not a task</li></ul>',
    '<summary>orphan</summary>',
    '<p><input type="checkbox"></p>',
    '<mark data-color="#fff" style="background-color:#000; color:inherit">mismatch</mark>',
    '<p><a href="/safe" data-x="unexpected">x</a></p>',
  ])('rejects HTML that an official parser would silently drop: %s', (content) => {
    expect(parseTiptapContent({ format: 'markdown', content }).ok).toBe(false)
  })
  it('provides a result-based HTML entry for paste/drop with identical schema/policy', () => {
    expect(parseTiptapHTML('<p><strong>paste</strong></p>')).toMatchObject({
      ok: true,
      value: {
        content: [{ type: 'paragraph', content: [{ text: 'paste', marks: [{ type: 'bold' }] }] }],
      },
    })
    expect(parseTiptapHTML('<img src="javascript:evil">')).toMatchObject({ ok: false })
  })
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    '//evil.test/x',
    'https://user:password@example.com/x',
    '/\\evil.test/x',
    '/a\nb',
    'blob:https://example.com/a',
    'ftp://example.com/x',
  ])('shares the exact URL guard for link and image commands: %s', (value) => {
    expect(isSafeTiptapUrl(value, 'link')).toBe(false)
    expect(isSafeTiptapUrl(value, 'image')).toBe(false)
  })
  it('allows verified raster data only with an explicit policy', () => {
    const src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII='
    expect(isSafeTiptapUrl(src, 'image')).toBe(false)
    expect(isSafeTiptapUrl(src, 'image', { allowRasterDataImages: true })).toBe(true)
    const content = { type: 'doc', content: [{ type: 'image', attrs: { src } }] }
    expect(serializeTiptapMarkdown(content, { allowRasterDataImages: true }).ok).toBe(true)
  })
  it('keeps marks, task state and list type in complete HTML ancestors', () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { start: 9, type: 'A' },
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'highlight',
                      marks: [{ type: 'highlight', attrs: { color: '#aabbcc' } }],
                    },
                  ],
                },
                {
                  type: 'taskList',
                  content: [
                    {
                      type: 'taskItem',
                      attrs: { checked: true },
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const output = serializeTiptapMarkdown(content)
    expect(output).toMatchObject({ ok: true })
    if (output.ok) {
      expect(output.value).toContain('<ol start="9" type="A">')
      expect(output.value).toContain('readonly')
      expect(parseTiptapContent({ format: 'markdown', content: output.value }).ok).toBe(true)
    }
  })
  it('keeps read-only task and details DOM interactions outside document state', () => {
    const editor = new Editor({
      editable: false,
      extensions: createTiptapExtensions({ purpose: 'viewing' }),
      content: {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] },
            ],
          },
          {
            type: 'details',
            attrs: { open: false },
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text: 'Summary' }] },
              {
                type: 'detailsContent',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
              },
            ],
          },
          { type: 'paragraph' },
        ],
      },
    })
    const before = editor.getJSON()
    const checkbox = editor.view.dom.querySelector('input')!
    checkbox.click()
    editor.view.dom.querySelector<HTMLButtonElement>('button')!.click()
    expect(editor.getJSON()).toEqual(before)
    expect(editor.view.dom.querySelector('button')?.getAttribute('aria-expanded')).toBe('true')
    editor.destroy()
  })
  it('preserves multiline HTML islands, nested span styles and literal directive lines', () => {
    const input =
      '<details open>\n<summary>Title</summary>\n\n<div data-type="detailsContent">\n<p><span style="color:#ff0000">red <span style="font-size:20px">large</span> red</span></p>\n<p>::: info</p>\n<p>:::</p>\n</div>\n</details>'
    const parsed = parseTiptapContent({ format: 'markdown', content: input })
    expect(parsed).toMatchObject({ ok: true })
    if (parsed.ok) {
      expect(serializeTiptapMarkdown(parsed.value).ok).toBe(true)
      const nested = parseTiptapContent({
        format: 'markdown',
        content: `::: tip Outer\n${input}\n:::`,
      })
      expect(nested).toMatchObject({ ok: true })
    }
  })
  it('preserves controlled title styles and fresh extension storage', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'admonition',
          attrs: { type: 'info' },
          content: [
            {
              type: 'admonitionTitle',
              content: [
                {
                  type: 'text',
                  text: 'styled',
                  marks: [{ type: 'underline' }, { type: 'textStyle', attrs: { color: '#abc' } }],
                },
              ],
            },
            { type: 'paragraph' },
          ],
        },
      ],
    }
    expect(serializeTiptapMarkdown(input).ok).toBe(true)
    const a = createTiptapExtensions({ purpose: 'conversion' }),
      b = createTiptapExtensions({ purpose: 'conversion' })
    for (let i = 0; i < a.length; i++) expect(a[i]).not.toBe(b[i])
  })
  it('rejects unsafe image insertion before commands can change the document', () => {
    const editor = new Editor({ extensions: createTiptapExtensions({ purpose: 'editing' }) })
    const before = editor.getJSON()
    expect(editor.commands.setImage({ src: 'javascript:alert(1)' })).toBe(false)
    expect(editor.commands.setImage({ src: '/x', width: 9000 })).toBe(false)
    expect(editor.getJSON()).toEqual(before)
    expect(editor.commands.setImage({ src: '/safe.png', width: 200 })).toBe(true)
    editor.destroy()
  })
  it('rejects adversarial Markdown nesting with a fixed limit diagnostic', () => {
    expect(
      parseTiptapContent({ format: 'markdown', content: '> '.repeat(2000) + 'deep' }),
    ).toMatchObject({ ok: false, issues: [{ code: 'limit-exceeded' }] })
  })
  it('applies the official image input rule only to policy-approved addresses', () => {
    const editor = new Editor({ extensions: createTiptapExtensions({ purpose: 'editing' }) })
    const typeLast = (prefix: string) => {
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: prefix }] }],
      })
      const pos = editor.state.doc.content.size - 1
      editor.commands.setTextSelection(pos)
      return editor.view.someProp('handleTextInput', (handler) =>
        handler(editor.view, pos, pos, ')', () => editor.state.tr.insertText(')')),
      )
    }
    expect(typeLast('![alt](javascript:evil')).not.toBe(true)
    expect(editor.getJSON().content?.[0]?.type).toBe('paragraph')
    expect(typeLast('![alt](https://example.com/safe.png')).toBe(true)
    expect(editor.getJSON().content?.some((node) => node.type === 'image')).toBe(true)
    editor.destroy()
  })
  it('undoes each Admonition command independently and preserves marked titles', () => {
    const editor = new Editor({
      extensions: createTiptapExtensions({ purpose: 'editing' }),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'body', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    })
    editor.commands.setAdmonition('info')
    const wrapped = editor.getJSON()
    editor.commands.setAdmonition('error')
    const switched = editor.getJSON()
    editor.commands.unsetAdmonition()
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(switched)
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(wrapped)
    editor.destroy()
  })
})
