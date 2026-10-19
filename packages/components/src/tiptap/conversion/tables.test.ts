// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { parseTiptapContent, parseTiptapHTML, serializeTiptapMarkdown } from './index'

const paragraph = (text: string): JSONContent => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : undefined,
})
const cell = (text: string, header = false, attrs = {}): JSONContent => ({
  type: header ? 'tableHeader' : 'tableCell',
  attrs,
  content: [paragraph(text)],
})
const row = (...content: JSONContent[]): JSONContent => ({ type: 'tableRow', content })
const document = (...rows: JSONContent[]): JSONContent => ({
  type: 'doc',
  content: [{ type: 'table', content: rows }, paragraph('')],
})
function roundtrip(content: JSONContent) {
  const normalized = parseTiptapContent({ format: 'json', content })
  expect(normalized.ok).toBe(true)
  const output = serializeTiptapMarkdown(content)
  expect(output.ok).toBe(true)
  if (!output.ok || !normalized.ok) throw new Error('Table roundtrip failed')
  expect(parseTiptapContent({ format: 'markdown', content: output.value })).toMatchObject({
    ok: true,
    value: normalized.value,
  })
  return output.value
}

describe('table content boundaries', () => {
  it('imports GFM headers, alignment, inline marks and escaped pipes as table nodes', () => {
    const parsed = parseTiptapContent({
      format: 'markdown',
      content: '| Name | Value |\n| :--- | ---: |\n| **bold** | a\\|b |',
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('GFM import failed')
    expect(parsed.value.content?.[0]).toMatchObject({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { align: 'left' },
              content: [{ type: 'paragraph', content: [{ text: 'Name' }] }],
            },
            {
              type: 'tableHeader',
              attrs: { align: 'right' },
              content: [{ type: 'paragraph', content: [{ text: 'Value' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ content: [{ text: 'bold', marks: [{ type: 'bold' }] }] }],
            },
            { type: 'tableCell', content: [{ content: [{ text: 'a|b' }] }] },
          ],
        },
      ],
    })
    if (parsed.ok) expect(roundtrip(parsed.value)).toContain('|')
  })
  it('exports a regular table as GFM instead of HTML', () => {
    const output = roundtrip(
      document(row(cell('Name', true), cell('Value', true)), row(cell('one'), cell('two'))),
    )
    expect(output).toContain('| Name | Value |')
    expect(output).not.toContain('<table')
  })
  it('retains merged cells, widths, multiple paragraphs and headerless tables using controlled HTML', () => {
    const merged = cell('a', false, { colspan: 2, colwidth: [120, 140] })
    merged.content!.push(paragraph('second paragraph'))
    expect(roundtrip(document(row(merged), row(cell('b'), cell('c'))))).toContain('<table')
    expect(roundtrip(document(row(cell('no header'))))).toContain('<td')
  })
  it('retains complex inline semantics and whitespace inside cells', () => {
    const rich = cell('  spaced  ')
    rich.content![0]!.content!.push(
      { type: 'hardBreak' },
      { type: 'mention', attrs: { id: 'test', label: 'Tester' } },
    )
    expect(roundtrip(document(row(cell('Header', true)), row(rich)))).toContain('<table')
  })
  it('accepts safe HTML tables and preserves rowspans', () => {
    const html =
      '<table><tbody><tr><td rowspan="2"><p>A</p></td><td><p>B</p></td></tr><tr><td><p>C</p></td></tr></tbody></table>'
    const parsed = parseTiptapHTML(html)
    expect(parsed.ok).toBe(true)
    if (parsed.ok)
      expect(parsed.value.content?.[0]?.content?.[0]?.content?.[0]?.attrs?.rowspan).toBe(2)
    if (parsed.ok) roundtrip(parsed.value)
  })
  it.each([
    '<tr><td>lost</td></tr>',
    '<table><p>lost structure</p><tr><td>x</td></tr></table>',
    '<table><tr><td onclick="alert(1)">x</td></tr></table>',
    '<table><tr><td colspan="0">x</td></tr></table>',
    '<table><tr><td rowspan="999999999">x</td></tr></table>',
    '<table><tr><td data-unknown="x">x</td></tr></table>',
    '<table><tr><td>x</td><td>y</td></tr><tr><td>z</td></tr></table>',
    '<p>before<table><tr><td>x</td></tr></table>after</p>',
    '<h2>before<table><tr><td>x</td></tr></table>after</h2>',
    '<table><thead><tr><td>not a header</td></tr></thead></table>',
    '<table><tfoot><tr><td>footer</td></tr></tfoot></table>',
  ])('rejects unsafe or malformed HTML without parser repair: %s', (html) => {
    expect(parseTiptapHTML(html).ok).toBe(false)
    expect(parseTiptapContent({ format: 'markdown', content: html }).ok).toBe(false)
  })
  it('rejects broken JSON grids and invalid cell sizes', () => {
    for (const content of [
      document(row(cell('a'), cell('b')), row(cell('c'))),
      document(row(cell('a', false, { colspan: 0 }))),
      document(row(cell('a', false, { colwidth: [NaN] }))),
      document(row(cell('a', false, { colspan: 2, colwidth: [120] }))),
      document(row(cell('a', false, { rowspan: 10000 }))),
    ])
      expect(parseTiptapContent({ format: 'json', content }).ok).toBe(false)
  })
  it('checks links inside GFM cells with the same security policy as paragraphs', () => {
    expect(
      parseTiptapContent({
        format: 'markdown',
        content: '| X |\n| --- |\n| [x](javascript:alert) |',
      }).ok,
    ).toBe(false)
  })
  it.each([
    'a|b',
    'a\\|b',
    'a\\\\|b',
    'a\\b',
    '`ticks`',
    '**literal**',
    '中文😀',
    'a\u00a0\u00a0b',
    'a\u001fb',
  ])('preserves literal cell text %j', (text) => {
    roundtrip(document(row(cell('Header', true)), row(cell(text))))
  })
  it('retains inline code pipes, empty cells and nested table containers', () => {
    const code = cell('a || b')
    code.content![0]!.content![0]!.marks = [{ type: 'code' }]
    roundtrip(document(row(cell('', true), cell('Code', true)), row(cell(''), code)))
    const table = document(row(cell('Header', true)), row(cell('body'))).content![0]!
    roundtrip({ type: 'doc', content: [{ type: 'blockquote', content: [table] }, paragraph('')] })
    roundtrip({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph('before'), table, paragraph('after')] },
          ],
        },
        paragraph(''),
      ],
    })
  })
  it('lifts images inside Markdown cells into blocks while preserving surrounding text', () => {
    const parsed = parseTiptapContent({
      format: 'markdown',
      content: '| Image |\n| --- |\n| **before** ![alt](/image.png) after |',
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(
        parsed.value.content?.[0]?.content?.[1]?.content?.[0]?.content?.map((node) => node.type),
      ).toEqual(['paragraph', 'image', 'paragraph'])
      expect(roundtrip(parsed.value)).toContain('<table')
    }
  })
})
