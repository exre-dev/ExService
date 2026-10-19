// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditorContent } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { redoDepth, undoDepth } from '@tiptap/pm/history'
import { useMarkdownPreset, useTiptapPreset } from './presets'
import { useTiptapEditor } from './useTiptapEditor'
import { TiptapEditor } from './TiptapEditor'
import { TiptapViewer } from './TiptapViewer'
import type {
  FullTiptapPreset,
  MarkdownPreset,
  MarkdownPresetOptions,
  TiptapIssue,
  TiptapResult,
  UseTiptapEditorResult,
} from './types'
import { currentEmojiAnchor } from './emoji-trigger'
import {
  insertBlock,
  insertBlockImageUrl,
  readInsertBlockAnchor,
  type InsertBlockType,
} from './insert-block'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(),
  })
})
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  cleanup()
  vi.unstubAllGlobals()
})
let result: UseTiptapEditorResult
function Host({
  kind = 'markdown',
  options,
  editable = true,
  source = 'old',
  onChange = () => {},
  onError = () => {},
  onNotice,
}: {
  kind?: 'markdown' | 'tiptap'
  options?: MarkdownPresetOptions
  editable?: boolean
  source?: string
  onChange?: (content: JSONContent) => void
  onError?: (issues: readonly TiptapIssue[]) => void
  onNotice?: (issues: readonly TiptapIssue[]) => void
}) {
  const markdown = useMarkdownPreset(options),
    full = useTiptapPreset(options)
  result = useTiptapEditor({
    ...(kind === 'markdown' ? { preset: markdown } : { preset: full }),
    ariaLabel: 'native',
    editable,
    initialContent: { format: 'markdown', content: source },
    onChange,
    onError,
    onNotice,
  })
  return (
    <>
      <EditorContent editor={result.editor} />
      {result.interactions}
      <div data-testid="issues">{result.issues.map((issue) => issue.code).join(',')}</div>
    </>
  )
}
function type(text: string) {
  const editor = result.editor!
  act(() => {
    editor.view.dom.focus()
    editor.view.someProp('handleTextInput', (fn) =>
      fn(
        editor.view,
        editor.state.selection.from,
        editor.state.selection.to,
        text,
        () => editor.state.tr,
      ),
    )
  })
}

it.each(['markdown', 'tiptap'] as const)(
  '%s freezes configuration, preset and initial content while retaining current callbacks and editable',
  (kind) => {
    const first = vi.fn(),
      latest = vi.fn()
    const host = render(
      <StrictMode>
        <Host
          kind={kind}
          options={{ placeholder: 'fixed', slash: false, emoji: false }}
          source=""
          onChange={first}
        />
      </StrictMode>,
    )
    const initial = result!,
      editor = initial.editor!
    expect(editor.view.dom.querySelector('p')?.getAttribute('data-placeholder')).toBe('fixed')
    act(() => {
      editor.commands.insertContent('x')
    })
    const position = editor.state.selection.from,
      depth = undoDepth(editor.state)
    host.rerender(
      <StrictMode>
        <Host
          kind={kind === 'markdown' ? 'tiptap' : 'markdown'}
          options={{ placeholder: 'changed', slash: true, emoji: true }}
          source="ignored"
          onChange={latest}
        />
      </StrictMode>,
    )
    expect(result.editor).toBe(editor)
    expect(result.readJSON).toBe(initial.readJSON)
    expect(result.replaceContent).toBe(initial.replaceContent)
    expect(result.exportMarkdown).toBe(initial.exportMarkdown)
    expect(editor.state.selection.from).toBe(position)
    expect(undoDepth(editor.state)).toBe(depth)
    expect(editor.schema.nodes.heading!.spec.attrs?.level).toBeDefined()
    expect(!!editor.schema.nodes.details).toBe(kind === 'tiptap')
    act(() => {
      editor.commands.insertContent('y')
    })
    expect(latest).toHaveBeenCalledTimes(1)
    expect(editor.state.doc.textContent).toBe('xy')
    host.rerender(<Host kind={kind} editable={false} />)
    expect(result.editor?.isEditable).toBe(false)
  },
)

it.each<InsertBlockType>([
  'text',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'bullet',
  'ordered',
  'task',
  'quote',
  'code',
  'divider',
  'table',
])('exports the GFM slash %s command through the live gate', (command) => {
  render(<Host source="" />)
  type('/')
  const editor = result.editor!
  act(() => {
    expect(insertBlock(editor, command)).toBe(true)
    editor.commands.insertContent('word')
  })
  const output = result.exportMarkdown()
  expect(output.ok).toBe(true)
  if (output.ok) {
    expect(output.value).toContain('word')
    expect(output.value).not.toMatch(/<\/?(?:p|table|h[1-6])\b/)
  }
})

it('keeps a rejected slash target and history, and refuses a stale image URL session', () => {
  render(<Host source="" />)
  type('/')
  const editor = result.editor!,
    target = readInsertBlockAnchor(editor)!,
    depth = undoDepth(editor.state)
  const gate = new Plugin({
    key: new PluginKey('denySlash'),
    filterTransaction: (tr) => !tr.docChanged,
  })
  act(() => {
    editor.registerPlugin(gate)
    expect(insertBlock(editor, 'h6', target.session)).toBe(false)
  })
  expect(editor.state.doc.textContent).toBe('/')
  expect(readInsertBlockAnchor(editor)).toBe(target)
  expect(undoDepth(editor.state)).toBe(depth)
  act(() => {
    editor.unregisterPlugin(gate.spec.key!)
    result.replaceContent({ format: 'markdown', content: '' })
  })
  type('/')
  act(() => {
    expect(
      insertBlockImageUrl(editor, { src: '/image.png', alt: '', title: null }, target.session),
    ).toBe(false)
  })
  expect(editor.state.doc.textContent).toBe('/')
})

it('validates image URLs in the slash form without consuming its target, then inserts inline attributes', async () => {
  render(<Host source="" />)
  type('/')
  fireEvent.click(screen.getByRole('button', { name: '图片' }))
  const address = await screen.findByRole('textbox', { name: '图片地址' })
  fireEvent.change(address, { target: { value: 'javascript:alert(1)' } })
  fireEvent.click(screen.getByRole('button', { name: '插入图片' }))
  await screen.findByText('请输入安全的图片地址。')
  expect(result.editor!.state.doc.textContent).toBe('/')
  fireEvent.change(address, { target: { value: '/image.png' } })
  fireEvent.change(screen.getByRole('textbox', { name: '替代文字' }), {
    target: { value: 'image' },
  })
  fireEvent.click(screen.getByRole('button', { name: '插入图片' }))
  await waitFor(() =>
    expect(result.editor!.getJSON().content?.[0]?.content?.[0]).toMatchObject({
      type: 'image',
      attrs: { src: '/image.png', alt: 'image', title: null },
    }),
  )
  expect(result.exportMarkdown()).toMatchObject({ ok: true, value: '![image](</image.png>)' })
  act(() => {
    result.editor!.commands.undo()
  })
  expect(result.editor!.state.doc.textContent).toBe('/')
})

it.each(['markdown', 'tiptap'] as const)(
  '%s resets undo and redo only after an accepted replacement',
  (kind) => {
    const changes = vi.fn()
    render(<Host kind={kind} onChange={changes} />)
    const editor = result.editor!
    act(() => {
      editor.commands.insertContent('x')
      editor.commands.undo()
    })
    expect(redoDepth(editor.state)).toBe(1)
    act(() => {
      expect(result.replaceContent({ format: 'markdown', content: 'old' }).ok).toBe(true)
    })
    expect(changes).toHaveBeenCalledTimes(3)
    expect(undoDepth(editor.state)).toBe(0)
    expect(redoDepth(editor.state)).toBe(0)
    act(() => {
      editor.commands.insertContent('new')
    })
    expect(undoDepth(editor.state)).toBe(1)
    const before = editor.getJSON(),
      position = editor.state.selection.from
    const gate = new Plugin({ filterTransaction: (tr) => !tr.docChanged })
    act(() => {
      editor.registerPlugin(gate)
    })
    act(() => {
      expect(result.replaceContent({ format: 'markdown', content: 'rejected' }).ok).toBe(false)
    })
    expect(editor.getJSON()).toEqual(before)
    expect(editor.state.selection.from).toBe(position)
    expect(undoDepth(editor.state)).toBe(1)
  },
)

it.each(['markdown', 'tiptap'] as const)(
  '%s returns success and reports observer exceptions outside content diagnostics',
  (kind) => {
    const failure = new Error('host observer failed'),
      reportError = vi.fn(),
      onError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    render(
      <Host
        kind={kind}
        onChange={() => {
          throw failure
        }}
        onError={onError}
      />,
    )
    act(() => {
      expect(result.replaceContent({ format: 'markdown', content: 'accepted' })).toMatchObject({
        ok: true,
      })
    })
    expect(result.editor!.state.doc.textContent).toBe('accepted')
    expect(result.issues).toEqual([])
    expect(onError).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
  },
)

it.each(['markdown', 'tiptap'] as const)(
  '%s keeps content failure results when the error observer throws',
  (kind) => {
    const failure = new Error('error observer failed'),
      reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    render(
      <Host
        kind={kind}
        onError={() => {
          throw failure
        }}
      />,
    )
    act(() => {
      expect(
        result.replaceContent({
          format: 'json',
          content: { type: 'doc', content: [{ type: 'unknown' }] },
        }),
      ).toMatchObject({ ok: false, issues: [{ code: 'unsupported-content' }] })
    })
    expect(result.editor!.state.doc.textContent).toBe('old')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
  },
)

it.each(['markdown', 'tiptap'] as const)(
  '%s fixes each result before observers and serializes reentrant notification batches',
  (kind) => {
    const events: string[] = []
    let nested: TiptapResult<JSONContent> | undefined
    const text = (json: JSONContent) => json.content?.[0]?.content?.[0]?.text
    render(
      <Host
        kind={kind}
        onChange={(json) => {
          const value = text(json)
          events.push(`start:${value}`)
          if (value === 'A') {
            nested = result.replaceContent({ format: 'markdown', content: 'B' })
            events.push('returned:B')
            json.content = []
          }
          events.push(`end:${value}`)
        }}
      />,
    )
    let outer: TiptapResult<JSONContent> | undefined
    act(() => {
      outer = result.replaceContent({ format: 'markdown', content: 'A' })
    })
    expect(events).toEqual(['start:A', 'returned:B', 'end:A', 'start:B', 'end:B'])
    expect(outer).toMatchObject({
      ok: true,
      value: { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
    })
    expect(nested).toMatchObject({
      ok: true,
      value: { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
    })
    expect(result.editor!.state.doc.textContent).toBe('B')
  },
)

it.each(['markdown', 'tiptap'] as const)(
  '%s notifies once with the final appended document and independent snapshots',
  (kind) => {
    const onChange = vi.fn((json: JSONContent) => {
      json.content = []
    })
    render(<Host kind={kind} onChange={onChange} />)
    const editor = result.editor!
    act(() => {
      editor.registerPlugin(
        new Plugin({
          appendTransaction(transactions, _old, state) {
            if (
              !transactions.some((transaction) => transaction.docChanged) ||
              state.doc.textContent !== 'candidate'
            )
              return null
            return state.tr.insertText('!', state.doc.content.size - 1)
          },
        }),
      )
    })
    act(() => {
      const replaced = result.replaceContent({ format: 'markdown', content: 'candidate' })
      expect(replaced).toMatchObject({
        ok: true,
        value: { content: [{ content: [{ text: 'candidate!' }] }] },
      })
      if (replaced.ok) replaced.value.content = []
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(editor.state.doc.textContent).toBe('candidate!')
    expect(undoDepth(editor.state)).toBe(0)
    expect(redoDepth(editor.state)).toBe(0)
  },
)

it.each(['markdown', 'tiptap'] as const)(
  '%s keeps returned mark attributes independent of the live document',
  (kind) => {
    render(<Host kind={kind} />)
    act(() => {
      const replaced = result.replaceContent({
        format: 'markdown',
        content: '[label](https://example.com)',
      })
      expect(replaced.ok).toBe(true)
      if (replaced.ok)
        replaced.value.content![0]!.content![0]!.marks![0]!.attrs!.href = 'javascript:changed'
      expect(result.editor!.getJSON().content![0]!.content![0]!.marks![0]!.attrs!.href).toBe(
        'https://example.com',
      )
      expect(result.readJSON().ok).toBe(true)
    })
  },
)

it.each(['markdown', 'tiptap'] as const)(
  '%s isolates mark attributes passed to ordinary change observers',
  (kind) => {
    render(
      <Host
        kind={kind}
        source="[label](https://example.com)"
        onChange={(json) => {
          json.content![0]!.content![0]!.marks![0]!.attrs!.href = 'javascript:changed'
        }}
      />,
    )
    act(() => {
      result.editor!.commands.setTextSelection(2)
      result.editor!.commands.insertContent('!')
    })
    expect(result.editor!.getJSON().content![0]!.content![0]!.marks![0]!.attrs!.href).toBe(
      'https://example.com',
    )
    expect(result.readJSON().ok).toBe(true)
  },
)

for (const kind of ['markdown', 'tiptap'] as const) {
  it.each(['read', 'export', 'failure'] as const)(
    `${kind} commits initial recovery before a native update listener performs %s`,
    (action) => {
      const errors = vi.fn()
      render(<Host kind={kind} source="[bad](javascript:evil)" onError={errors} />)
      expect(errors).toHaveBeenCalledTimes(1)
      let nested: TiptapResult<unknown> | undefined
      result.editor!.on('update', () => {
        if (action === 'read') nested = result.readJSON()
        if (action === 'export') nested = result.exportMarkdown()
        if (action === 'failure')
          nested = result.replaceContent({
            format: 'json',
            content: { type: 'doc', content: [{ type: 'unknown' }] },
          })
      })
      act(() => {
        expect(result.replaceContent({ format: 'markdown', content: 'recovered' }).ok).toBe(true)
      })
      expect(nested?.ok).toBe(action !== 'failure')
      expect(result.issues).toEqual(
        action === 'failure' ? [expect.objectContaining({ code: 'unsupported-content' })] : [],
      )
      expect(errors).toHaveBeenCalledTimes(action === 'failure' ? 2 : 1)
    },
  )
  it.each(['accepted', 'rejected'] as const)(
    `${kind} preserves independent receipts through native update reentry with a %s operation`,
    (outcome) => {
      const events: string[] = [],
        errors = vi.fn(() => {
          events.push('error:B')
        })
      let nested: TiptapResult<JSONContent> | undefined
      render(
        <Host
          kind={kind}
          onError={errors}
          onChange={(json) => {
            events.push(`change:${json.content?.[0]?.content?.[0]?.text}`)
          }}
        />,
      )
      const editor = result.editor!
      editor.on('update', () => {
        if (editor.state.doc.textContent !== 'A') return
        nested = result.replaceContent({
          format: 'markdown',
          content: outcome === 'accepted' ? 'B' : '[bad](javascript:evil)',
        })
      })
      act(() => {
        expect(result.replaceContent({ format: 'markdown', content: 'A' })).toMatchObject({
          ok: true,
          value: { content: [{ content: [{ text: 'A' }] }] },
        })
      })
      expect(nested?.ok).toBe(outcome === 'accepted')
      expect(events).toEqual(
        outcome === 'accepted' ? ['change:A', 'change:B'] : ['change:A', 'error:B'],
      )
      expect(editor.state.doc.textContent).toBe(outcome === 'accepted' ? 'B' : 'A')
      expect(result.issues).toEqual(
        outcome === 'accepted' ? [] : [expect.objectContaining({ code: 'unsafe-content' })],
      )
    },
  )
}

it('continues the replacement notice batch after a change observer throws', () => {
  const reportError = vi.fn(),
    onNotice = vi.fn(),
    onError = vi.fn()
  vi.stubGlobal('reportError', reportError)
  render(
    <Host
      kind="tiptap"
      onChange={() => {
        throw new Error('change observer')
      }}
      onNotice={onNotice}
      onError={onError}
    />,
  )
  act(() => {
    expect(result.replaceContent({ format: 'markdown', content: '# heading' }).ok).toBe(true)
  })
  expect(onNotice).toHaveBeenCalledExactlyOnceWith(
    expect.arrayContaining([expect.objectContaining({ path: 'doc.content' })]),
  )
  expect(onError).not.toHaveBeenCalled()
  expect(reportError).toHaveBeenCalledTimes(1)
})

it('keeps accepted notices isolated from a throwing notice observer', () => {
  const reportError = vi.fn(),
    onError = vi.fn()
  vi.stubGlobal('reportError', reportError)
  render(
    <Host
      kind="tiptap"
      onNotice={(notices) => {
        ;(notices as TiptapIssue[]).length = 0
        throw new Error('notice observer')
      }}
      onError={onError}
    />,
  )
  act(() => {
    expect(result.replaceContent({ format: 'markdown', content: '# heading' })).toMatchObject({
      ok: true,
      notices: [expect.objectContaining({ path: 'doc.content' })],
    })
  })
  expect(reportError).toHaveBeenCalledTimes(1)
  expect(onError).not.toHaveBeenCalled()
})

it('delivers each complete notice batch before a reentrant replacement notification', () => {
  const events: string[] = []
  render(
    <Host
      kind="tiptap"
      onChange={(json) => {
        const text = json.content?.[0]?.content?.[0]?.text
        events.push(`change:${text}`)
        if (text === 'A') result.replaceContent({ format: 'markdown', content: '# B' })
      }}
      onNotice={() => {
        events.push('notice')
      }}
    />,
  )
  act(() => {
    result.replaceContent({ format: 'markdown', content: '# A' })
  })
  expect(events).toEqual(['change:A', 'notice', 'change:B', 'notice'])
})

for (const kind of ['markdown', 'tiptap'] as const) {
  it.each(['replace', 'unmount'] as const)(
    `${kind} invalidates error notifications queued inside an observer after %s`,
    (action) => {
      const errors = vi.fn()
      const host = render(
        <Host
          kind={kind}
          onError={errors}
          onChange={(json) => {
            if (json.content?.[0]?.content?.[0]?.text !== 'A') return
            result.replaceContent({ format: 'markdown', content: '[bad](javascript:evil)' })
            if (action === 'replace') result.replaceContent({ format: 'markdown', content: 'B' })
            else host.unmount()
          }}
        />,
      )
      act(() => {
        expect(result.replaceContent({ format: 'markdown', content: 'A' }).ok).toBe(true)
      })
      expect(errors).not.toHaveBeenCalled()
      if (action === 'replace') {
        expect(result.issues).toEqual([])
        expect(result.editor!.state.doc.textContent).toBe('B')
      }
    },
  )
  it.each(['read', 'export', 'failure', 'selection'] as const)(
    `${kind} scopes queued diagnostics across %s`,
    async (action) => {
      const errors = vi.fn()
      render(<Host kind={kind} onError={errors} />)
      const editor = result.editor!
      act(() => {
        editor.view.dispatch(
          editor.state.tr.insert(0, editor.schema.nodes.heading!.create({ level: 7 })),
        )
        if (action === 'read') expect(result.readJSON().ok).toBe(true)
        if (action === 'export') expect(result.exportMarkdown().ok).toBe(true)
        if (action === 'failure')
          expect(
            result.replaceContent({ format: 'markdown', content: '[bad](javascript:evil)' }).ok,
          ).toBe(false)
        if (action === 'selection') editor.commands.setTextSelection(2)
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(errors).toHaveBeenCalledTimes(action === 'read' || action === 'export' ? 0 : 1)
      if (action === 'failure') expect(result.issues).toMatchObject([{ code: 'unsafe-content' }])
      if (action === 'selection') expect(result.issues).toHaveLength(1)
    },
  )
}

it.each(['markdown', 'tiptap'] as const)(
  '%s latches an invalid initial import until explicit recovery',
  (kind) => {
    const errors = vi.fn()
    // An unsafe link is invalid in both schemas.
    render(
      <StrictMode>
        <Host kind={kind} source="[bad](javascript:alert)" onError={errors} />
      </StrictMode>,
    )
    expect(errors).toHaveBeenCalledTimes(1)
    act(() => {
      result.editor!.commands.insertContent('typed')
    })
    expect(result.exportMarkdown().ok).toBe(false)
    act(() => {
      expect(result.replaceContent({ format: 'markdown', content: 'restored' }).ok).toBe(true)
    })
    expect(result.exportMarkdown()).toMatchObject({ ok: true, value: 'restored' })
  },
)

it('installs only the enabled interactions and keeps placeholder out of viewing and readonly instances', () => {
  const host = render(
    <Host source="" options={{ slash: false, emoji: false, placeholder: false }} />,
  )
  const editor = result.editor!
  expect(
    editor.extensionManager.extensions.some((extension) => extension.name === 'tiptapInsertBlock'),
  ).toBe(false)
  expect(
    editor.extensionManager.extensions.some((extension) => extension.name === 'tiptapEmojiPicker'),
  ).toBe(false)
  expect(editor.view.dom.querySelector('[data-placeholder]')).toBeNull()
  host.unmount()
  function Shared() {
    const preset = useMarkdownPreset({ placeholder: 'shared' })
    return (
      <>
        <TiptapEditor preset={preset} ariaLabel="shared" />
        <TiptapViewer
          preset={preset}
          ariaLabel="view"
          content={{ format: 'markdown', content: '###### six' }}
        />
      </>
    )
  }
  render(<Shared />)
  expect(screen.queryByRole('toolbar')).toBeNull()
  expect(
    screen
      .getByRole('textbox', { name: 'shared' })
      .querySelector('p')
      ?.getAttribute('data-placeholder'),
  ).toBe('shared')
  expect(screen.getByRole('region', { name: 'view' }).querySelector('h6')?.textContent).toBe('six')
  expect(
    screen.getByRole('region', { name: 'view' }).querySelector('[data-placeholder]'),
  ).toBeNull()
})

it('provides GFM slash commands and cancels old interaction sessions on replacement', () => {
  render(<Host source="" />)
  type('/')
  const editor = result.editor!,
    slash = readInsertBlockAnchor(editor)
  expect(slash).not.toBeNull()
  expect(screen.queryByRole('button', { name: '折叠块' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '标题 6' }))
  expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 6 } })
  act(() => {
    result.replaceContent({ format: 'markdown', content: '' })
  })
  type('$')
  expect(currentEmojiAnchor(editor)).not.toBeNull()
  act(() => {
    result.replaceContent({ format: 'markdown', content: 'new' })
  })
  expect(currentEmojiAnchor(editor)).toBeNull()
  expect(readInsertBlockAnchor(editor)).toBeNull()
})

it('closes native full table controls and their menu when readonly, then restores controls', async () => {
  const host = render(<Host kind="tiptap" source={'| A | B |\n| --- | --- |\n| C | D |'} />)
  fireEvent.click(await screen.findByRole('button', { name: '第 1 行操作' }))
  expect(screen.getByRole('menuitem', { name: '删除当前行' })).toBeDefined()
  host.rerender(<Host kind="tiptap" editable={false} />)
  expect(result.editor!.isEditable).toBe(false)
  await waitFor(() => expect(screen.queryByRole('button', { name: '第 1 行操作' })).toBeNull())
  expect(screen.queryByRole('menuitem', { name: '删除当前行' })).toBeNull()
  host.rerender(<Host kind="tiptap" />)
  expect(await screen.findByRole('button', { name: '第 1 行操作' })).toBeDefined()
})

it('copies nested policy, preserves preset references and isolates editors sharing one descriptor', () => {
  let descriptor: FullTiptapPreset, first: UseTiptapEditorResult, second: UseTiptapEditorResult
  const mutable = { policy: { allowRasterDataImages: false } }
  function Pair() {
    descriptor = useTiptapPreset(mutable)
    first = useTiptapEditor({ preset: descriptor, ariaLabel: 'first' })
    second = useTiptapEditor({ preset: descriptor, ariaLabel: 'second' })
    return (
      <>
        <EditorContent editor={first.editor} />
        {first.interactions}
        <EditorContent editor={second.editor} />
        {second.interactions}
        <TiptapViewer
          preset={descriptor}
          ariaLabel="fixed policy viewer"
          content={{ format: 'markdown', content: 'fixed' }}
        />
      </>
    )
  }
  const host = render(<Pair />),
    original = descriptor!
  act(() => {
    first!.editor!.commands.insertContent('only first')
  })
  expect(second!.editor!.state.doc.textContent).toBe('')
  expect(undoDepth(first!.editor!.state)).toBe(1)
  expect(undoDepth(second!.editor!.state)).toBe(0)
  expect(first!.editor!.extensionManager.extensions[0]).not.toBe(
    second!.editor!.extensionManager.extensions[0],
  )
  mutable.policy.allowRasterDataImages = true
  host.rerender(<Pair />)
  expect(descriptor!).toBe(original)
  expect(descriptor!.options.policy?.allowRasterDataImages).toBe(false)
  expect(first!.editor!.state.doc.textContent).toBe('only first')
})

it('freezes the placeholder callback and omits its decorations in readonly and nested nodes', () => {
  const first = vi.fn(() => 'first placeholder'),
    later = vi.fn(() => 'later placeholder')
  const host = render(<Host source="" options={{ placeholder: first }} />)
  const editor = result.editor!
  expect(editor.view.dom.querySelector('p')?.getAttribute('data-placeholder')).toBe(
    'first placeholder',
  )
  host.rerender(<Host options={{ placeholder: later }} />)
  act(() => {
    editor.commands.setTextSelection(1)
  })
  expect(editor.view.dom.querySelector('p')?.getAttribute('data-placeholder')).toBe(
    'first placeholder',
  )
  expect(later).not.toHaveBeenCalled()
  act(() => {
    result.replaceContent({
      format: 'json',
      content: { type: 'doc', content: [{ type: 'blockquote', content: [{ type: 'paragraph' }] }] },
    })
    editor.commands.setTextSelection(2)
  })
  expect(editor.view.dom.querySelector('blockquote [data-placeholder]')).toBeNull()
  host.rerender(<Host editable={false} />)
  expect(editor.view.dom.querySelector('[data-placeholder]')).toBeNull()
})

it('keeps Viewer schema and policy fixed while accepting new content', () => {
  let preset: MarkdownPreset
  function Viewer({ full = false, source = '###### six' }: { full?: boolean; source?: string }) {
    preset = useMarkdownPreset()
    const rich = useTiptapPreset()
    return (
      <TiptapViewer
        preset={full ? rich : preset}
        ariaLabel="fixed viewer"
        content={{ format: 'markdown', content: source }}
      />
    )
  }
  const host = render(<Viewer />),
    region = screen.getByRole('region', { name: 'fixed viewer' })
  expect(region.querySelector('h6')?.textContent).toBe('six')
  host.rerender(<Viewer full source="###### updated" />)
  expect(screen.getByRole('region', { name: 'fixed viewer' })).toBe(region)
  expect(region.querySelector('h6')?.textContent).toBe('updated')
  host.rerender(<Viewer full source="<u>full only</u>" />)
  expect(screen.getByRole('alert').textContent).toContain('内容无法显示')
})
