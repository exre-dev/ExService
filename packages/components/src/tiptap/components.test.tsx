// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRef, StrictMode } from 'react'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from './extensions'
import { TiptapLifecycle } from './lifecycle'
import { TiptapToolbar } from './toolbar/TiptapToolbar'
import { ExplicitToolbarEditor as TiptapEditor } from './testing/ExplicitToolbarEditor'
import { TiptapViewer } from './TiptapViewer'
import type { TiptapEditorHandle, TiptapInput } from './types'

// Official focus commands schedule an animation frame. Finish that real work
// while its document is still mounted, before Testing Library removes the DOM.
beforeEach(() => {
  // ExUI floating primitives need this browser geometry boundary even though
  // zero jsdom dimensions deliberately keep the toolbar in its fallback layout.
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
})
const initial: TiptapInput = { format: 'markdown', content: 'original' }

const inputHint = '输入，或者按 "/" 查看命令，按 "$" 打开 Emoji。'
it('shows the command placeholder only while an empty paragraph is editable and keeps it out of saved content', async () => {
  const ref = createRef<TiptapEditorHandle>()
  const { rerender } = render(
    <>
      <TiptapEditor ref={ref} ariaLabel="placeholder editor" toolbar={false} />
      <TiptapViewer content={{ format: 'markdown', content: '' }} ariaLabel="placeholder viewer" />
    </>,
  )
  const textbox = screen.getByRole('textbox', { name: 'placeholder editor' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  expect(textbox.querySelector('p')?.getAttribute('data-placeholder')).toBe(inputHint)
  expect(textbox.textContent).toBe('')
  expect(
    screen.getByRole('region', { name: 'placeholder viewer' }).querySelector('[data-placeholder]'),
  ).toBeNull()
  expect(JSON.stringify(ref.current!.readJSON())).not.toContain(inputHint)
  expect(ref.current!.exportMarkdown().ok).toBe(true)
  expect(JSON.stringify(ref.current!.exportMarkdown())).not.toContain(inputHint)
  act(() => {
    editor.commands.insertContent('written')
  })
  expect(textbox.querySelector('[data-placeholder]')).toBeNull()
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: '' })
  })
  expect(textbox.querySelector('p')?.getAttribute('data-placeholder')).toBe(inputHint)
  rerender(
    <TiptapEditor ref={ref} ariaLabel="placeholder editor" toolbar={false} editable={false} />,
  )
  expect(textbox.querySelector('[data-placeholder]')).toBeNull()
})

it('moves the placeholder with the selected top-level paragraph and excludes headings and nested paragraphs', () => {
  render(
    <TiptapEditor
      ariaLabel="selected placeholder"
      toolbar={false}
      initialContent={{
        format: 'json',
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph' },
            { type: 'paragraph' },
            { type: 'heading', attrs: { level: 2 } },
            { type: 'blockquote', content: [{ type: 'paragraph' }] },
            { type: 'paragraph' },
          ],
        },
      }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'selected placeholder' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  expect(textbox.querySelectorAll(`[data-placeholder='${inputHint}']`)).toHaveLength(1)
  act(() => {
    editor.commands.setTextSelection(3)
  })
  expect(textbox.children[0]?.hasAttribute('data-placeholder')).toBe(false)
  expect(textbox.children[1]?.getAttribute('data-placeholder')).toBe(inputHint)
  act(() => {
    editor.commands.setTextSelection(5)
  })
  expect(textbox.querySelectorAll(`[data-placeholder='${inputHint}']`)).toHaveLength(0)
  act(() => {
    editor.commands.setTextSelection(8)
  })
  expect(textbox.querySelectorAll(`[data-placeholder='${inputHint}']`)).toHaveLength(0)
})

it('survives StrictMode passive effect replay with real editor and viewer instances', async () => {
  const ref = createRef<TiptapEditorHandle>()
  const { rerender } = render(
    <StrictMode>
      <TiptapEditor ref={ref} initialContent={initial} ariaLabel="strict editor" toolbar={false} />
      <TiptapViewer content={initial} ariaLabel="strict viewer" />
    </StrictMode>,
  )
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'strict viewer' }).textContent).toBe('original'),
  )
  act(() => {
    expect(ref.current!.replaceContent({ format: 'markdown', content: 'replacement' }).ok).toBe(
      true,
    )
  })
  expect(screen.getByRole('textbox', { name: 'strict editor' }).textContent).toBe('replacement')
  const original = screen.getByRole('region', { name: 'strict viewer' })
  rerender(
    <StrictMode>
      <TiptapEditor
        ref={ref}
        initialContent={initial}
        ariaLabel="strict editor"
        toolbar={false}
        policy={{ allowRasterDataImages: true }}
      />
      <TiptapViewer
        content={{ format: 'markdown', content: 'policy update' }}
        ariaLabel="strict viewer"
        preset={{ kind: 'tiptap', options: { policy: { allowRasterDataImages: true } } }}
      />
    </StrictMode>,
  )
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'strict viewer' }).textContent).toBe('policy update'),
  )
  expect(screen.getByRole('region', { name: 'strict viewer' })).toBe(original)
  expect(ref.current!.readJSON().ok).toBe(true)
})
it('keeps initial content, latest callback and selection through unrelated rerenders and editable changes', async () => {
  const ref = createRef<TiptapEditorHandle>(),
    old = vi.fn(),
    latest = vi.fn()
  const { rerender } = render(
    <TiptapEditor
      ref={ref}
      ariaLabel="test editor"
      initialContent={initial}
      toolbar={false}
      onChange={old}
    />,
  )
  await waitFor(() => expect(ref.current?.readJSON().ok).toBe(true))
  const textbox = screen.getByRole('textbox', { name: 'test editor' })
  const instance = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    instance.commands.setTextSelection({ from: 3, to: 5 })
  })
  const selected = instance.state.selection.toJSON()
  expect(old).not.toHaveBeenCalled()
  rerender(
    <TiptapEditor
      ref={ref}
      ariaLabel="test editor"
      initialContent={{ format: 'markdown', content: 'ignored' }}
      toolbar={false}
      editable={false}
      onChange={latest}
    />,
  )
  expect(textbox.textContent).toBe('original')
  expect(textbox.getAttribute('contenteditable')).toBe('false')
  expect(instance.state.selection.toJSON()).toEqual(selected)
  rerender(
    <TiptapEditor
      ref={ref}
      ariaLabel="test editor"
      initialContent={initial}
      toolbar={false}
      onChange={latest}
    />,
  )
  expect(textbox).toBe(screen.getByRole('textbox', { name: 'test editor' }))
  expect(instance.state.selection.toJSON()).toEqual(selected)
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: 'latest' })
  })
  expect(old).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledTimes(1)
})
it('renders fixed initial/viewer errors and notifies only after render; editor can recover', async () => {
  const errors = vi.fn(),
    ref = createRef<TiptapEditorHandle>()
  const invalid = { format: 'json', content: { type: 'unknown' } } as TiptapInput
  render(
    <>
      <TiptapEditor
        ref={ref}
        ariaLabel="recoverable"
        initialContent={invalid}
        toolbar={false}
        onError={errors}
      />
      <TiptapViewer ariaLabel="invalid viewer" content={invalid} onError={errors} />
    </>,
  )
  await waitFor(() => expect(errors).toHaveBeenCalledTimes(2))
  expect(screen.getAllByRole('alert')).toHaveLength(2)
  expect(screen.getByRole('textbox', { name: 'recoverable' }).textContent).toBe('')
  act(() => {
    expect(ref.current!.replaceContent(initial).ok).toBe(true)
  })
  expect(screen.getByRole('textbox', { name: 'recoverable' }).textContent).toBe('original')
})
it('updates viewer input, keeps task immutable and toggles Details locally without changing input', async () => {
  const content: TiptapInput = {
    format: 'json',
    content: {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'task' }] }],
            },
          ],
        },
        {
          type: 'details',
          attrs: { open: false },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'summary' }] },
            {
              type: 'detailsContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'inside' }] }],
            },
          ],
        },
        { type: 'paragraph' },
      ],
    },
  }
  const before = JSON.stringify(content)
  const { rerender } = render(<TiptapViewer content={content} ariaLabel="viewer" />)
  fireEvent.click(screen.getByRole('checkbox'))
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '展开详细内容' }))
  expect(screen.getByRole('button', { name: '收起详细内容' })).toBeTruthy()
  expect(JSON.stringify(content)).toBe(before)
  rerender(<TiptapViewer content={JSON.parse(before)} ariaLabel="viewer" />)
  expect(screen.getByRole('button', { name: '收起详细内容' })).toBeTruthy()
  rerender(
    <TiptapViewer content={{ format: 'markdown', content: 'changed viewer' }} ariaLabel="viewer" />,
  )
  await waitFor(() =>
    expect(screen.getByRole('region', { name: 'viewer' }).textContent).toBe('changed viewer'),
  )
})
it('does not call Mention source during composition, when readonly or without a callback', async () => {
  const ref = createRef<TiptapEditorHandle>(),
    resolve = vi.fn(async () => [{ id: '1', label: 'one' }])
  const { rerender } = render(
    <TiptapEditor ref={ref} ariaLabel="mention editor" toolbar={false} resolveMentions={resolve} />,
  )
  const textbox = screen.getByRole('textbox', { name: 'mention editor' })
  // Tiptap itself attaches its instance to the editable DOM; it is only inspected
  // here to drive genuine transactions, never exported by the shared React API.
  const instance = (textbox as HTMLElement & { editor: Editor }).editor
  fireEvent.compositionStart(textbox)
  act(() => {
    instance.commands.insertContent('@one')
  })
  fireEvent.keyDown(textbox, { key: 'Enter', isComposing: true, keyCode: 229 })
  expect(resolve).not.toHaveBeenCalled()
  fireEvent.compositionEnd(textbox)
  rerender(
    <TiptapEditor
      ref={ref}
      ariaLabel="mention editor"
      toolbar={false}
      editable={false}
      resolveMentions={resolve}
    />,
  )
  expect(resolve).not.toHaveBeenCalled()
  rerender(<TiptapEditor ref={ref} ariaLabel="mention editor" toolbar={false} />)
  expect(screen.queryByRole('listbox', { name: '提及候选' })).toBeNull()
})
it('uses official Mention candidates, keyboard navigation and exactly one identity node', async () => {
  render(
    <TiptapEditor
      ariaLabel="keyboard mention"
      toolbar={false}
      resolveMentions={async () => [
        { id: '1', label: 'one' },
        { id: '2', label: 'two' },
        { id: '2', label: 'duplicate' },
      ]}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'keyboard mention' }),
    instance = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    textbox.focus()
    instance.commands.insertContent('@')
  })
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
  expect(screen.queryByRole('button', { name: '关闭提及' })).toBeNull()
  fireEvent.keyDown(textbox, { key: 'ArrowDown' })
  fireEvent.keyDown(textbox, { key: 'Enter' })
  expect(textbox.querySelectorAll('[data-type="mention"]')).toHaveLength(1)
  expect(textbox.querySelector('[data-type="mention"]')?.getAttribute('data-id')).toBe('2')
  expect(textbox.textContent).toBe('@two ')
})
it('keeps ordinary @ text when candidates close and aborts an in-flight query when selection leaves', async () => {
  let signal: AbortSignal | undefined
  render(
    <TiptapEditor
      ariaLabel="cancel mention"
      toolbar={false}
      resolveMentions={async (_query, context) => {
        signal = context.signal
        return new Promise(() => undefined)
      }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'cancel mention' }),
    instance = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    textbox.focus()
    instance.commands.insertContent('@pending')
  })
  await waitFor(() => expect(signal).toBeTruthy())
  fireEvent.keyDown(textbox, { key: 'Escape' })
  expect(signal!.aborted).toBe(true)
  expect(textbox.textContent).toBe('@pending')
  expect(screen.queryByRole('listbox')).toBeNull()
})
it('toolbar applies marks to the saved selection and exposes validated ExUI link fields', async () => {
  render(<TiptapEditor ariaLabel="toolbar editor" initialContent={initial} />)
  const textbox = screen.getByRole('textbox', { name: 'toolbar editor' }),
    instance = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    instance.commands.setTextSelection({ from: 1, to: 9 })
  })
  fireEvent.mouseDown(screen.getByRole('button', { name: '粗体' }))
  fireEvent.click(screen.getByRole('button', { name: '粗体' }))
  expect(textbox.querySelector('strong')?.textContent).toBe('original')
  expect(screen.getByRole('button', { name: '粗体' }).getAttribute('aria-pressed')).toBe('true')
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  fireEvent.click(screen.getByRole('button', { name: '编辑链接' }))
  await waitFor(() => expect(screen.getByLabelText('链接地址')).toBeTruthy())
  fireEvent.change(screen.getByLabelText('链接地址'), { target: { value: 'javascript:evil()' } })
  fireEvent.click(screen.getByRole('button', { name: '应用链接' }))
  await screen.findByText('请输入安全的 http、https、mailto 或站内地址。')
  expect(textbox.querySelector('a')).toBeNull()
  fireEvent.change(screen.getByLabelText('链接地址'), { target: { value: 'https://example.test' } })
  fireEvent.click(screen.getByRole('button', { name: '应用链接' }))
  await waitFor(() =>
    expect(textbox.querySelector('a')?.getAttribute('href')).toBe('https://example.test'),
  )
})
it('cancels a pending Mention on blur and never reopens it over a keyboard link popover', async () => {
  let finish!: (items: { id: string; label: string }[]) => void, signal: AbortSignal | undefined
  render(
    <TiptapEditor
      ariaLabel="blur mention editor"
      resolveMentions={async (_query, context) => {
        signal = context.signal
        return new Promise((resolve) => {
          finish = resolve
        })
      }}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'blur mention editor' }),
    instance = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    textbox.focus()
    instance.commands.insertContent('@al')
  })
  await screen.findByRole('listbox', { name: '提及候选' })
  const linkTrigger = screen.getByRole('button', { name: '编辑链接' })
  act(() => {
    linkTrigger.focus()
  })
  expect(signal!.aborted).toBe(true)
  await waitFor(() => expect(screen.queryByRole('listbox', { name: '提及候选' })).toBeNull())
  fireEvent.click(linkTrigger)
  await screen.findByLabelText('链接地址')
  await act(async () => {
    finish([{ id: 'alex', label: 'Alex' }])
    await Promise.resolve()
  })
  expect(screen.queryByRole('listbox', { name: '提及候选' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByLabelText('链接地址'))
  expect(textbox.textContent).toBe('@al')
})
it('keeps a rejected link in its form when its mark crosses the complete document budget', async () => {
  const runtime = new TiptapLifecycle(() => ({}))
  const instance = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapExtensions({ purpose: 'editing' }), runtime.extension()],
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'word' }] },
        ...Array.from({ length: 9997 }, () => ({ type: 'paragraph' })),
      ],
    },
  })
  runtime.attach(instance)
  const rendered = render(
    <TiptapToolbar editor={instance} runtime={runtime} uploadEnabled={false} />,
  )
  // A partial mark splits the full-budget text run into three schema text nodes.
  act(() => {
    instance.commands.setTextSelection({ from: 2, to: 4 })
  })
  const before = instance.getJSON()
  fireEvent.click(screen.getByRole('button', { name: '编辑链接' }))
  fireEvent.change(await screen.findByRole('textbox', { name: '链接地址' }), {
    target: { value: 'https://example.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: '应用链接' }))
  await screen.findByText('链接未能应用，请检查选区或文档大小后重试。')
  expect((screen.getByRole('textbox', { name: '链接地址' }) as HTMLInputElement).value).toBe(
    'https://example.test',
  )
  expect(instance.getJSON()).toEqual(before)
  rendered.unmount()
  instance.destroy()
})
it('accepts an already-applied link as a successful no-op without reporting a budget error', async () => {
  render(
    <TiptapEditor
      ariaLabel="existing link editor"
      initialContent={{ format: 'markdown', content: '[Existing](/same)' }}
    />,
  )
  const instance = (
    screen.getByRole('textbox', { name: 'existing link editor' }) as HTMLElement & {
      editor: Editor
    }
  ).editor
  act(() => {
    instance.commands.setTextSelection(3)
  })
  const before = instance.getJSON()
  fireEvent.click(screen.getByRole('button', { name: '编辑链接' }))
  const address = await screen.findByRole('textbox', { name: '链接地址' })
  expect((address as HTMLInputElement).value).toBe('/same')
  fireEvent.click(screen.getByRole('button', { name: '应用链接' }))
  await waitFor(() => expect(screen.queryByRole('textbox', { name: '链接地址' })).toBeNull())
  expect(instance.getJSON()).toEqual(before)
  expect(screen.queryByText('链接未能应用，请检查选区或文档大小后重试。')).toBeNull()
})
it('clears a recovered upload failure only after the retry actually inserts its image', async () => {
  const upload = vi
    .fn()
    .mockRejectedValueOnce(new Error('private upload error'))
    .mockResolvedValueOnce({ src: '/retry.png' })
  render(
    <TiptapEditor ariaLabel="upload retry editor" initialContent={initial} uploadImage={upload} />,
  )
  const picker = screen.getByLabelText('选择本地图片'),
    file = new File(['x'], 'retry.png', { type: 'image/png' })
  fireEvent.click(screen.getByRole('button', { name: '上传本地图片' }))
  fireEvent.change(picker, { target: { files: [file] } })
  await screen.findByText('图片上传失败，请重新选择文件重试。')
  fireEvent.click(screen.getByRole('button', { name: '上传本地图片' }))
  fireEvent.change(picker, { target: { files: [file] } })
  await waitFor(() =>
    expect(
      screen
        .getByRole('textbox', { name: 'upload retry editor' })
        .querySelector('img[src="/retry.png"]'),
    ).toBeTruthy(),
  )
  expect(screen.queryByRole('alert')).toBeNull()
})
it('keeps unresolved initial diagnostics while successful edits and uploads update the recovery editor', async () => {
  render(
    <TiptapEditor
      ariaLabel="initial diagnostic editor"
      initialContent={{ format: 'json', content: { type: 'unknown' } }}
      uploadImage={async () => ({ src: '/valid.png' })}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'initial diagnostic editor' }),
    instance = (textbox as HTMLElement & { editor: Editor }).editor
  const before = screen.getByRole('alert').textContent
  act(() => {
    instance.commands.insertContent('recovering text')
  })
  fireEvent.click(screen.getByRole('button', { name: '上传本地图片' }))
  fireEvent.change(screen.getByLabelText('选择本地图片'), {
    target: { files: [new File(['x'], 'valid.png')] },
  })
  await waitFor(() => expect(textbox.querySelector('img[src="/valid.png"]')).toBeTruthy())
  expect(screen.getByRole('alert').textContent).toBe(before)
})
it('does not clear a newer failed-import diagnostic when an invalidated upload resolves late', async () => {
  let finish!: (value: { src: string }) => void
  const ref = createRef<TiptapEditorHandle>()
  render(
    <TiptapEditor
      ref={ref}
      ariaLabel="stale diagnostic editor"
      initialContent={initial}
      uploadImage={() =>
        new Promise((resolve) => {
          finish = resolve
        })
      }
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '上传本地图片' }))
  fireEvent.change(screen.getByLabelText('选择本地图片'), {
    target: { files: [new File(['x'], 'late.png')] },
  })
  act(() => {
    ref.current!.replaceContent({ format: 'markdown', content: 'new document' })
    ref.current!.replaceContent({ format: 'json', content: { type: 'unknown' } })
  })
  const diagnostic = screen.getByRole('alert').textContent
  await act(async () => {
    finish({ src: '/late.png' })
    await Promise.resolve()
  })
  expect(screen.getByRole('alert').textContent).toBe(diagnostic)
  expect(
    screen
      .getByRole('textbox', { name: 'stale diagnostic editor' })
      .querySelector('img[src="/late.png"]'),
  ).toBeNull()
})
