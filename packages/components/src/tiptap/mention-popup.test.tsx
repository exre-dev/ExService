// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { TiptapEditor } from './TiptapEditor'

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
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  cleanup()
  vi.unstubAllGlobals()
})

it('uses an ExUI popover for Mention while keeping typing and keyboard selection in the editor', async () => {
  render(
    <TiptapEditor
      ariaLabel="popup mention"
      resolveMentions={async () => [
        { id: 'alex', label: 'Alex' },
        { id: 'sam', label: 'Sam' },
      ]}
    />,
  )
  const textbox = screen.getByRole('textbox', { name: 'popup mention' })
  const editor = (textbox as HTMLElement & { editor: Editor }).editor
  act(() => {
    textbox.focus()
    editor.commands.insertContent('@')
  })
  const popup = await screen.findByRole('listbox', { name: '提及候选' })
  expect(popup.getAttribute('data-slot')).toBe('popover-content')
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
  expect(document.activeElement).toBe(textbox)
  fireEvent.keyDown(textbox, { key: 'ArrowDown' })
  fireEvent.keyDown(textbox, { key: 'Enter' })
  expect(textbox.querySelector('[data-type="mention"]')?.getAttribute('data-id')).toBe('sam')
  await waitFor(() => expect(screen.queryByRole('listbox', { name: '提及候选' })).toBeNull())
})
