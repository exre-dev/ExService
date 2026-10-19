// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import { CellSelection } from '@tiptap/pm/tables'
import { undoDepth } from '@tiptap/pm/history'
import { createMarkdownExtensions } from './extensions'
import { parseMarkdownContent, serializeMarkdownContent } from './conversion'
import { parseMarkdownHTML } from './paste'

const editors: Editor[] = []
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  vi.unstubAllGlobals()
})
function editor(source = 'before', onError = vi.fn(), onNotice = vi.fn(), pasteMarkdown = false) {
  const result = parseMarkdownContent({ format: 'markdown', content: source })
  if (!result.ok) throw new Error('fixture')
  const value = new Editor({
    extensions: createMarkdownExtensions({ purpose: 'editing', onError, onNotice, pasteMarkdown }),
    content: result.value,
  })
  editors.push(value)
  return value
}
function paste(value: Editor, html: string, text = '', files: File[] = []) {
  const event = {
    clipboardData: { files, getData: (type: string) => (type === 'text/html' ? html : text) },
  } as unknown as ClipboardEvent
  let handled = false
  value.view.someProp('handlePaste', (fn) => {
    if (fn(value.view, event, null as never)) {
      handled = true
      return true
    }
    return false
  })
  return handled
}
function drop(value: Editor, html: string, pos = 1, files: File[] = []) {
  const coords = vi.spyOn(value.view, 'posAtCoords').mockReturnValue({ pos, inside: -1 })
  const event = {
    clientX: 5,
    clientY: 5,
    dataTransfer: { files, getData: (type: string) => (type === 'text/html' ? html : '') },
  } as unknown as DragEvent
  const handled = value.view.someProp('handleDrop', (fn) =>
    fn(value.view, event, null as never, false),
  )
  coords.mockRestore()
  return handled
}
function text(value: Editor): string {
  return value.state.doc.textBetween(0, value.state.doc.content.size, '\n', '\n')
}
describe('Markdown transaction and paste gate', () => {
  it('coalesces standalone rejections without discarding diagnostics on selection changes', async () => {
    const errors = vi.fn(),
      value = editor('before', errors)
    value.view.dispatch(value.state.tr.insert(0, value.schema.nodes.heading!.create({ level: 7 })))
    value.view.dispatch(
      value.state.tr.insert(1, value.schema.nodes.image!.create({ src: 'javascript:evil' })),
    )
    value.commands.setTextSelection(2)
    await Promise.resolve()
    expect(value.state.doc.textContent).toBe('before')
    expect(errors).toHaveBeenCalledExactlyOnceWith(
      expect.arrayContaining([expect.objectContaining({ code: 'unsafe-content' })]),
    )
  })
  it('reports standalone observer failures globally without retrying or changing the document', () => {
    const failure = new Error('standalone observer'),
      reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const errors = vi.fn(() => {
        throw failure
      }),
      value = editor('before', errors)
    expect(paste(value, '', '', [new File(['x'], 'x.png')])).toBe(true)
    expect(value.state.doc.textContent).toBe('before')
    expect(errors).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
  })
  it('rejects merged and headerless table commands without changing the document', async () => {
    const errors = vi.fn(),
      value = editor('| A | B |\n| --- | --- |\n| C | D |', errors)
    value.view.dispatch(value.state.tr.setSelection(CellSelection.create(value.state.doc, 2, 7)))
    const before = value.getJSON()
    value.commands.mergeCells()
    expect(value.getJSON()).toEqual(before)
    value.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false })
    expect(value.getJSON()).toEqual(before)
    await Promise.resolve()
    expect(errors).toHaveBeenCalled()
  })
  it('keeps text/plain literal rather than executing paste rules', () => {
    const value = editor('')
    expect(paste(value, '', '**literal**\n# plain')).toBe(true)
    expect(value.state.doc.textContent).toBe('**literal**# plain')
    expect(value.getJSON().content![0]!.content![0]!.marks).toBeUndefined()
  })
  it('parses opted-in Markdown paste atomically and restores the original document on undo', () => {
    const value = editor('', vi.fn(), vi.fn(), true)
    expect(paste(value, '', '# 标题\n\n**加粗**\n\n- [x] 完成')).toBe(true)
    expect(value.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })
    expect(value.getJSON().content?.[1]?.content?.[0]?.marks).toContainEqual({ type: 'bold' })
    expect(value.getJSON().content?.[2]).toMatchObject({ type: 'taskList' })
    expect(undoDepth(value.state)).toBe(1)
    value.commands.undo()
    expect(value.state.doc.textContent).toBe('')
  })
  it('keeps plain clipboard text literal inside code even when Markdown paste is enabled', () => {
    const value = editor('```txt\nbefore\n```', vi.fn(), vi.fn(), true)
    value.commands.setTextSelection(7)
    paste(value, '', '\n**literal**\n# plain')
    expect(value.getJSON().content?.[0]).toMatchObject({
      type: 'codeBlock',
      content: [{ type: 'text', text: 'before\n**literal**\n# plain' }],
    })
  })
  it('rejects unsafe opted-in Markdown paste without changing selection or undo history', () => {
    const errors = vi.fn(),
      value = editor('before', errors, vi.fn(), true)
    value.commands.selectAll()
    const before = value.getJSON(),
      selection = value.state.selection
    paste(value, '', '![bad](javascript:evil)')
    expect(value.getJSON()).toEqual(before)
    expect(value.state.selection).toEqual(selection)
    expect(undoDepth(value.state)).toBe(0)
    expect(errors).toHaveBeenCalled()
  })
  it('never deletes the selected document when an opted-in clipboard is empty', () => {
    const value = editor('before', vi.fn(), vi.fn(), true)
    value.commands.selectAll()
    const before = value.getJSON(),
      selection = value.state.selection
    paste(value, '')
    expect(value.getJSON()).toEqual(before)
    expect(value.state.selection).toEqual(selection)
    expect(undoDepth(value.state)).toBe(0)
  })
  it('sanitizes HTML before DOM, keeps supported marks and visible wrapper order', () => {
    const result = parseMarkdownHTML(
      '<details><summary>Title</summary><p><span style="color:red;font-weight:bold">Body</span><u> plain</u></p></details><script>secret()</script><a href="javascript:bad">link</a><img src="data:bad" alt="alt">',
      editor().schema,
    )
    expect(result).toMatchObject({ ok: true, notices: [{ code: 'downgraded-content' }] })
    if (result.ok) {
      expect(result.value.textContent).toBe('TitleBody plainlinkalt')
      expect(result.value.toJSON()).not.toContain('secret')
      expect(result.value.toJSON().content?.[1]?.content?.[0]?.marks).toEqual([{ type: 'bold' }])
    }
  })
  it('keeps simple aligned tables and downgrades merged/multi-block/nested rows without expanding spans', () => {
    const schema = editor().schema
    expect(
      parseMarkdownHTML(
        '<table><tr><th align="right">A</th></tr><tr><td align="right">B</td></tr></table>',
        schema,
      ),
    ).toMatchObject({ ok: true, value: expect.anything() })
    const result = parseMarkdownHTML(
      '<table><tr><td colspan="999999">A<p>B</p><p>C</p></td><td>👩🏽‍💻</td></tr><tr><td><table><tr><td>N</td></tr></table></td><td>D</td></tr></table>',
      schema,
    )
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      expect(result.value.toJSON().content![0]!.type).toBe('paragraph')
      expect(result.value.textBetween(0, result.value.content.size, '\n', '\n')).toContain(
        'A\nB\nC\t👩🏽‍💻',
      )
      const exported = serializeMarkdownContent(result.value.toJSON())
      expect(exported).toMatchObject({ ok: true })
    }
  })
  it('pastes atomically as one undo event and reports one notice', () => {
    const notices = vi.fn(),
      value = editor('before', vi.fn(), notices)
    value.commands.setTextSelection(7)
    expect(paste(value, '<p><u> after</u><strong> bold</strong></p>')).toBe(true)
    expect(value.state.doc.textContent).toBe('before after bold')
    expect(undoDepth(value.state)).toBe(1)
    expect(notices).toHaveBeenCalledTimes(1)
    value.commands.undo()
    expect(value.state.doc.textContent).toBe('before')
  })
  it('consumes files and rejects mixed HTML/file input with no change', () => {
    const errors = vi.fn(),
      value = editor('before', errors)
    expect(paste(value, '<p>after</p>', 'after', [new File(['x'], 'x.png')])).toBe(true)
    expect(value.state.doc.textContent).toBe('before')
    expect(errors).toHaveBeenCalledTimes(1)
  })
  it('rejects a small valid fragment when the full candidate exceeds the node budget', () => {
    const errors = vi.fn(),
      value = editor('', errors)
    const paragraphs = Array.from({ length: 4999 }, () => ({
      type: 'paragraph',
      content: [{ type: 'text', text: 'x' }],
    }))
    expect(value.commands.setContent({ type: 'doc', content: paragraphs })).toBe(true)
    value.commands.setTextSelection(1)
    const before = value.getJSON(),
      selection = value.state.selection,
      depth = undoDepth(value.state)
    expect(paste(value, '<p>a</p><p>b</p>')).toBe(true)
    expect(value.getJSON()).toEqual(before)
    expect(value.state.selection).toEqual(selection)
    expect(undoDepth(value.state)).toBe(depth)
    expect(errors).toHaveBeenCalledTimes(1)
    expect(errors).toHaveBeenCalledWith([{ code: 'limit-exceeded', message: expect.any(String) }])
    expect(drop(value, '<p>a</p><p>b</p>', 1)).toBe(true)
    expect(value.getJSON()).toEqual(before)
    expect(value.state.selection).toEqual(selection)
    expect(undoDepth(value.state)).toBe(depth)
    expect(errors).toHaveBeenCalledTimes(2)
  })
  it('cannot use text fallback to bypass an oversized HTML input', () => {
    const errors = vi.fn(),
      value = editor('before', errors)
    expect(paste(value, '<p>' + 'x'.repeat(8 * 1024 * 1024) + '</p>', 'fallback')).toBe(true)
    expect(value.state.doc.textContent).toBe('before')
    expect(errors).toHaveBeenCalledTimes(1)
  })
  it('rejects multi-paragraph and hard-break cell transactions and retains the selection', () => {
    const value = editor('| A |\n| --- |\n| B |')
    value.commands.setTextSelection(4)
    const before = value.getJSON(),
      selection = value.state.selection
    value.commands.setHardBreak()
    expect(value.getJSON()).toEqual(before)
    expect(value.state.selection).toEqual(selection)
    value.commands.insertContent({ type: 'paragraph', content: [{ type: 'text', text: 'other' }] })
    expect(value.getJSON()).toEqual(before)
  })
  it('ignores clipboard wrapper indentation while preserving paragraph and code whitespace', () => {
    const value = editor('')
    expect(
      paste(
        value,
        '\r\n<!--StartFragment--><p><strong>贴入</strong> <span style="color:red">正文 😀</span></p><!--EndFragment-->\r\n\r\n',
      ),
    ).toBe(true)
    expect(value.state.doc.textContent).toBe('贴入 正文 😀')
    expect(serializeMarkdownContent(value.getJSON())).toMatchObject({
      ok: true,
      value: '**贴入** 正文 😀',
    })
    const code = parseMarkdownHTML('<pre><code>  a\n\tb\n</code></pre>', value.schema)
    expect(code).toMatchObject({ ok: true })
    if (code.ok) expect(code.value.textContent).toBe('  a\n\tb\n')
  })
  it('never upgrades encoded align attribute text into a node in HTML, paste or external drop', () => {
    const attack = `<table><tr><th align='left&quot;&gt;&lt;img src=&quot;/injected.png&quot;&gt;&lt;span x=&quot;'>Original</th></tr></table>`
    const value = editor('')
    const parsed = parseMarkdownHTML(attack, value.schema)
    expect(parsed).toMatchObject({ ok: true, notices: [{ code: 'downgraded-content' }] })
    if (parsed.ok)
      expect(parsed.value.toJSON()).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original' }] }],
      })
    paste(value, attack)
    expect(value.getJSON()).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original' }] }],
    })
    const dropped = editor('')
    expect(drop(dropped, attack)).toBe(true)
    expect(dropped.getJSON()).toEqual(value.getJSON())
  })
  it.each(['<script>ignored()</script>', '<style>hidden</style>', '<p hidden>hidden</p>'])(
    'rejects empty sanitized HTML without deleting selection %s',
    (html) => {
      const errors = vi.fn(),
        value = editor('Existing selection', errors)
      value.commands.selectAll()
      const before = value.getJSON(),
        selection = value.state.selection,
        depth = undoDepth(value.state)
      expect(paste(value, html)).toBe(true)
      expect(value.getJSON()).toEqual(before)
      expect(value.state.selection).toEqual(selection)
      expect(undoDepth(value.state)).toBe(depth)
      expect(errors).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    '<table><tr><th>Only header</th></tr></table>',
    '<table><tr><th>H</th></tr><tr><td>B</td></tr></table>',
    '<table><tr><th>A</th><th>B</th></tr></table>',
  ])('preserves table boundaries in paste and external drop %s', (html) => {
    const value = editor('before after')
    value.commands.setTextSelection(8)
    expect(paste(value, html)).toBe(true)
    expect(value.getJSON().content!.some((node) => node.type === 'table')).toBe(true)
    expect(value.state.doc.textContent).toContain('before ')
    expect(value.state.doc.textContent).toContain('after')
    expect(serializeMarkdownContent(value.getJSON())).toMatchObject({ ok: true })
    const dropped = editor('before after')
    expect(drop(dropped, html, 8)).toBe(true)
    expect(dropped.getJSON()).toEqual(value.getJSON())
    const empty = editor('')
    paste(empty, html)
    expect(empty.getJSON().content![0]!.type).toBe('table')
  })
  it.each([
    {
      html: '<ul><li><input type="checkbox" checked>done<ul><li>regular</li></ul></li></ul>',
      outer: 'taskList',
      inner: 'bulletList',
      checked: true,
    },
    {
      html: '<ul><li>regular<ul><li><input type="checkbox" checked>done</li></ul></li></ul>',
      outer: 'bulletList',
      inner: 'taskList',
      checked: true,
    },
    {
      html: '<ul><li><input type="checkbox" checked>done<ul><li><input type="checkbox">pending</li></ul></li></ul>',
      outer: 'taskList',
      inner: 'taskList',
      checked: false,
    },
  ])('preserves direct-list task identities $outer/$inner', ({ html, outer, inner, checked }) => {
    const value = editor('')
    paste(value, html)
    const json: JSONContent = value.getJSON()
    const list = json.content![0]!,
      nested = list.content![0]!.content![1]!
    expect(list.type).toBe(outer)
    expect(nested.type).toBe(inner)
    expect(list.content![0]!.content).toHaveLength(2)
    expect(nested.content![0]!.type).toBe(inner === 'taskList' ? 'taskItem' : 'listItem')
    if (outer === 'taskList') expect(list.content![0]!.attrs!.checked).toBe(true)
    if (inner === 'taskList') expect(nested.content![0]!.attrs!.checked).toBe(checked)
    expect(serializeMarkdownContent(value.getJSON())).toMatchObject({ ok: true })
  })
  it('keeps captions and nested table row/cell boundaries in original order', () => {
    const notices = vi.fn(),
      value = editor('', vi.fn(), notices)
    paste(
      value,
      '<table><caption>Revenue 2026</caption><tr><th>Amount</th></tr><tr><td>100</td></tr></table>',
    )
    expect(text(value)).toBe('Revenue 2026\nAmount\n100')
    expect(notices).toHaveBeenCalledWith([
      { code: 'downgraded-content', message: expect.any(String) },
    ])
    expect(serializeMarkdownContent(value.getJSON())).toMatchObject({ ok: true })
    const nested = editor('')
    paste(
      nested,
      '<table><tr><td><table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table></td><td>E</td></tr></table>',
    )
    expect(text(nested)).toBe('A\tB\nC\tD\tE')
    expect(serializeMarkdownContent(nested.getJSON())).toMatchObject({ ok: true })
  })
  it.each([
    '<table><tr><th>Visible</th></tr><tbody hidden><tr><td>secret group</td></tr></tbody></table>',
    '<table><tr><th>Visible</th></tr><tr hidden><td>secret row</td></tr></table>',
    '<table><tr><th hidden>secret header</th><th>Visible</th></tr><tr><td>A</td><td style="display:none">secret cell</td></tr></table>',
    '<table><tr><th>Visible</th></tr><tbody style="visibility:hidden"><tr><td>secret</td></tr></tbody></table>',
  ])('filters hidden table ancestors before rectangle checking %s', (html) => {
    const notices = vi.fn(),
      value = editor('', vi.fn(), notices)
    paste(value, html)
    expect(text(value)).not.toContain('secret')
    expect(text(value)).toContain('Visible')
    const exported = serializeMarkdownContent(value.getJSON())
    expect(exported).toMatchObject({ ok: true })
    if (exported.ok) expect(exported.value).not.toContain('secret')
    expect(notices).toHaveBeenCalledTimes(1)
  })
  it.each([
    { html: '<div>First</div><div>Second</div>', expected: 'First\nSecond' },
    {
      html: '<section>First<p>Middle</p>Last</section><aside>Second</aside>',
      expected: 'First\nMiddle\nLast\nSecond',
    },
    { html: '<div><p>First</p><p>Second</p></div>', expected: 'First\nSecond' },
    {
      html: '<details><summary>Title</summary>Body<p>Last</p></details>',
      expected: 'Title\nBody\nLast',
    },
  ])(
    'keeps visible block wrapper boundaries without duplicate paragraphs $html',
    ({ html, expected }) => {
      const value = editor('')
      paste(value, html)
      expect(text(value)).toBe(expected)
      expect(value.getJSON().content!.filter((node) => node.content?.length)).toHaveLength(
        expected.split('\n').length,
      )
      expect(serializeMarkdownContent(value.getJSON())).toMatchObject({ ok: true })
    },
  )
  it.each([
    { html: '<h2>Title</h2>', type: 'heading' },
    { html: '<ul><li>Bullet</li></ul>', type: 'bulletList' },
    {
      html: '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Task</p></li></ul>',
      type: 'taskList',
    },
  ])('preserves the existing single-block paste behavior for $type', ({ html, type }) => {
    const value = editor('')
    paste(value, html)
    expect(value.getJSON().content![0]!.type).toBe(type)
    expect(serializeMarkdownContent(value.getJSON())).toMatchObject({ ok: true })
  })
  it('rejects empty safe external drop and mixed file drop without state changes', () => {
    const errors = vi.fn(),
      value = editor('before', errors)
    value.commands.selectAll()
    const before = value.getJSON(),
      selection = value.state.selection,
      depth = undoDepth(value.state)
    expect(drop(value, '<script>ignored()</script>')).toBe(true)
    expect(drop(value, '<p>after</p>', 1, [new File(['x'], 'x.png')])).toBe(true)
    expect(value.getJSON()).toEqual(before)
    expect(value.state.selection).toEqual(selection)
    expect(undoDepth(value.state)).toBe(depth)
    expect(errors).toHaveBeenCalledTimes(2)
  })
  it.each([
    {
      html: '<table><tr><th hidden>Name</th><th>Amount</th></tr><tr><td>Alice</td><td hidden>100</td></tr></table>',
      text: 'Amount\nAlice',
      table: false,
    },
    {
      html: '<table><tr><th hidden>Name</th><th>Amount</th><th>Role</th></tr><tr><td>Alice</td><td hidden>100</td><td hidden>Admin</td></tr></table>',
      text: 'Amount\tRole\nAlice',
      table: false,
    },
    {
      html: '<table><tr><th hidden>Name</th><th>Amount</th></tr><tr><td hidden>Alice</td><td>100</td></tr></table>',
      text: 'Amount\n100',
      table: true,
    },
    {
      html: '<table><tr><th>Name</th><th>Amount</th></tr><tr><td>Alice</td><td>100</td></tr><tr hidden><td>Mary</td><td>200</td></tr></table>',
      text: 'Name\tAmount\nAlice\t100',
      table: true,
    },
  ])(
    'preserves original visible column identities $text',
    ({ html, text: expectedText, table }) => {
      const value = editor('')
      const parsed = parseMarkdownHTML(html, value.schema)
      expect(parsed).toMatchObject({ ok: true, notices: [{ code: 'downgraded-content' }] })
      if (!parsed.ok) throw new Error('fixture')
      const parsedTable = parsed.value
        .toJSON()
        .content!.find((node: JSONContent) => node.type === 'table')
      const relation = (node: JSONContent) =>
        node
          .content!.map((row) =>
            row
              .content!.map(
                (cell) =>
                  cell.content![0]!.content?.map((child) => child.text ?? '').join('') ?? '',
              )
              .join('\t'),
          )
          .join('\n')
      expect(!!parsedTable).toBe(table)
      if (table) expect(relation(parsedTable!)).toBe(expectedText)
      if (!table)
        expect(parsed.value.textBetween(0, parsed.value.content.size, '\n', '\n')).toBe(
          expectedText,
        )
      for (const method of ['paste', 'drop'] as const) {
        const target = editor('')
        if (method === 'paste') expect(paste(target, html)).toBe(true)
        else expect(drop(target, html)).toBe(true)
        const json: JSONContent = target.getJSON()
        const acceptedTable = json.content!.find((node) => node.type === 'table')
        expect(!!acceptedTable).toBe(table)
        if (table) {
          expect(relation(acceptedTable!)).toBe(expectedText)
        } else expect(text(target)).toBe(expectedText)
        expect(serializeMarkdownContent(target.getJSON())).toMatchObject({ ok: true })
      }
    },
  )
})
