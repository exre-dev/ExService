import { describe, expect, it } from 'vitest'
import { analyzeRequest } from '@workspace/common/feedback-content'
import { finalMarkdown, equivalentMarkdown } from './markdown.js'

describe('support Markdown verification', () => {
  it('compares GFM tables structurally and preserves task checked state', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    const expected = finalMarkdown(
      '| Step | State |\n| --- | --- |\n| one | ready |\n\n- [x] done\n- [ ] waiting\n\n~~old~~',
      marker,
    )
    const spacing = finalMarkdown(
      '|Step|State|\n|---|---|\n|one|ready|\n\n- [X] done\n- [ ] waiting\n\n~~old~~',
      marker,
    )
    expect(equivalentMarkdown(expected, spacing, 'markdown')).toBe(true)
    expect(equivalentMarkdown(expected, spacing.replace('[X]', '[ ]'), 'markdown')).toBe(false)
    expect(equivalentMarkdown(expected, spacing.replace('~~old~~', 'old'), 'markdown')).toBe(false)
  })
  it('compares Markdown autolinks as links while retaining legacy plain URL readback', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    const expected = finalMarkdown('Visit https://example.com', marker)
    const remote = finalMarkdown('Visit <https://example.com>', marker)
    expect(equivalentMarkdown(expected, remote, 'markdown')).toBe(true)
    expect(
      equivalentMarkdown(
        expected,
        finalMarkdown('Visit [https://example.com](https://evil.example)', marker),
        'markdown',
      ),
    ).toBe(false)
    const legacy = finalMarkdown(analyzeRequest('Visit https://example.com').markdown, marker)
    expect(equivalentMarkdown(legacy, remote)).toBe(true)
  })
  it('checks structure and exact submission marker in remote content', () => {
    const markdown = finalMarkdown(
      analyzeRequest('# text').markdown,
      '11111111-1111-4111-8111-111111111111',
    )
    expect(markdown).toContain('ExWebsite 提交编号：11111111-1111-4111-8111-111111111111')
    expect(equivalentMarkdown(markdown, markdown.replace('\\# text', '# text'))).toBe(false)
    expect(equivalentMarkdown(markdown, markdown.replace('4111', '4112'))).toBe(false)
  })
  it('accepts ClickUp soft newlines for plain Chinese hard breaks and coalesces adjacent text', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    const expected = finalMarkdown(
      analyzeRequest('普通中文第一行\n第二行：保留精确文字\n最后一行').markdown,
      marker,
    )
    const remote =
      '普通中文第一行\n第二行：保留精确文字\n最后一行\n\n---\n\nExWebsite 提交编号：11111111-1111-4111-8111-111111111111'
    expect(equivalentMarkdown(expected, remote)).toBe(true)
    expect(equivalentMarkdown(remote, expected)).toBe(true)
    expect(equivalentMarkdown(expected, remote.replaceAll('\n', '\r\n'))).toBe(true)
  })
  it('preserves exact text, blank lines, blocks and the marker while normalizing line breaks', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    const expected = finalMarkdown(analyzeRequest('第一行\n第二行').markdown, marker)
    const remote =
      '第一行\n第二行\n\n---\n\nExWebsite 提交编号：11111111-1111-4111-8111-111111111111'
    for (const changed of [
      remote.replace('第二行', '第二'),
      remote.replace('第一行\n第二行', '第一行第二行'),
      remote.replace('第一行\n第二行', '第一行\n\n第二行'),
      remote.replace('第一行', '第一 行'),
      remote.replace(
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111112',
      ),
      remote.replace('\n\n---\n\n', '\n\n'),
    ])
      expect(equivalentMarkdown(expected, changed), changed).toBe(false)
    const blankLine = finalMarkdown(analyzeRequest('第一行\n\n第三行').markdown, marker)
    expect(equivalentMarkdown(blankLine, blankLine.replace('\\\n\\\n', '\\\n'))).toBe(false)
  })
  it('accepts remote automatic HTTP(S) links only when their plain label exactly equals the target URL', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    for (const url of [
      'https://example.com',
      'http://example.com/path',
      'https://example.com/path?q=1&other=2#part',
    ]) {
      const expected = finalMarkdown(analyzeRequest(`地址：${url}\n下一行`).markdown, marker)
      for (const link of [`<${url}>`, `[${url}](${url})`]) {
        const remote = finalMarkdown(`地址：${link}\n下一行`, marker)
        expect(equivalentMarkdown(expected, remote), link).toBe(true)
        expect(
          equivalentMarkdown(remote, expected),
          'normalization applies only to remote links',
        ).toBe(false)
      }
    }
  })
  it('accepts ClickUp automatic URLs inside escaped literal Markdown without accepting adjacent raw HTML', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    const plain = '# 标题 *星号* [链接](https://example.com)\n下一行'
    const remote =
      '\\# 标题 \\*星号\\* \\[链接\\]([https://example.com](https://example.com))\n下一行'
    expect(
      equivalentMarkdown(
        finalMarkdown(analyzeRequest(plain).markdown, marker),
        finalMarkdown(remote, marker),
      ),
    ).toBe(true)
    expect(
      equivalentMarkdown(
        finalMarkdown(analyzeRequest(`${plain}\n<span>文字</span>`).markdown, marker),
        finalMarkdown(`${remote}\n<span>文字</span>`, marker),
      ),
    ).toBe(false)
  })
  it('rejects links with changed targets, labels, titles, unsafe URLs or formatted labels', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    for (const [plain, linked] of [
      ['https://example.com', '[https://example.com](https://other.example.com)'],
      ['https://example.com', '[https://example.com](https://example.com/)'],
      ['文字', '[文字](https://example.com)'],
      ['https://example.com', '[https://example.com](https://example.com "title")'],
      ['https://example.com', '[**https://example.com**](https://example.com)'],
      ['javascript:alert(1)', '[javascript:alert(1)](<javascript:alert(1)>)'],
      ['data:text/plain,value', '[data:text/plain,value](data:text/plain,value)'],
      ['mailto:user@example.com', '<mailto:user@example.com>'],
      ['https://user:password@example.com', '<https://user:password@example.com>'],
      [
        'https://example.com/a\u0001b',
        '[https://example.com/a\u0001b](<https://example.com/a\u0001b>)',
      ],
    ])
      expect(
        equivalentMarkdown(
          finalMarkdown(analyzeRequest(plain!).markdown, marker),
          finalMarkdown(linked!, marker),
        ),
        linked,
      ).toBe(false)
    const plainWithHtml = finalMarkdown(
      analyzeRequest('https://example.com\n<span>文字</span>').markdown,
      marker,
    )
    const linkedWithHtml = finalMarkdown('<https://example.com>\n<span>文字</span>', marker)
    expect(equivalentMarkdown(plainWithHtml, linkedWithHtml)).toBe(false)
  })
  it.each([
    ['https://example.com/a\\b', '[https://example.com/a\\\\b](<https://example.com/a\\\\b>)'],
    [
      'https://example.com/a\u00a0b',
      '[https://example.com/a\u00a0b](<https://example.com/a\u00a0b>)',
    ],
    [
      'https://example.com/a\u2003b',
      '[https://example.com/a\u2003b](<https://example.com/a\u2003b>)',
    ],
    ['relative/path', '[relative/path](relative/path)'],
    ['//example.com/path', '[//example.com/path](//example.com/path)'],
  ])('rejects automatic URL target %j', (plain, linked) => {
    const marker = '11111111-1111-4111-8111-111111111111'
    expect(
      equivalentMarkdown(
        finalMarkdown(analyzeRequest(plain).markdown, marker),
        finalMarkdown(linked, marker),
      ),
    ).toBe(false)
  })
  it('rejects other links, HTML, headings and formatting applied to plain text', () => {
    const marker = '11111111-1111-4111-8111-111111111111'
    for (const [plain, formatted] of [
      ['[文字](https://example.com)', '[文字](https://example.com)'],
      ['<span>文字</span>', '<span>文字</span>'],
      ['# 标题', '# 标题'],
      ['**粗体**', '**粗体**'],
      ['*斜体*', '*斜体*'],
    ]) {
      const expected = finalMarkdown(analyzeRequest(plain!).markdown, marker)
      const remote = finalMarkdown(formatted!, marker)
      expect(equivalentMarkdown(expected, remote), formatted).toBe(false)
    }
  })
})
