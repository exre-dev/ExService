// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  parseNotificationContent,
  type SafeContentNode,
} from '@components/src/notifications/notificationContent'

// PHP notifications may contain arbitrary stored HTML. The browser validates every payload.
function parse(html: string) {
  return parseNotificationContent({
    format: 'html',
    schemaVersion: 1,
    policyVersion: 'notification-html-v1',
    html,
    text: '安全的纯文本回退',
  })
}
function table(rows: number, columns: number, options: { caption?: boolean } = {}): string {
  const body: string[] = []
  for (let row = 0; row < rows; row += 1) {
    const cells: string[] = []
    for (let column = 0; column < columns; column += 1) cells.push(`<td>r${row}c${column}</td>`)
    body.push(`<tr>${cells.join('')}</tr>`)
  }
  // 服务端要求表格带 caption 或紧邻的语义标题，否则整份正文就是 CONTENT_UNSAFE。
  const caption = options.caption === false ? '' : '<caption>表</caption>'
  return `<h2>标题</h2><table>${caption}${body.join('')}</table>`
}

describe('PHP notification output remains fail-closed at the browser boundary', () => {
  it.each([
    [2, 3],
    [20, 6],
    [1, 1],
  ])('renders all cells of a valid %i by %i table', (rows, columns) => {
    const tree = parse(table(rows!, columns!))
    expect(tree).not.toBeNull()
    expect(countTags(tree!, 'tr')).toBe(rows)
    expect(collectRows(tree!).every((row) => countTags(row, 'td') === columns)).toBe(true)
  })
  it('counts table budgets independently', () => {
    const tree = parse(table(20, 6) + table(20, 6))
    expect(tree).not.toBeNull()
    expect(countTags(tree!, 'table')).toBe(2)
  })
  it.each([
    '<script>alert(1)</script>',
    '<p onclick="alert(1)">文本</p>',
    '<a href="javascript:alert(1)">链接</a>',
    '<iframe src="https://example.com"></iframe>',
    '<img src="https://example.com/track">',
    table(21, 1),
    table(1, 7),
    '<table><caption>空表</caption></table>',
  ])('rejects unsafe or excessive stored HTML: %s', (html) => {
    expect(parse(html)).toBeNull()
  })
  it('renders a fixed PHP-safe formatted payload without a Node sanitizer dependency', () => {
    const tree = parse(
      '<h2>社区公告</h2><p>维护 <strong>说明</strong>，<a href="/communities/rifling-911">社区主页</a>。</p><ul><li>维护窗口</li></ul>',
    )
    expect(tree).not.toBeNull()
    expect(collectText(tree!).join('')).toContain('维护 说明')
  })
})
function collectTags(nodes: SafeContentNode[]): string[] {
  const output: string[] = []
  for (const node of nodes) {
    if (node.type === 'text') continue
    output.push(node.tag)
    output.push(...collectTags(node.children))
  }
  return output
}

function countTags(nodes: SafeContentNode[], tag: string): number {
  return collectTags(nodes).filter((found) => found === tag).length
}

/** 收集所有 `<tr>` 子树，用于逐行核对列数。 */
function collectRows(nodes: SafeContentNode[]): SafeContentNode[][] {
  const output: SafeContentNode[][] = []
  for (const node of nodes) {
    if (node.type === 'text') continue
    if (node.tag === 'tr') output.push(node.children)
    else output.push(...collectRows(node.children))
  }
  return output
}

function collectText(nodes: SafeContentNode[]): string[] {
  const output: string[] = []
  for (const node of nodes) {
    if (node.type === 'text') output.push(node.value)
    else output.push(...collectText(node.children))
  }
  return output
}
