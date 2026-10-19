// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef, StrictMode } from 'react'
import type { Editor } from '@tiptap/core'
import { TiptapEditor } from './TiptapEditor'
import type { TiptapEditorHandle } from './types'
import {
  insertBlock,
  openInsertBlockAfter,
  readInsertBlockAnchor,
  type InsertBlockType,
} from './insert-block'

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
  // Details corrects selections in hidden DOM; jsdom has no layout, so model
  // the visible NodeViews rather than testing its hidden-node fallback.
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.parentElement
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
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function input(textbox: HTMLElement, text = '/') {
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    textbox.focus()
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', (handler) =>
      handler(editor.view, from, to, text, () => editor.state.tr.insertText(text, from, to)),
    )
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(text, from, to))
  })
  return editor
}

it('opens the classified icon menu only on direct / and transforms the same empty paragraph', async () => {
  const ref = createRef<TiptapEditorHandle>()
  render(
    <StrictMode>
      <TiptapEditor ref={ref} ariaLabel="insert blocks" />
    </StrictMode>,
  )
  const textbox = screen.getByRole('textbox', { name: 'insert blocks' })
  const editor = input(textbox)
  const popup = await screen.findByRole('dialog', { name: '插入块' })
  expect(
    within(popup)
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label')),
  ).toEqual(['文字', '列表', '内容', '提示'])
  expect(within(popup).getAllByRole('button')).toHaveLength(18)
  expect(within(popup).queryByRole('textbox')).toBeNull()
  expect(popup.textContent).not.toMatch(/搜索|选择.*插入|Esc/)
  expect(document.activeElement).toBe(textbox)
  fireEvent.click(within(popup).getByRole('button', { name: '标题 2' }))
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  expect(editor.state.doc.child(0).type.name).toBe('heading')
  expect(editor.state.doc.child(0).attrs.level).toBe(2)
  expect(editor.state.doc.child(0).textContent).toBe('')
  expect(editor.state.doc.childCount).toBe(2) // Heading plus the shared trailing paragraph.
  expect(editor.state.selection.from).toBe(1)
  expect(document.activeElement).toBe(textbox)
  act(() => {
    editor.commands.undo()
  })
  expect(textbox.textContent).toBe('/')
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
})

it('keeps / on Escape, outside focus and failed replacement, and invalidates a successful replacement', async () => {
  const ref = createRef<TiptapEditorHandle>()
  const { rerender } = render(
    <>
      <TiptapEditor ref={ref} ariaLabel="cancel blocks" />
      <button>Outside</button>
    </>,
  )
  const textbox = screen.getByRole('textbox', { name: 'cancel blocks' })
  const editor = input(textbox)
  await screen.findByRole('dialog', { name: '插入块' })
  fireEvent.keyDown(textbox, { key: 'Escape' })
  expect(textbox.textContent).toBe('/')
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: '' })
  })
  input(textbox)
  await screen.findByRole('dialog', { name: '插入块' })
  act(() => {
    expect(ref.current!.replaceContent({ format: 'json', content: { type: 'unknown' } }).ok).toBe(
      false,
    )
  })
  expect(screen.queryByRole('dialog', { name: '插入块' })).not.toBeNull()
  act(() => {
    screen.getByRole('button', { name: 'Outside' }).focus()
  })
  expect(textbox.textContent).toBe('/')
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside' }))
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: '' })
  })
  input(textbox)
  await screen.findByRole('dialog', { name: '插入块' })
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: 'replacement' })
  })
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  act(() => {
    editor.commands.clearContent()
  })
  input(textbox)
  await screen.findByRole('dialog', { name: '插入块' })
  rerender(<TiptapEditor ref={ref} ariaLabel="cancel blocks" editable={false} />)
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
})

it.each(['slash', 'after'] as const)(
  'navigates the two-column menu across short category rows in %s mode',
  async (mode) => {
    render(<TiptapEditor ariaLabel="keyboard blocks" />)
    const textbox = screen.getByRole('textbox', { name: 'keyboard blocks' })
    const editor = (textbox as HTMLElement & { editor: Editor }).editor
    if (mode === 'slash') input(textbox)
    else
      act(() => {
        openInsertBlockAfter(editor, 0)
      })
    const popup = await screen.findByRole('dialog', { name: '插入块' })
    const move = (key: string, label: string) => {
      fireEvent.keyDown(mode === 'slash' ? textbox : document.activeElement!, { key })
      const button = within(popup).getByRole('button', { name: label })
      expect(button.getAttribute('data-active')).toBe('true')
      expect(document.activeElement).toBe(mode === 'slash' ? textbox : button)
    }
    move('ArrowDown', '标题 2')
    move('ArrowUp', '正文')
    move('ArrowRight', '标题 1')
    move('ArrowDown', '标题 3')
    move('ArrowDown', '标题 4')
    move('ArrowDown', '无序列表')
    move('ArrowDown', '任务列表')
    move('ArrowDown', '引用') // Disabled image must not capture keyboard selection.
    move('End', '危险')
    move('Home', '正文')
    move('ArrowDown', '标题 2')
    fireEvent.keyDown(mode === 'slash' ? textbox : document.activeElement!, { key: 'Enter' })
    expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
    expect(editor.state.doc.child(mode === 'slash' ? 0 : 1).type.name).toBe('heading')
    expect(editor.state.doc.child(mode === 'slash' ? 0 : 1).attrs.level).toBe(2)
  },
)

it('does not trigger on existing text, code, nested paragraphs, composition, imports or ordinary transactions', () => {
  const ref = createRef<TiptapEditorHandle>()
  render(<TiptapEditor ref={ref} ariaLabel="guard blocks" />)
  const textbox = screen.getByRole('textbox', { name: 'guard blocks' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  const reset = (content: string) =>
    act(() => {
      ref.current!.replaceContent({ format: 'markdown', content })
    })
  reset('/')
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  reset('existing')
  input(textbox)
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  reset('')
  act(() => {
    editor.commands.toggleCodeBlock()
  })
  input(textbox)
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  reset('')
  act(() => {
    editor.commands.toggleBulletList()
  })
  input(textbox)
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  reset('')
  fireEvent.compositionStart(textbox)
  input(textbox)
  fireEvent.compositionEnd(textbox)
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  reset('')
  act(() => {
    editor.commands.insertContent('/')
  })
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
})

it('inserts below the whole top-level list and maps that target through earlier edits', async () => {
  render(
    <TiptapEditor
      ariaLabel="after blocks"
      initialContent={{ format: 'markdown', content: '- original\n  - nested\n\nafter' }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'after blocks' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  const before = editor.getJSON()
  act(() => {
    expect(openInsertBlockAfter(editor, 2)).toBe(false)
  })
  expect(editor.getJSON()).toEqual(before)
  act(() => {
    expect(openInsertBlockAfter(editor, 0)).toBe(true)
  })
  const popup = await screen.findByRole('dialog', { name: '插入块' })
  act(() => {
    editor.view.dispatch(
      editor.state.tr.insert(
        0,
        editor.schema.nodes.paragraph!.create(null, editor.schema.text('prefix')),
      ),
    )
  })
  fireEvent.click(within(popup).getByRole('button', { name: '引用' }))
  expect(editor.state.doc.child(0).textContent).toBe('prefix')
  expect(editor.state.doc.child(1).type.name).toBe('bulletList')
  expect(editor.state.doc.child(1).textContent).toBe('originalnested')
  expect(editor.state.doc.child(2).type.name).toBe('blockquote')
  expect(editor.state.doc.child(3).textContent).toBe('after')
  expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  expect(editor.state.selection.$from.depth).toBe(2)
})

it('invalidates an original target replaced within a single transaction, and refuses late selection', async () => {
  render(
    <TiptapEditor
      ariaLabel="deleted blocks"
      initialContent={{ format: 'markdown', content: 'original\n\nafter' }}
    />,
  )
  const editor = (
    screen.getByRole('textbox', { name: 'deleted blocks' }) as HTMLElement & { editor: Editor }
  ).editor
  act(() => {
    openInsertBlockAfter(editor, 0)
  })
  await screen.findByRole('dialog', { name: '插入块' })
  act(() => {
    editor.view.dispatch(
      editor.state.tr
        .delete(0, 10)
        .insert(0, editor.schema.nodes.paragraph!.create(null, editor.schema.text('replacement'))),
    )
  })
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  const snapshot = editor.getJSON()
  act(() => {
    expect(insertBlock(editor, 'h1')).toBe(false)
  })
  expect(editor.getJSON()).toEqual(snapshot)
})

it.each([
  ['text', 'paragraph', 1],
  ['h1', 'heading', 1],
  ['h4', 'heading', 1],
  ['bullet', 'bulletList', 3],
  ['ordered', 'orderedList', 3],
  ['task', 'taskList', 3],
  ['quote', 'blockquote', 2],
  ['code', 'codeBlock', 1],
  ['divider', 'horizontalRule', 2],
  ['details', 'details', 2],
  ['tip', 'admonition', 6],
  ['info', 'admonition', 6],
  ['warning', 'admonition', 6],
  ['error', 'admonition', 6],
] as const)(
  'inserts a valid %s block with the caret inside its editable part',
  (type, nodeType, selection) => {
    const ref = createRef<TiptapEditorHandle>()
    render(<TiptapEditor ref={ref} ariaLabel="block types" />)
    const editor = input(screen.getByRole('textbox', { name: 'block types' }))
    act(() => {
      expect(insertBlock(editor, type as InsertBlockType)).toBe(true)
    })
    expect(editor.state.doc.firstChild!.type.name).toBe(nodeType)
    expect(editor.state.doc.textContent).not.toContain('/')
    expect(editor.state.selection.from).toBe(selection)
    expect(editor.state.selection.$from.parent.isTextblock).toBe(true)
    expect(ref.current!.exportMarkdown().ok).toBe(true)
  },
)

it('replaces / with a successfully uploaded image and preserves it on file cancellation', async () => {
  let finish!: (image: { src: string }) => void
  render(
    <TiptapEditor
      ariaLabel="block image"
      uploadImage={() =>
        new Promise((resolve) => {
          finish = resolve
        })
      }
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'block image' })
  const editor = input(textbox)
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '插入块' })).getByRole('button', {
      name: '图片',
    }),
  )
  expect(screen.queryByRole('dialog', { name: '插入块' })).toBeNull()
  const file = screen.getByLabelText('插入块图片')
  fireEvent(file, new Event('cancel'))
  expect(textbox.textContent).toBe('/')
  act(() => {
    editor.commands.clearContent()
  })
  input(textbox)
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '插入块' })).getByRole('button', {
      name: '图片',
    }),
  )
  fireEvent.change(screen.getByLabelText('插入块图片'), {
    target: { files: [new File(['image'], 'example.png', { type: 'image/png' })] },
  })
  expect(textbox.textContent).toBe('/')
  await act(async () => {
    finish({ src: 'https://example.com/image.png' })
    await Promise.resolve()
  })
  expect(editor.state.doc.firstChild!.type.name).toBe('image')
  expect(textbox.textContent).toBe('')
})

it('does not consume newer text when a slash image upload finishes late', async () => {
  let finish!: (image: { src: string }) => void
  render(
    <TiptapEditor
      ariaLabel="late block image"
      uploadImage={() =>
        new Promise((resolve) => {
          finish = resolve
        })
      }
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'late block image' })
  const editor = input(textbox)
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '插入块' })).getByRole('button', {
      name: '图片',
    }),
  )
  fireEvent.change(screen.getByLabelText('插入块图片'), {
    target: { files: [new File(['image'], 'example.png', { type: 'image/png' })] },
  })
  act(() => {
    editor.commands.insertContent('new text')
  })
  await act(async () => {
    finish({ src: 'https://example.com/image.png' })
    await Promise.resolve()
  })
  expect(textbox.textContent).toBe('/new text')
  expect(editor.state.doc.firstChild!.type.name).toBe('paragraph')
  expect(editor.state.doc.childCount).toBe(1)
})

it('uploads below the original whole block after preceding edits and preserves the current selection', async () => {
  let finish!: (image: { src: string }) => void
  render(
    <TiptapEditor
      ariaLabel="after image"
      initialContent={{ format: 'markdown', content: '- original\n  - nested\n\nafter' }}
      uploadImage={() =>
        new Promise((resolve) => {
          finish = resolve
        })
      }
    />,
  )
  const editor = (
    screen.getByRole('textbox', { name: 'after image' }) as HTMLElement & { editor: Editor }
  ).editor
  act(() => {
    openInsertBlockAfter(editor, 0)
  })
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '插入块' })).getByRole('button', {
      name: '图片',
    }),
  )
  fireEvent.change(screen.getByLabelText('插入块图片'), {
    target: { files: [new File(['image'], 'example.png', { type: 'image/png' })] },
  })
  act(() => {
    editor.view.dispatch(
      editor.state.tr.insert(
        0,
        editor.schema.nodes.paragraph!.create(null, editor.schema.text('prefix')),
      ),
    )
    editor.commands.setTextSelection(1)
  })
  await act(async () => {
    finish({ src: 'https://example.com/image.png' })
    await Promise.resolve()
  })
  expect(editor.state.doc.child(0).textContent).toBe('prefix')
  expect(editor.state.doc.child(1).type.name).toBe('bulletList')
  expect(editor.state.doc.child(1).textContent).toBe('originalnested')
  expect(editor.state.doc.child(2).type.name).toBe('image')
  expect(editor.state.doc.child(3).textContent).toBe('after')
  expect(editor.state.selection.from).toBe(1)
})

it('drops an after-block image when the source block is deleted, even if its callback ignores abort', async () => {
  let finish!: (image: { src: string }) => void, signal!: AbortSignal
  render(
    <TiptapEditor
      ariaLabel="deleted after image"
      initialContent={{ format: 'markdown', content: 'original\n\nafter' }}
      uploadImage={(_file, context) => {
        signal = context.signal
        return new Promise((resolve) => {
          finish = resolve
        })
      }}
    />,
  )
  const editor = (
    screen.getByRole('textbox', { name: 'deleted after image' }) as HTMLElement & { editor: Editor }
  ).editor
  act(() => {
    openInsertBlockAfter(editor, 0)
  })
  fireEvent.click(
    within(await screen.findByRole('dialog', { name: '插入块' })).getByRole('button', {
      name: '图片',
    }),
  )
  fireEvent.change(screen.getByLabelText('插入块图片'), {
    target: { files: [new File(['image'], 'example.png', { type: 'image/png' })] },
  })
  act(() => {
    editor.commands.deleteRange({ from: 0, to: 10 })
  })
  const before = editor.getJSON()
  await act(async () => {
    finish({ src: 'https://example.com/image.png' })
    await Promise.resolve()
  })
  expect(signal.aborted).toBe(true)
  expect(editor.getJSON()).toEqual(before)
})
