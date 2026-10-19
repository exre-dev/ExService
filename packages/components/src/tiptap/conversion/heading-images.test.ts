// @vitest-environment jsdom
import { expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { parseTiptapContent, serializeTiptapMarkdown } from './index'

it.each(
  [1, 2, 3, 4].flatMap((level) =>
    ['first', 'middle', 'last', 'only'].map((position) => ({ level, position })),
  ),
)(
  'lifts block images from H$level at $position without losing title marks/order',
  ({ level, position }) => {
    const text = (value: string, mark?: string): JSONContent => ({
      type: 'text',
      text: value,
      ...(mark ? { marks: [{ type: mark }] } : {}),
    })
    const heading = (...content: JSONContent[]): JSONContent => ({
      type: 'heading',
      attrs: { level },
      content,
    })
    const image: JSONContent = { type: 'image', attrs: { src: '/x', alt: 'x' } }
    const body =
      position === 'first'
        ? '![x](/x) *After*'
        : position === 'middle'
          ? '**Before** ![x](/x) *After*'
          : position === 'last'
            ? '**Before** ![x](/x)'
            : '![x](/x)'
    const blocks =
      position === 'first'
        ? [image, heading(text(' '), text('After', 'italic'))]
        : position === 'middle'
          ? [
              heading(text('Before', 'bold'), text(' ')),
              image,
              heading(text(' '), text('After', 'italic')),
            ]
          : position === 'last'
            ? [heading(text('Before', 'bold'), text(' ')), image]
            : [image]
    const expected = parseTiptapContent({
      format: 'json',
      content: { type: 'doc', content: blocks },
    })
    const actual = parseTiptapContent({
      format: 'markdown',
      content: '#'.repeat(level) + ' ' + body,
    })
    expect(expected.ok).toBe(true)
    expect(actual.ok).toBe(true)
    if (!actual.ok || !expected.ok) return
    expect(actual.value).toEqual(expected.value)
    const exported = serializeTiptapMarkdown(actual.value)
    expect(exported.ok).toBe(true)
    if (exported.ok)
      expect(parseTiptapContent({ format: 'markdown', content: exported.value })).toEqual(
        expect.objectContaining({ ok: true, value: expected.value }),
      )
  },
)
it('keeps heading levels and link/bold marks inside nested containers with consecutive images', () => {
  const source =
    '> ## **Before** ![one](/one)![two](/two) [After](/safe)\n\n::: info Notice\n### **Nested** ![three](/three) tail\n:::'
  const actual = parseTiptapContent({ format: 'markdown', content: source })
  expect(actual.ok).toBe(true)
  if (!actual.ok) return
  const quote = actual.value.content![0]!
  expect(quote.content!.map((node) => node.type)).toEqual(['heading', 'image', 'image', 'heading'])
  expect(quote.content![0]!.attrs!.level).toBe(2)
  expect(quote.content![0]!.content![0]!.marks).toEqual([{ type: 'bold' }])
  expect(quote.content![3]!.content!.at(-1)!.marks![0]!.type).toBe('link')
  const nested = actual.value.content![1]!.content!
  expect(nested.slice(1).map((node) => node.type)).toEqual(['heading', 'image', 'heading'])
  expect(nested[1]!.attrs!.level).toBe(3)
  const exported = serializeTiptapMarkdown(actual.value)
  expect(exported.ok).toBe(true)
  if (exported.ok)
    expect(parseTiptapContent({ format: 'markdown', content: exported.value })).toEqual(
      expect.objectContaining({ ok: true, value: actual.value }),
    )
})
