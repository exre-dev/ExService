import { describe, expect, it } from 'vitest'
import {
  assertSafeNotificationHtml,
  deriveSummary,
  deriveText,
  sanitizeNotificationHtml,
} from './sanitize.js'
import { classifyHref } from './policy.js'
import { buildHtmlTree } from './tree.js'
import { tokenizeHtml } from './tokenizer.js'

const safe = (html: string) => sanitizeNotificationHtml(html)

describe('tokenizer', () => {
  it('keeps a quoted ">" inside an attribute value', () => {
    const tokens = tokenizeHtml('<p title="a>b">x</p>')
    expect(tokens.filter((token) => token.kind === 'start')).toHaveLength(1)
    expect(tokens.some((token) => token.kind === 'text' && token.value === 'x')).toBe(true)
  })

  it('treats script content as raw text until the matching end tag', () => {
    const tokens = tokenizeHtml('<script>if (a < b) { }</script><p>after</p>')
    expect(tokens.some((token) => token.kind === 'start' && token.name === 'script')).toBe(true)
    expect(tokens.some((token) => token.kind === 'text' && token.value.includes('a < b'))).toBe(
      true,
    )
    expect(tokens.some((token) => token.kind === 'start' && token.name === 'p')).toBe(true)
  })

  it('handles comments, doctype and character references', () => {
    const tokens = tokenizeHtml('<!doctype html><!-- c --><p>a &amp; b &#60; c &#x41;</p>')
    expect(tokens.some((token) => token.kind === 'doctype')).toBe(true)
    expect(tokens.some((token) => token.kind === 'comment')).toBe(true)
    expect(tokens.some((token) => token.kind === 'text' && token.value === 'a & b < c A')).toBe(
      true,
    )
  })

  it('does not loop on a malformed attribute fragment', () => {
    const tokens = tokenizeHtml('<p =x>y')
    expect(tokens.some((token) => token.kind === 'text' && token.value.includes('y'))).toBe(true)
  })
})

describe('notification-html-v1 allowlist', () => {
  it('normalizes supported rich content', () => {
    const outcome = safe(
      '<h2>标题</h2><p>带 <strong>强调</strong> 与 <em>斜体</em>。</p>' +
        '<ul><li>第一</li><li>第二</li></ul><blockquote>引用</blockquote><p><code>code</code></p><hr>',
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.html).toBe(
      '<h2>标题</h2><p>带 <strong>强调</strong> 与 <em>斜体</em>。</p>' +
        '<ul><li>第一</li><li>第二</li></ul><blockquote>引用</blockquote><p><code>code</code></p><hr>',
    )
    expect(outcome.result.text).toContain('标题')
    expect(outcome.result.text).toContain('第一')
  })

  it('keeps a safe internal link and drops nothing else', () => {
    const outcome = safe('<p>详见 <a href="/communities/rifling-911">社区主页</a>。</p>')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.html).toBe(
      '<p>详见 <a href="/communities/rifling-911">社区主页</a>。</p>',
    )
  })

  it('accepts a small table with a caption', () => {
    const outcome = safe(
      '<table><caption>名额</caption><thead><tr><th scope="col">分队</th><th scope="col">人数</th>' +
        '</tr></thead><tbody><tr><td>LEO</td><td>12</td></tr></tbody></table>',
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.html).toContain('<th scope="col">分队</th>')
    expect(outcome.result.text).toContain('LEO')
  })

  it('accepts a table preceded by a semantic heading instead of a caption', () => {
    const outcome = safe('<h3>名额</h3><table><tbody><tr><td>a</td></tr></tbody></table>')
    expect(outcome.ok).toBe(true)
  })

  it('unwraps an unknown decorative tag instead of dropping its text', () => {
    const outcome = safe('<div><span>保留正文</span></div>')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.text).toContain('保留正文')
    expect(outcome.result.unwrappedTags).toEqual(['div', 'span'])
  })

  it('escapes MDX-style expressions as plain text', () => {
    const outcome = safe('<p>{1 + 1} 与 <Foo /></p>')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.html).toContain('{1 + 1}')
    expect(outcome.result.html).not.toContain('<Foo')
  })
})

describe('notification-html-v1 rejections', () => {
  const rejected = [
    ['script element', '<p>x</p><script>alert(1)</script>'],
    ['event handler attribute', '<p onclick="alert(1)">x</p>'],
    ['img onerror', '<img src="x" onerror="alert(1)">'],
    ['style element', '<style>body{}</style><p>x</p>'],
    ['style attribute', '<p style="color:red">x</p>'],
    ['svg', '<svg><script>alert(1)</script></svg>'],
    ['iframe', '<iframe src="https://example.com"></iframe>'],
    ['form', '<form action="/x"><input name="a"></form>'],
    ['javascript href', '<p><a href="javascript:alert(1)">x</a></p>'],
    ['data href', '<p><a href="data:text/html,<script>1</script>">x</a></p>'],
    ['protocol-relative href', '<p><a href="//evil.example.com/x">x</a></p>'],
    ['external href when no target is approved', '<p><a href="https://example.com/x">x</a></p>'],
    ['non-allowlisted internal href', '<p><a href="/account/profile">x</a></p>'],
    ['href with query', '<p><a href="/?a=1">x</a></p>'],
    ['href with credentials', '<p><a href="https://user:pw@example.com/">x</a></p>'],
    ['dom clobbering id', '<p id="attributes">x</p>'],
    ['dom clobbering name', '<p name="nodeName">x</p>'],
    ['class attribute', '<p class="x">y</p>'],
    ['data attribute', '<p data-x="1">y</p>'],
    ['aria attribute', '<p aria-label="x">y</p>'],
    ['srcdoc', '<iframe srcdoc="<script>1</script>"></iframe>'],
    ['dangerous attribute on an unwrapped tag', '<span onclick="alert(1)">x</span>'],
    ['empty body', '   '],
    ['body that is only a removed script', '<script>alert(1)</script>'],
  ] as const

  for (const [name, html] of rejected) {
    it(`rejects ${name}`, () => {
      expect(safe(html).ok).toBe(false)
    })
  }

  it('reports CONTENT_UNSAFE for rejected content', () => {
    expect(() => assertSafeNotificationHtml('<script>1</script>')).toThrowError(/CONTENT_UNSAFE/)
  })

  it('rejects an empty or control-character text node', () => {
    expect(safe('<p></p>').ok).toBe(false)
  })

  it('rejects a table without a caption or semantic heading', () => {
    expect(safe('<table><tbody><tr><td>a</td></tr></tbody></table>').ok).toBe(false)
  })

  it('rejects a table with more than six columns', () => {
    const cells = Array.from({ length: 7 }, (_, index) => `<td>${index}</td>`).join('')
    expect(safe(`<table><caption>x</caption><tbody><tr>${cells}</tr></tbody></table>`).ok).toBe(
      false,
    )
  })

  it('rejects a table with more than twenty rows', () => {
    const rows = Array.from({ length: 21 }, () => '<tr><td>a</td></tr>').join('')
    expect(safe(`<table><caption>x</caption><tbody>${rows}</tbody></table>`).ok).toBe(false)
  })

  it('rejects a non-text table cell', () => {
    expect(
      safe(
        '<table><caption>x</caption><tbody><tr><td><ul><li>a</li></ul></td></tr></tbody></table>',
      ).ok,
    ).toBe(false)
  })

  it('rejects an invalid th scope', () => {
    expect(
      safe('<table><caption>x</caption><tbody><tr><th scope="colgroup">a</th></tr></tbody></table>')
        .ok,
    ).toBe(false)
  })

  it('rejects an empty link', () => {
    expect(safe('<p><a href="/">   </a></p>').ok).toBe(false)
  })

  it('rejects content that exceeds the node budget', () => {
    const body = Array.from({ length: 600 }, () => '<p>a</p>').join('')
    expect(safe(body).ok).toBe(false)
  })

  it('rejects content that exceeds the depth budget', () => {
    let body = '深'
    for (let index = 0; index < 30; index += 1) body = `<blockquote>${body}</blockquote>`
    expect(safe(body).ok).toBe(false)
  })

  it('rejects content larger than the byte budget', () => {
    expect(safe(`<p>${'a'.repeat(33 * 1024)}</p>`).ok).toBe(false)
  })
})

describe('tree limits', () => {
  it('throws when the node budget is exceeded', () => {
    const body = Array.from({ length: 50 }, () => '<p>a</p>').join('')
    expect(() => buildHtmlTree(body, { maxNodes: 10, maxDepth: 16 })).toThrow()
  })

  it('throws when the depth budget is exceeded', () => {
    let body = 'x'
    for (let index = 0; index < 10; index += 1) body = `<blockquote>${body}</blockquote>`
    expect(() => buildHtmlTree(body, { maxNodes: 1000, maxDepth: 3 })).toThrow()
  })
})

describe('URL policy', () => {
  it('accepts only allowlisted read-only internal pages', () => {
    expect(classifyHref('/')).toEqual({ kind: 'internal', path: '/' })
    expect(classifyHref('/communities/caep')).toEqual({
      kind: 'internal',
      path: '/communities/caep',
    })
    expect(classifyHref('/communities/caep/')).toEqual({
      kind: 'internal',
      path: '/communities/caep',
    })
  })

  it('rejects traversal, encoding tricks and protocol-relative addresses', () => {
    for (const href of [
      '/../admin',
      '/%2e%2e/admin',
      '//evil.example.com',
      '/communities/../admin',
      '/login',
      '/identity/logout',
      '/account/profile',
      '/admin/join-applications',
    ]) {
      expect(classifyHref(href).kind).toBe('rejected')
    }
  })

  it('rejects every non-https scheme', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,x',
      'blob:https://x/y',
      'file:///etc/passwd',
      'http://example.com/',
      'vbscript:x',
    ]) {
      expect(classifyHref(href).kind).toBe('rejected')
    }
  })
})

describe('text and summary derivation', () => {
  it('derives a readable text fallback from the safe tree', () => {
    const outcome = safe('<h2>标题</h2><p>第一段</p><p>第二段</p>')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.text).toContain('第一段')
    expect(outcome.result.text).toContain('第二段')
  })

  it('truncates a long summary at the code-point boundary with a marker', () => {
    const summary = deriveSummary('啊'.repeat(300))
    expect(Array.from(summary)).toHaveLength(241)
    expect(summary.endsWith('…')).toBe(true)
  })

  it('collapses repeated whitespace in the summary', () => {
    expect(deriveSummary('a \t b\n\n\nc')).toBe('a b\nc')
  })

  it('preserves newlines inside a pre block', () => {
    const outcome = safe('<pre>line1\nline2</pre>')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(deriveText(buildHtmlTree(outcome.result.html))).toContain('line1\nline2')
  })
})
