// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { Editor } from '@tiptap/core'
import { ExplicitToolbarEditor as TiptapEditor } from './testing/ExplicitToolbarEditor'
import type { TiptapEditorHandle } from './types'
import { createTiptapExtensions } from './extensions'
import { TiptapLifecycle } from './lifecycle'
import { OfficialUiProvider } from './official/integration'
import { TooltipProvider } from './official/primitives'
import { ColorHighlightPopover } from './official/components/tiptap-ui/color-highlight-popover'
import { parseTiptapContent } from './conversion'
import { isExtensionAvailable } from './official/lib/tiptap-utils'
import { toggleList } from './official/components/tiptap-ui/list-button'
import { toggleHeading } from './official/components/tiptap-ui/heading-button'
import { toggleBlockquote } from './official/components/tiptap-ui/blockquote-button'
import { toggleCodeBlock } from './official/components/tiptap-ui/code-block-button'

const standalone: Editor[] = []

beforeEach(() => {
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
  standalone.splice(0).forEach((editor) => editor.destroy())
  vi.unstubAllGlobals()
})

it('uses one combined color popup on the reduced official toolbar', async () => {
  render(
    <TiptapEditor
      ariaLabel="official editor"
      initialContent={{ format: 'markdown', content: 'selected text' }}
    />,
  )
  await screen.findByRole('toolbar', { name: '富文本工具栏' })
  // The previous toolbar exposed More to access its custom feature panels.
  expect(screen.queryByRole('button', { name: '更多' })).toBeNull()
  expect(screen.queryByRole('button', { name: '字号' })).toBeNull()
  expect(screen.queryByRole('button', { name: '图片地址' })).toBeNull()
  expect(screen.queryByRole('button', { name: '插入区块' })).toBeNull()
  expect(screen.queryByRole('button', { name: '文字颜色' })).toBeNull()
  expect(screen.getByRole('button', { name: '高亮' })).toBeTruthy()
  const textbox = screen.getByRole('textbox', { name: 'official editor' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 9 })
  })
  fireEvent.click(screen.getByRole('button', { name: '粗体' }))
  expect(textbox.querySelector('strong')?.textContent).toBe('selected')
  expect(screen.getByRole('button', { name: '粗体' }).getAttribute('aria-pressed')).toBe('true')
})

it('dismisses a link panel when explicit replacement invalidates its document target', async () => {
  const ref = createRef<TiptapEditorHandle>()
  render(
    <TiptapEditor
      ref={ref}
      ariaLabel="replacement editor"
      initialContent={{ format: 'markdown', content: 'old text' }}
    />,
  )
  await waitFor(() => expect(ref.current?.readJSON().ok).toBe(true))
  fireEvent.click(screen.getByRole('button', { name: '编辑链接' }))
  const address = await screen.findByRole('textbox', { name: '链接地址' })
  fireEvent.change(address, { target: { value: 'https://example.test/obsolete' } })
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: 'new text' })
  })
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '链接地址' })).toBeNull())
  expect(screen.getByRole('textbox', { name: 'replacement editor' }).textContent).toBe('new text')
})

function renderColors() {
  const runtime = new TiptapLifecycle(() => ({}))
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapExtensions({ purpose: 'editing' }), runtime.extension()],
    content: '<p>selected tail</p>',
  })
  standalone.push(editor)
  runtime.attach(editor)
  editor.commands.setTextSelection({ from: 1, to: 9 })
  render(
    <OfficialUiProvider editor={editor} runtime={runtime} upload={() => {}}>
      <TooltipProvider>
        <ColorHighlightPopover
          editor={editor}
          colors={[{ label: '成功', value: '#00aa00', border: '#000000' }]}
          textColors={[
            { label: '链接', value: '#123456', border: '#123456' },
            { label: '危险', value: '#ee0000', border: '#ee0000' },
          ]}
        />
      </TooltipProvider>
    </OfficialUiProvider>,
  )
  return { editor, runtime }
}

it('applies a literal highlight synchronously and exports it without storing theme variables', async () => {
  const { editor, runtime } = renderColors()
  fireEvent.click(screen.getByRole('button', { name: '高亮' }))
  fireEvent.click(await screen.findByRole('button', { name: '高亮 成功' }))
  expect(editor.getAttributes('highlight').color).toBe('#00aa00')
  const exported = runtime.export()
  expect(exported.ok).toBe(true)
  if (exported.ok) {
    expect(exported.value).not.toContain('var(')
    expect(parseTiptapContent({ format: 'markdown', content: exported.value }).ok).toBe(true)
  }
})

it('applies and clears text color and highlight independently in the same popup', async () => {
  const { editor } = renderColors()
  fireEvent.click(screen.getByRole('button', { name: '高亮' }))
  fireEvent.click(await screen.findByRole('button', { name: '文字颜色 链接' }))
  expect(editor.getAttributes('textStyle').color).toBe('#123456')
  fireEvent.click(screen.getByRole('button', { name: '高亮 成功' }))
  expect(editor.getAttributes('highlight').color).toBe('#00aa00')
  expect(editor.getAttributes('textStyle').color).toBe('#123456')
  fireEvent.click(screen.getByRole('button', { name: '清除文字颜色' }))
  expect(editor.getAttributes('textStyle').color).toBeFalsy()
  expect(editor.getAttributes('highlight').color).toBe('#00aa00')
  fireEvent.click(screen.getByRole('button', { name: '文字颜色 危险' }))
  fireEvent.click(screen.getByRole('button', { name: '清除高亮' }))
  expect(editor.getAttributes('textStyle').color).toBe('#ee0000')
  expect(editor.isActive('highlight')).toBe(false)
})

it('disposes a closed combined-color selection so later commands target the current selection', async () => {
  const { editor } = renderColors()
  fireEvent.click(screen.getByRole('button', { name: '高亮' }))
  fireEvent.click(await screen.findByRole('button', { name: '文字颜色 链接' }))
  fireEvent.click(screen.getByRole('button', { name: '高亮' }))
  act(() => {
    editor.commands.setTextSelection({ from: 10, to: 14 })
  })
  fireEvent.click(screen.getByRole('button', { name: '高亮' }))
  fireEvent.click(await screen.findByRole('button', { name: '文字颜色 危险' }))
  const children = editor.getJSON().content![0]!.content!
  expect(
    children
      .find((node) => 'text' in node && node.text === 'selected')
      ?.marks?.find((mark) => mark.type === 'textStyle')?.attrs?.color,
  ).toBe('#123456')
  expect(
    children
      .find((node) => 'text' in node && node.text === 'tail')
      ?.marks?.find((mark) => mark.type === 'textStyle')?.attrs?.color,
  ).toBe('#ee0000')
})

it('ignores a file picker retained from a replaced document', async () => {
  const ref = createRef<TiptapEditorHandle>(),
    upload = vi.fn(async () => ({ src: '/obsolete.png' }))
  render(<TiptapEditor ref={ref} ariaLabel="picker editor" uploadImage={upload} />)
  await waitFor(() => expect(ref.current?.readJSON().ok).toBe(true))
  fireEvent.click(screen.getByRole('button', { name: '上传本地图片' }))
  const picker = screen.getByLabelText('选择本地图片')
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: 'new document' })
  })
  fireEvent.change(picker, { target: { files: [new File(['x'], 'obsolete.png')] } })
  expect(upload).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'picker editor' }).textContent).toBe('new document')
})

it('treats a discarded StrictMode editor as unavailable when checking official capabilities', () => {
  const editor = new Editor({ extensions: createTiptapExtensions({ purpose: 'editing' }) })
  editor.destroy()
  expect(isExtensionAvailable(editor, 'textAlign')).toBe(false)
})

it.each([
  ['heading', (editor: Editor) => toggleHeading(editor, 2), 'heading'],
  ['list', (editor: Editor) => toggleList(editor, 'bulletList'), 'bulletList'],
  ['blockquote', toggleBlockquote, 'blockquote'],
  ['code block', toggleCodeBlock, 'codeBlock'],
] as const)(
  'formats every selected paragraph through the official %s command',
  (_name, toggle, nodeType) => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapExtensions({ purpose: 'editing' }),
      content: '<p>alpha</p><p>beta</p><p>gamma</p>',
    })
    standalone.push(editor)
    editor.commands.setTextSelection({ from: 1, to: 12 })
    expect(toggle(editor)).toBe(true)
    const doc = editor.getJSON()
    if (nodeType === 'heading' || nodeType === 'codeBlock') {
      expect(doc.content!.slice(0, 2).map((node) => node.type)).toEqual([nodeType, nodeType])
    } else {
      expect(doc.content![0]!.type).toBe(nodeType)
      expect(editor.state.doc.firstChild!.textContent).toContain('alpha')
      expect(editor.state.doc.firstChild!.textContent).toContain('beta')
    }
    expect(editor.state.doc.lastChild!.type.name).toBe('paragraph')
    expect(editor.state.doc.lastChild!.textContent).toBe('gamma')
  },
)
