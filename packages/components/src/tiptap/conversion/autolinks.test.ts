// @vitest-environment jsdom
import { expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { parseTiptapContent, serializeTiptapMarkdown } from './index'

it.each([
  'http://example.test/path',
  'https://example.test/a?b=1',
  'www.example.test/path',
  'person+tag@example.test',
  'ftp://example.test/file',
])('preserves plain text that GFM would auto-link: %s', (value) => {
  const doc: JSONContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: `before ${value} after` }] }],
  }
  const normalized = parseTiptapContent({ format: 'json', content: doc })
  const exported = serializeTiptapMarkdown(doc)
  expect(exported.ok).toBe(true)
  if (exported.ok && normalized.ok)
    expect(parseTiptapContent({ format: 'markdown', content: exported.value })).toEqual(
      expect.objectContaining({ ok: true, value: normalized.value }),
    )
})
it('retains styled text, intentional link marks and literal code beside auto-link-like text', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'www.example.test', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' / ' },
          {
            type: 'text',
            text: 'real link',
            marks: [{ type: 'link', attrs: { href: 'https://example.test' } }],
          },
          { type: 'text', text: ' / ' },
          { type: 'text', text: 'https://literal.test <script> :::', marks: [{ type: 'code' }] },
          { type: 'text', text: ' person@example.test' },
        ],
      },
      {
        type: 'codeBlock',
        attrs: { language: 'text' },
        content: [
          {
            type: 'text',
            text: 'https://literal.test\nwww.example.test\nperson@example.test\n<script> :::',
          },
        ],
      },
    ],
  }
  const normalized = parseTiptapContent({ format: 'json', content: doc }),
    exported = serializeTiptapMarkdown(doc)
  expect(exported.ok).toBe(true)
  if (exported.ok && normalized.ok) {
    expect(exported.value).toContain(
      '```text\nhttps://literal.test\nwww.example.test\nperson@example.test\n<script> :::\n```',
    )
    expect(parseTiptapContent({ format: 'markdown', content: exported.value })).toEqual(
      expect.objectContaining({ ok: true, value: normalized.value }),
    )
  }
})
