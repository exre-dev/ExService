// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_CONTENT_POLICY_VERSION,
  NOTIFICATION_CONTENT_SCHEMA_VERSION,
  parseNotificationContent,
  type NotificationContentInput,
} from '@components/src/notifications/notificationContent'

function content(
  html: string,
  overrides: Partial<NotificationContentInput> = {},
): NotificationContentInput {
  return {
    format: 'html',
    schemaVersion: NOTIFICATION_CONTENT_SCHEMA_VERSION,
    policyVersion: NOTIFICATION_CONTENT_POLICY_VERSION,
    html,
    text: 'fallback text',
    ...overrides,
  }
}

describe('notification-html-v1 rendering policy', () => {
  it('accepts the canonical allowlisted body', () => {
    const tree = parseNotificationContent(
      content(
        '<h2>标题</h2><p>段落 <strong>粗</strong> <em>斜</em> <s>删</s> <code>码</code> ' +
          '<a href="/communities/rifling-911">社区主页</a></p>' +
          '<ul><li>一</li><li>二</li></ul>' +
          '<blockquote><p>引用</p></blockquote><pre><code>code</code></pre><hr>' +
          '<table><caption>表</caption><thead><tr><th scope="col">列</th></tr></thead>' +
          '<tbody><tr><th scope="row">行</th><td>值</td></tr></tbody></table>',
      ),
    )
    expect(tree).not.toBeNull()
    const tags = collectTags(tree!)
    expect(tags).toContain('h2')
    expect(tags).toContain('strong')
    expect(tags).toContain('a')
    expect(tags).toContain('table')
    expect(tags).toContain('caption')
  })

  it('rejects a format, schema or policy it does not implement', () => {
    expect(parseNotificationContent(content('<p>x</p>', { format: 'mdx' }))).toBeNull()
    expect(parseNotificationContent(content('<p>x</p>', { schemaVersion: 2 }))).toBeNull()
    expect(
      parseNotificationContent(content('<p>x</p>', { policyVersion: 'notification-html-v2' })),
    ).toBeNull()
    expect(parseNotificationContent(null)).toBeNull()
    expect(parseNotificationContent(content(''))).toBeNull()
  })

  it.each([
    ['script', '<p>x</p><script>alert(1)</script>'],
    ['style', '<p>x</p><style>body{}</style>'],
    ['iframe', '<p>x</p><iframe src="https://evil.example.com"></iframe>'],
    ['img', '<p><img src="x" onerror="alert(1)"></p>'],
    ['svg', '<p><svg><script>alert(1)</script></svg></p>'],
    ['form', '<p><form action="/x"><input name="a"></form></p>'],
    ['button', '<p><button onclick="alert(1)">go</button></p>'],
    ['object', '<p><object data="x"></object></p>'],
    ['math', '<p><math><mi>x</mi></math></p>'],
    ['template', '<p>x</p><template><script>alert(1)</script></template>'],
    ['decorative b', '<p><b>x</b></p>'],
    ['unknown span', '<p><span>x</span></p>'],
  ])('rejects %s instead of rendering it', (_label, html) => {
    expect(parseNotificationContent(content(html))).toBeNull()
  })

  it.each([
    ['on* handler', '<p onmouseover="alert(1)">x</p>'],
    ['style attribute', '<p style="color:red">x</p>'],
    ['class attribute', '<p class="x">x</p>'],
    ['id attribute', '<p id="x">x</p>'],
    ['data attribute', '<p data-x="1">x</p>'],
    ['aria attribute', '<p aria-label="x">x</p>'],
    ['src attribute on code', '<p><code src="//evil">x</code></p>'],
  ])('rejects %s on an otherwise allowed element', (_label, html) => {
    expect(parseNotificationContent(content(html))).toBeNull()
  })

  it.each([
    ['javascript scheme', '<p><a href="javascript:alert(1)">x</a></p>'],
    ['data scheme', '<p><a href="data:text/html,<script>1</script>">x</a></p>'],
    ['protocol relative', '<p><a href="//evil.example.com">x</a></p>'],
    ['external https', '<p><a href="https://example.com/docs">x</a></p>'],
    ['non-allowlisted internal path', '<p><a href="/account/profile">x</a></p>'],
    ['retired Join path', '<p><a href="/join/rifling-911">报名</a></p>'],
    ['query string', '<p><a href="/communities/rifling-911?a=1">x</a></p>'],
    ['fragment', '<p><a href="/communities/rifling-911#top">x</a></p>'],
    ['path traversal', '<p><a href="/communities/../admin">x</a></p>'],
    ['split scheme', '<p><a href="java\tscript:alert(1)">x</a></p>'],
    ['missing href', '<p><a>x</a></p>'],
  ])('rejects %s', (_label, html) => {
    expect(parseNotificationContent(content(html))).toBeNull()
  })

  it.each([
    ['/', '<p><a href="/">首页</a></p>'],
    ['/communities/rifling-911', '<p><a href="/communities/rifling-911">Rifling</a></p>'],
    ['/communities/caep', '<p><a href="/communities/caep">CAEP</a></p>'],
    ['trailing slash normalisation', '<p><a href="/communities/caep/">CAEP</a></p>'],
  ])('accepts the read-only internal path %s', (_label, html) => {
    const tree = parseNotificationContent(content(html))
    expect(tree).not.toBeNull()
    expect(findHref(tree!)).toBeTruthy()
  })

  it('rejects a table that exceeds the row or column limit', () => {
    const rows = Array.from({ length: 21 }, (_, index) => `<tr><td>${index}</td></tr>`).join('')
    expect(parseNotificationContent(content(`<table><tbody>${rows}</tbody></table>`))).toBeNull()
    const cells = Array.from({ length: 7 }, () => '<td>x</td>').join('')
    expect(
      parseNotificationContent(content(`<table><tbody><tr>${cells}</tr></tbody></table>`)),
    ).toBeNull()
  })

  it('accepts a table at the full 6-column x 20-row budget', () => {
    // 列数按行、行数按表：整份正文累计计数会把这张合法表格判成超限。
    const rows = Array.from(
      { length: 20 },
      (_, row) =>
        `<tr>${Array.from({ length: 6 }, (_, column) => `<td>${row}-${column}</td>`).join('')}</tr>`,
    ).join('')
    const tree = parseNotificationContent(content(`<table><caption>表</caption>${rows}</table>`))
    expect(tree).not.toBeNull()
    expect(collectTags(tree!).filter((tag) => tag === 'tr')).toHaveLength(20)
  })

  it('does not accumulate the row budget across tables', () => {
    const build = (rows: number) =>
      `<table><caption>表</caption>${Array.from(
        { length: rows },
        (_, row) => `<tr><td>${row}</td></tr>`,
      ).join('')}</table>`
    const tree = parseNotificationContent(content(`<h2>标题</h2>${build(11)}${build(11)}`))
    expect(tree).not.toBeNull()
    expect(collectTags(tree!).filter((tag) => tag === 'table')).toHaveLength(2)
  })

  it('rejects a table without any row or cell', () => {
    expect(
      parseNotificationContent(content('<h2>标题</h2><table><caption>表</caption></table>')),
    ).toBeNull()
    expect(
      parseNotificationContent(
        content('<h2>标题</h2><table><caption>表</caption><tbody><tr></tr></tbody></table>'),
      ),
    ).toBeNull()
  })

  it('rejects a body beyond the node or depth limit', () => {
    expect(
      parseNotificationContent(content(`<p>${'<strong>x</strong>'.repeat(600)}</p>`)),
    ).toBeNull()
    let deep = 'x'
    for (let index = 0; index < 20; index += 1) deep = `<blockquote>${deep}</blockquote>`
    expect(parseNotificationContent(content(deep))).toBeNull()
  })

  it('rejects a th scope other than row or col', () => {
    expect(
      parseNotificationContent(
        content(
          '<table><thead><tr><th scope="colgroup">x</th></tr></thead><tbody><tr><td>y</td></tr></tbody></table>',
        ),
      ),
    ).toBeNull()
  })

  it('keeps text content escaped as text nodes instead of markup', () => {
    const tree = parseNotificationContent(content('<p>a &lt;script&gt; b</p>'))
    expect(tree).not.toBeNull()
    const texts = collectText(tree!)
    expect(texts.join('')).toBe('a <script> b')
    expect(collectTags(tree!)).not.toContain('script')
  })
})

type Tree = NonNullable<ReturnType<typeof parseNotificationContent>>

function collectTags(nodes: Tree): string[] {
  const output: string[] = []
  for (const node of nodes) {
    if (node.type === 'text') continue
    output.push(node.tag)
    output.push(...collectTags(node.children as Tree))
  }
  return output
}

function collectText(nodes: Tree): string[] {
  const output: string[] = []
  for (const node of nodes) {
    if (node.type === 'text') output.push(node.value)
    else output.push(...collectText(node.children as Tree))
  }
  return output
}

function findHref(nodes: Tree): string | undefined {
  for (const node of nodes) {
    if (node.type === 'text') continue
    if (node.href !== undefined) return node.href
    const nested = findHref(node.children as Tree)
    if (nested !== undefined) return nested
  }
  return undefined
}
