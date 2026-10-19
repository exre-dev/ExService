import { describe, expect, it } from 'vitest'
import { analyzeRequest, composeBug, normalizeMime } from '@workspace/common/feedback-content'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

describe('shared feedback plain text', () => {
  it('preserves explicit Markdown and rejects unsafe or visually empty GFM', () => {
    expect(analyzeRequest('**bold**', 'markdown')).toMatchObject({
      valid: true,
      markdown: '**bold**',
      reason: null,
    })
    expect(analyzeRequest('**bold**').markdown).not.toBe('**bold**')
    for (const text of [
      '# heading',
      '~~struck~~',
      '- [x] task',
      '| a | b |\n| - | - |\n| c | d |',
      'https://example.com',
      '[site](/support)',
      '![pic](/image.png)',
    ]) {
      expect(analyzeRequest(text, 'markdown').valid, text).toBe(true)
    }
    for (const text of [
      '#   ',
      '---',
      '```\n```',
      '<script>alert(1)</script>',
      '[x](javascript:alert(1))',
      '![x](data:text/html,evil)',
      '[x](https://user:pass@example.com)',
      '[^footnote]: unsupported',
    ]) {
      expect(analyzeRequest(text, 'markdown').valid, text).toBe(false)
    }
    expect(analyzeRequest('`<script>`', 'markdown').valid).toBe(true)
    expect(analyzeRequest('```html\n<script>literal</script>\n```', 'markdown').valid).toBe(true)
    expect(analyzeRequest('> '.repeat(33) + 'nested', 'markdown')).toMatchObject({
      valid: false,
      reason: 'invalid',
    })
    expect(analyzeRequest('a'.repeat(65537), 'markdown')).toMatchObject({
      valid: false,
      reason: 'too_large',
    })
  })
  it('keeps Bug headings while preserving Markdown field formatting', () => {
    const details = {
      description: '**broken**',
      reproductionSteps: '- [x] click',
      expectedResult: null,
      actualResult: '~~wrong~~',
      frequency: null,
    } as const
    const result = composeBug(details, 'markdown')
    expect(result.valid).toBe(true)
    expect(result.markdown).toContain('## 问题描述\n\n**broken**')
    expect(result.markdown).toContain('## 复现步骤\n\n- [x] click')
    expect(composeBug(details).markdown).not.toContain('## 问题描述\n\n**broken**')
    expect(composeBug({ ...details, reproductionSteps: '<img src=x>' }, 'markdown').valid).toBe(
      false,
    )
    expect(composeBug({ ...details, description: '```unclosed' }, 'markdown').valid).toBe(false)
    expect(composeBug({ ...details, description: 'problem\n```unclosed' }, 'markdown').valid).toBe(
      false,
    )
    expect(
      composeBug({ ...details, actualResult: 'wrong\n~~~txt\nopen' }, 'markdown'),
    ).toMatchObject({ valid: false, reason: 'invalid' })
  })
  it('keeps the reserved footer outside user Markdown containers', () => {
    const parser = unified().use(remarkParse).use(remarkGfm)
    const suffix = '\n\n---\n\nExWebsite 提交编号：11111111-1111-4111-8111-111111111111'
    for (const body of [
      '```txt\nhello',
      '~~~txt\nhello',
      '> ```txt\n> hello',
      '1. ```txt\n   hello',
    ]) {
      const result = analyzeRequest(body, 'markdown')
      if (result.valid) {
        const children = parser.parse(result.markdown + suffix).children
        expect(children.at(-2)?.type, body).toBe('thematicBreak')
        expect(children.at(-1)?.type, body).toBe('paragraph')
      } else expect(result.reason, body).toBe('invalid')
    }
    expect(analyzeRequest('```html\n<script>literal</script>\n```', 'markdown').valid).toBe(true)
  })
  it('keeps HTML, fences and Markdown as text and preserves line breaks', () => {
    for (const text of [
      '中文\r\n下一行',
      '# 标题\n\n- 列表',
      '[文字](https://example.com)',
      '<script>alert(1)</script>',
      '```js\ncode\n```',
      '\\\\ * ** _',
      '**',
      '末尾\n',
    ]) {
      const result = analyzeRequest(text)
      expect(result.valid).toBe(true)
      const ast = unified().use(remarkParse).parse(result.markdown)
      expect(
        JSON.stringify(ast).match(/"type":"(html|heading|link|list|code|emphasis|strong)"/),
      ).toBeNull()
    }
    expect(analyzeRequest('第一行\r\n\r\n第三行').markdown).toBe('第一行\\\n\\\n第三行')
  })
  it('checks raw and escaped byte bounds and whitespace', () => {
    expect(analyzeRequest(' \n\t').valid).toBe(false)
    expect(analyzeRequest('字'.repeat(21846)).valid).toBe(false)
    expect(analyzeRequest('*'.repeat(65536)).valid).toBe(false)
    expect(analyzeRequest('a'.repeat(65536)).valid).toBe(true)
  })
  it('composes only populated Bug sections in fixed order', () => {
    const result = composeBug({
      description: '<html>',
      reproductionSteps: '1. step',
      expectedResult: null,
      actualResult: 'bad',
      frequency: 'often',
    })
    expect(result.valid).toBe(true)
    expect(result.markdown.indexOf('问题描述')).toBeLessThan(result.markdown.indexOf('复现步骤'))
    expect(result.markdown).not.toContain('预期结果')
    expect(result.markdown).toContain('经常')
    expect(
      composeBug({
        description: 'a'.repeat(16385),
        reproductionSteps: null,
        expectedResult: null,
        actualResult: null,
        frequency: null,
      }).valid,
    ).toBe(false)
  })
  it('normalizes MIME casing and replaces invalid header values', () => {
    expect(normalizeMime('TEXT/PLAIN')).toBe('text/plain')
    expect(normalizeMime('bad\r\nheader')).toBe('application/octet-stream')
  })
})
