// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef, StrictMode } from 'react'
import type { Editor } from '@tiptap/core'
import { TiptapEditor } from './TiptapEditor'
import type { TiptapEditorHandle } from './types'
import { openInsertBlockAfter } from './insert-block'

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each(['slash', 'after'])(
  'inserts a 3x3 table through the %s block menu and supports undo',
  async (mode) => {
    render(
      <StrictMode>
        <TiptapEditor ariaLabel="table insertion" />
      </StrictMode>,
    )
    const textbox = screen.getByRole('textbox', { name: 'table insertion' })
    const editor = (textbox as HTMLElement & { editor: Editor }).editor
    act(() => {
      textbox.focus()
      if (mode === 'after') openInsertBlockAfter(editor, 0)
      else
        editor.view.someProp('handleKeyDown', (handler) =>
          handler(editor.view, new KeyboardEvent('keydown', { key: '/' })),
        )
    })
    const popup = await screen.findByRole('dialog', { name: '插入块' })
    fireEvent.click(within(popup).getByRole('button', { name: '表格' }))
    expect(textbox.querySelectorAll('tr')).toHaveLength(3)
    expect(textbox.querySelectorAll('th')).toHaveLength(3)
    expect(textbox.querySelectorAll('td')).toHaveLength(6)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.isActive('table')).toBe(true)
    act(() => {
      editor.commands.undo()
    })
    expect(textbox.querySelector('table')).toBeNull()
    expect(textbox.textContent).toBe(mode === 'slash' ? '/' : '')
  },
)

it('edits rows and columns through table-local handles without a toolbar table button', async () => {
  const ref = createRef<TiptapEditorHandle>()
  render(
    <TiptapEditor
      ref={ref}
      ariaLabel="table operations"
      initialContent={{ format: 'markdown', content: '| A | B |\n| --- | --- |\n| C | D |' }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'table operations' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  expect(screen.queryByRole('toolbar')).toBeNull()
  const shell = textbox.querySelector('[data-tiptap-table]') as HTMLElement
  expect(shell).toBeTruthy()
  fireEvent.click(await within(shell).findByRole('button', { name: '第 2 行操作' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: '在下方插入行' }))
  expect(textbox.querySelectorAll('tr')).toHaveLength(3)
  fireEvent.click(within(shell).getByRole('button', { name: '第 2 列操作' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: '在右侧插入列' }))
  expect(textbox.querySelector('tr')?.children).toHaveLength(3)
  fireEvent.click(within(shell).getByRole('button', { name: '表格菜单' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: '切换表头行' }))
  expect(textbox.querySelectorAll('th')).toHaveLength(0)
  expect(ref.current!.exportMarkdown().ok).toBe(true)
  fireEvent.click(within(shell).getByRole('button', { name: '表格菜单' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: '删除表格' }))
  expect(textbox.querySelector('table')).toBeNull()
})

it('dismisses table actions after replacement and hides them in readonly mode', async () => {
  const ref = createRef<TiptapEditorHandle>()
  const { rerender } = render(
    <TiptapEditor
      ref={ref}
      ariaLabel="table lifetime"
      initialContent={{ format: 'markdown', content: '| A |\n| --- |\n| B |' }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'table lifetime' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  fireEvent.click(await screen.findByRole('button', { name: '表格菜单' }))
  await screen.findByRole('menuitem', { name: '删除表格' })
  act(() => {
    expect(ref.current!.replaceContent({ format: 'markdown', content: 'replacement' }).ok).toBe(
      true,
    )
  })
  expect(screen.queryByRole('menuitem', { name: '删除表格' })).toBeNull()
  expect(textbox.textContent).toBe('replacement')
  rerender(<TiptapEditor ref={ref} ariaLabel="table lifetime" editable={false} />)
  expect(screen.queryByRole('button', { name: '表格菜单' })).toBeNull()
})

it('appends rows and columns at table edges and keeps controls out of Markdown', async () => {
  const ref = createRef<TiptapEditorHandle>()
  const { rerender } = render(
    <TiptapEditor
      ref={ref}
      ariaLabel="table edges"
      initialContent={{ format: 'markdown', content: '| A | B |\n| --- | --- |\n| C | D |' }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'table edges' })
  fireEvent.click(await screen.findByRole('button', { name: '追加一行' }))
  expect(textbox.querySelectorAll('tr')).toHaveLength(3)
  fireEvent.click(screen.getByRole('button', { name: '追加一列' }))
  expect(textbox.querySelector('tr')?.children).toHaveLength(3)
  const output = ref.current!.exportMarkdown()
  expect(output.ok).toBe(true)
  if (output.ok) expect(output.value).not.toMatch(/button|data-tiptap-table|追加|操作/)
  fireEvent.click(screen.getByRole('button', { name: '第 2 行操作' }))
  await screen.findByRole('menuitem', { name: '删除当前行' })
  rerender(<TiptapEditor ref={ref} ariaLabel="table edges" editable={false} />)
  await waitFor(() => expect(screen.queryByRole('button', { name: '追加一行' })).toBeNull())
  expect(screen.queryByRole('menuitem', { name: '删除当前行' })).toBeNull()
  expect(textbox.querySelector('table')).toBeTruthy()
})

it('maps the captured row when earlier content changes and deletes the intended row', async () => {
  render(
    <TiptapEditor
      ariaLabel="table mapped row"
      initialContent={{
        format: 'markdown',
        content: 'before\n\n| A | B |\n| --- | --- |\n| C | D |\n| E | F |',
      }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'table mapped row' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  fireEvent.click(await screen.findByRole('button', { name: '第 2 行操作' }))
  await screen.findByRole('menuitem', { name: '删除当前行' })
  act(() => {
    editor.commands.insertContentAt(1, 'changed ')
  })
  fireEvent.click(screen.getByRole('menuitem', { name: '删除当前行' }))
  expect([...textbox.querySelectorAll('tr')].map((row) => row.textContent)).toEqual(['AB', 'EF'])
  expect(editor.getText()).toContain('changed before')
})

it('keeps reused table views operable after importing the same document again', async () => {
  const ref = createRef<TiptapEditorHandle>(),
    initialContent = { format: 'markdown' as const, content: '| A | B |\n| --- | --- |\n| C | D |' }
  render(<TiptapEditor ref={ref} ariaLabel="same table" initialContent={initialContent} />)
  await screen.findByRole('button', { name: '追加一行' })
  act(() => {
    expect(ref.current!.replaceContent(initialContent).ok).toBe(true)
  })
  fireEvent.click(screen.getByRole('button', { name: '追加一行' }))
  expect(screen.getByRole('textbox', { name: 'same table' }).querySelectorAll('tr')).toHaveLength(3)
})

it.each([
  [
    'row',
    '<table><tr><td rowspan="2"><p>A</p></td><td><p>B</p></td></tr><tr><td><p>C</p></td></tr><tr><td><p>D</p></td><td><p>E</p></td></tr></table>',
    '第 2 行操作',
    '删除当前行',
    ['AB', 'DE'],
  ],
  [
    'column',
    '<table><tr><td colspan="2"><p>A</p></td><td><p>B</p></td></tr><tr><td><p>C</p></td><td><p>D</p></td><td><p>E</p></td></tr></table>',
    '第 2 列操作',
    '删除当前列',
    ['AB', 'CE'],
  ],
] as const)(
  'deletes only the indicated %s through a merged cell',
  async (_kind, content, handle, action, rows) => {
    render(
      <TiptapEditor ariaLabel="merged target" initialContent={{ format: 'markdown', content }} />,
    )
    fireEvent.click(await screen.findByRole('button', { name: handle }))
    fireEvent.click(await screen.findByRole('menuitem', { name: action }))
    expect(
      [...screen.getByRole('textbox', { name: 'merged target' }).querySelectorAll('tr')].map(
        (row) => row.textContent,
      ),
    ).toEqual(rows)
  },
)

it('disables deleting the last row or column while keeping whole-table deletion available', async () => {
  render(
    <TiptapEditor
      ariaLabel="last row"
      initialContent={{ format: 'markdown', content: '| A |\n| --- |' }}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '第 1 行操作' }))
  expect(
    (await screen.findByRole('menuitem', { name: '删除当前行' })).hasAttribute('disabled'),
  ).toBe(true)
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: '第 1 列操作' }))
  expect(
    (await screen.findByRole('menuitem', { name: '删除当前列' })).hasAttribute('disabled'),
  ).toBe(true)
})

it('navigates the wrapped content row to insert a table using only the keyboard', async () => {
  render(<TiptapEditor ariaLabel="table keyboard" />)
  const textbox = screen.getByRole('textbox', { name: 'table keyboard' })
  act(() => {
    textbox.focus()
  })
  fireEvent.keyDown(textbox, { key: '/' })
  await screen.findByRole('dialog', { name: '插入块' })
  for (let row = 0; row < 7; row++) fireEvent.keyDown(textbox, { key: 'ArrowDown' })
  fireEvent.keyDown(textbox, { key: 'Enter' })
  expect(textbox.querySelectorAll('tr')).toHaveLength(3)
})
