// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from './extensions'
import { TiptapLifecycle } from './lifecycle'
import { TIPTAP_LIMITS } from './conversion/policy'
import { Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const editors: Editor[] = []
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup(
  options: ConstructorParameters<typeof TiptapLifecycle>[0] = () => ({}),
  publish?: ConstructorParameters<typeof TiptapLifecycle>[1],
) {
  const runtime = new TiptapLifecycle(options, publish)
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...createTiptapExtensions({ purpose: 'editing' }), runtime.extension()],
    content: '<p>alpha</p><p>beta</p>',
  })
  editors.push(editor)
  runtime.attach(editor)
  return { editor, runtime }
}
it('rejects replacement without touching document, history, selection or a pending upload', async () => {
  const task = deferred<{ src: string }>()
  const { editor, runtime } = setup(() => ({ uploadImage: () => task.promise }))
  editor.commands.setTextSelection(3)
  const pending = runtime.upload(new File(['x'], 'x.png', { type: 'image/png' }))
  const before = editor.getJSON(),
    selection = editor.state.selection.toJSON()
  expect(
    runtime.replace({ format: 'json', content: { type: 'doc', content: [{ type: 'unknown' }] } })
      .ok,
  ).toBe(false)
  expect(editor.getJSON()).toEqual(before)
  expect(editor.state.selection.toJSON()).toEqual(selection)
  task.resolve({ src: '/image.png' })
  await pending
  expect(editor.getJSON().content?.some((node) => node.type === 'image')).toBe(true)
})

it('preserves a pending upload when another plugin refuses a valid replacement', async () => {
  const task = deferred<{ src: string }>()
  let signal!: AbortSignal
  const { editor, runtime } = setup(() => ({
    uploadImage: (_file, context) => {
      signal = context.signal
      return task.promise
    },
  }))
  const pending = runtime.upload(new File(['x'], 'x.png'))
  const gate = new Plugin({
    key: new PluginKey('denyReplacement'),
    filterTransaction: (transaction) => !transaction.docChanged,
  })
  editor.registerPlugin(gate)
  expect(runtime.replace({ format: 'markdown', content: 'refused' }).ok).toBe(false)
  expect(signal.aborted).toBe(false)
  editor.unregisterPlugin(gate.spec.key!)
  task.resolve({ src: '/image.png' })
  await pending
  expect(editor.getJSON().content?.some((node) => node.type === 'image')).toBe(true)
})

it('aborts pending service work when the Editor itself is destroyed', async () => {
  const task = deferred<{ src: string }>()
  let signal!: AbortSignal
  const { editor, runtime } = setup(() => ({
    uploadImage: (_file, context) => {
      signal = context.signal
      return task.promise
    },
  }))
  const pending = runtime.upload(new File(['x'], 'x.png'))
  editor.destroy()
  expect(signal.aborted).toBe(true)
  task.resolve({ src: '/image.png' })
  await pending
  expect(runtime.read()).toMatchObject({ ok: false, issues: [{ code: 'not-ready' }] })
})
it('maps an upload anchor through typing and ignores the current selection', async () => {
  const task = deferred<{ src: string }>()
  const { editor, runtime } = setup(() => ({ uploadImage: () => task.promise }))
  editor.commands.setTextSelection(3)
  const pending = runtime.upload(new File(['x'], 'x.png'))
  editor.commands.insertContentAt(1, 'prefix')
  editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  task.resolve({ src: '/image.png' })
  await pending
  const types = editor.getJSON().content!.map((node) => node.type)
  expect(types).toEqual(['paragraph', 'image', 'paragraph', 'paragraph'])
  expect(editor.state.doc.lastChild?.textContent).toBe('beta')
  expect(editor.getText()).toContain('prefixal')
})
it.each(['delete', 'replace', 'destroy'] as const)(
  'drops uncooperative late upload after %s',
  async (action) => {
    const task = deferred<{ src: string }>()
    let signal!: AbortSignal
    const { editor, runtime } = setup(() => ({
      uploadImage: (_file, context) => {
        signal = context.signal
        return task.promise
      },
    }))
    editor.commands.setTextSelection(3)
    const pending = runtime.upload(new File(['x'], 'x.png'))
    if (action === 'delete') editor.commands.deleteRange({ from: 0, to: 7 })
    if (action === 'replace') runtime.replace({ format: 'markdown', content: 'replacement' })
    if (action === 'destroy') {
      runtime.dispose()
      editor.destroy()
    }
    task.resolve({ src: '/image.png' })
    await pending
    expect(signal.aborted).toBe(true)
    expect(editor.getJSON().content?.some((node) => node.type === 'image')).toBe(false)
  },
)
it('clears old history on successful replacement and calls change once', () => {
  const onChange = vi.fn()
  const { editor, runtime } = setup(() => ({ onChange }))
  editor.commands.insertContentAt(1, 'typed')
  const before = editor.getJSON()
  onChange.mockClear()
  expect(runtime.replace({ format: 'markdown', content: 'replacement' }).ok).toBe(true)
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(editor.state.selection.from).toBe(1)
  expect(editor.commands.undo()).toBe(false)
  expect(editor.getText()).toBe('replacement')
  editor.commands.insertContent('new')
  expect(editor.commands.undo()).toBe(true)
  expect(editor.getText()).toBe('replacement')
  expect(editor.getText()).not.toContain('typed')
})
it.each(['replacement', 'edit', 'export', 'dispose'] as const)(
  'discards a queued rejection after %s',
  async (action) => {
    const onError = vi.fn(),
      publish = vi.fn()
    const { editor, runtime } = setup(() => ({ onError }), publish)
    const before = editor.getJSON()
    editor.view.dispatch(
      editor.state.tr.insert(0, editor.schema.nodes.heading!.create({ level: 5 })),
    )
    expect(editor.getJSON()).toEqual(before)
    if (action === 'replacement')
      expect(runtime.replace({ format: 'markdown', content: 'new document' }).ok).toBe(true)
    if (action === 'edit') editor.commands.insertContentAt(1, 'valid ')
    if (action === 'export') expect(runtime.export().ok).toBe(true)
    if (action === 'dispose') runtime.dispose()
    await Promise.resolve()
    expect(onError).not.toHaveBeenCalled()
    if (action !== 'dispose') expect(publish).toHaveBeenLastCalledWith([])
  },
)
it('does not overwrite a newer explicit failure with an older queued rejection', async () => {
  const onError = vi.fn(),
    publish = vi.fn()
  const { editor, runtime } = setup(() => ({ onError }), publish)
  editor.view.dispatch(editor.state.tr.insert(0, editor.schema.nodes.heading!.create({ level: 5 })))
  const result = runtime.replace({
    format: 'json',
    content: { type: 'doc', content: [{ type: 'image', attrs: { src: 'javascript:evil' } }] },
  })
  expect(result).toMatchObject({ ok: false, issues: [{ code: 'unsafe-content' }] })
  await Promise.resolve()
  expect(onError).toHaveBeenCalledTimes(1)
  expect(publish).toHaveBeenLastCalledWith(
    expect.arrayContaining([expect.objectContaining({ code: 'unsafe-content' })]),
  )
})
it('reports only the latest queued rejection while preserving it through selection changes', async () => {
  const onError = vi.fn()
  const { editor } = setup(() => ({ onError }))
  editor.view.dispatch(editor.state.tr.insert(0, editor.schema.nodes.heading!.create({ level: 5 })))
  editor.view.dispatch(
    editor.state.tr.insert(0, editor.schema.nodes.image!.create({ src: 'javascript:evil' })),
  )
  editor.commands.setTextSelection(3)
  await Promise.resolve()
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ code: 'unsafe-content' })]),
  )
})
it('uses the latest callback, returns independent snapshots and keeps history on invalid HTML', () => {
  const first = vi.fn(),
    second = vi.fn()
  let callback = first
  const { editor, runtime } = setup(() => ({ onChange: callback }))
  callback = second
  editor.commands.insertContentAt(1, 'X')
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  const snapshot = runtime.read()
  if (!snapshot.ok) throw Error('not ready')
  snapshot.value.content = []
  expect(editor.getText()).toContain('Xalpha')
  const before = editor.getJSON()
  expect(runtime.insertHTML('<p onclick="evil()">invalid</p>')).toBe(false)
  expect(editor.getJSON()).toEqual(before)
  editor.commands.undo()
  expect(editor.getText()).not.toContain('Xalpha')
})
it.each([
  '<a href="/destination"><img src="/image.png"></a>',
  '<details><summary><p>Title</p></summary><div data-type="detailsContent"><p>Body</p></div></details>',
])(
  'keeps document, selection and undo history when lossy HTML is pasted or imported: %s',
  (html) => {
    const { editor, runtime } = setup()
    const original = editor.getJSON()
    editor.commands.insertContentAt(1, 'typed ')
    editor.commands.setTextSelection({ from: 2, to: 5 })
    const before = editor.getJSON(),
      selection = editor.state.selection.toJSON()
    expect(runtime.insertHTML(html)).toBe(false)
    expect(runtime.replace({ format: 'markdown', content: html }).ok).toBe(false)
    expect(editor.getJSON()).toEqual(before)
    expect(editor.state.selection.toJSON()).toEqual(selection)
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getJSON()).toEqual(original)
  },
)
it('aborts previous mention, deduplicates candidates and ignores stale or composition queries', async () => {
  const first = deferred<readonly { id: string; label: string }[]>(),
    second = deferred<readonly { id: string; label: string }[]>()
  const calls: AbortSignal[] = []
  const { runtime } = setup(() => ({
    resolveMentions: (query, { signal }) => {
      calls.push(signal)
      return query === 'a' ? first.promise : second.promise
    },
  }))
  const stale = runtime.query('a'),
    latest = runtime.query('ab')
  expect(calls[0]!.aborted).toBe(true)
  second.resolve([
    { id: '2', label: 'B' },
    { id: '2', label: 'duplicate' },
  ])
  expect(await latest).toEqual([{ id: '2', label: 'B' }])
  first.resolve([{ id: '1', label: 'A' }])
  expect(await stale).toEqual([])
  runtime.composing = true
  expect(await runtime.query('中文')).toEqual([])
  expect(calls).toHaveLength(2)
})
it('rejects the third valid uploaded image when the complete document crosses the node budget', async () => {
  const errors = vi.fn()
  const { editor, runtime } = setup(() => ({
    uploadImage: async () => ({ src: '/image.png' }),
    onError: errors,
  }))
  editor.commands.setContent({
    type: 'doc',
    content: Array.from({ length: TIPTAP_LIMITS.nodes - 3 }, () => ({ type: 'paragraph' })),
  })
  await runtime.upload(new File(['x'], '1.png'), 0)
  await runtime.upload(new File(['x'], '2.png'), 0)
  const before = editor.getJSON()
  await runtime.upload(new File(['x'], '3.png'), 0)
  await Promise.resolve()
  expect(editor.getJSON()).toEqual(before)
  expect(editor.getJSON().content!.filter((node) => node.type === 'image')).toHaveLength(2)
  expect(errors).toHaveBeenCalledWith(
    expect.arrayContaining([expect.objectContaining({ code: 'limit-exceeded' })]),
  )
})
it('rejects valid HTML and plain-text insertion that cross the complete candidate budget atomically', async () => {
  const errors = vi.fn()
  const { editor, runtime } = setup(() => ({ onError: errors }))
  editor.commands.setContent({
    type: 'doc',
    content: Array.from({ length: TIPTAP_LIMITS.nodes - 1 }, () => ({ type: 'paragraph' })),
  })
  const before = editor.getJSON()
  expect(runtime.insertHTML('<p>valid in isolation</p>', 0)).toBe(false)
  await Promise.resolve()
  expect(editor.getJSON()).toEqual(before)
  expect(errors).toHaveBeenCalledTimes(1)
  editor.commands.insertContentAt(1, 'also valid in isolation')
  await Promise.resolve()
  expect(editor.getJSON()).toEqual(before)
  expect(errors).toHaveBeenCalledTimes(2)
})
it('reports fixed upload failure and keeps text for retry; unsafe result never enters history', async () => {
  const errors = vi.fn()
  let fail = true
  const { editor, runtime } = setup(() => ({
    onError: errors,
    uploadImage: async () => {
      if (fail) throw Error('secret')
      return { src: 'javascript:secret' }
    },
  }))
  const before = editor.getJSON()
  await runtime.upload(new File(['x'], 'x.png'))
  fail = false
  await runtime.upload(new File(['x'], 'x.png'))
  expect(editor.getJSON()).toEqual(before)
  expect(
    errors.mock.calls
      .flat(3)
      .some((value) => typeof value === 'object' && value.message?.includes('secret')),
  ).toBe(false)
  expect(errors).toHaveBeenCalledTimes(2)
})
it('cancels a mention query on replacement and disposal even when the callback ignores abort', async () => {
  const pending = deferred<readonly { id: string; label: string }[]>()
  const { runtime } = setup(() => ({ resolveMentions: () => pending.promise }))
  const query = runtime.query('a')
  runtime.replace({ format: 'markdown', content: 'new' })
  runtime.dispose()
  pending.resolve([{ id: '1', label: 'stale' }])
  expect(await query).toEqual([])
})
it('leaves file drops to the host when no upload callback is configured', () => {
  const onError = vi.fn(),
    { editor } = setup(() => ({ onError }))
  const event = new Event('drop') as DragEvent
  Object.defineProperty(event, 'dataTransfer', {
    value: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
  })
  const plugin = editor.state.plugins.find((candidate) => candidate.props.handleDrop)!
  const before = editor.getJSON()
  expect(plugin.props.handleDrop!.call(plugin, editor.view, event, Slice.empty, false)).toBe(false)
  expect(onError).not.toHaveBeenCalled()
  expect(editor.getJSON()).toEqual(before)
})
