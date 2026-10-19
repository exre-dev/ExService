// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createTiptapExtensions } from '../extensions'
import { parseTiptapHTML } from './index'

const editors: Editor[] = []
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})
it.each(['editing', 'viewing'] as const)(
  'keeps saved image ratio, official node behavior and clipboard attrs for %s',
  (purpose) => {
    const editor = new Editor({
      element: document.createElement('div'),
      editable: purpose === 'editing',
      extensions: createTiptapExtensions({ purpose }),
      content: {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: '/x.png', width: 320, height: 160 } },
          { type: 'paragraph' },
        ],
      },
    })
    editors.push(editor)
    const wrapper = editor.view.dom.querySelector<HTMLElement>('[data-tiptap-image-layout]')!
    expect(wrapper.style.getPropertyValue('--tiptap-image-ratio')).toBe('320 / 160')
    expect(wrapper.style.getPropertyValue('--tiptap-image-width')).toBe('320px')
    expect(wrapper.style.getPropertyValue('--tiptap-image-height')).toBe('auto')
    expect(wrapper.querySelectorAll('[data-resize-handle]').length > 0).toBe(purpose === 'editing')
    const html = editor.getHTML()
    expect(html).not.toContain('style=')
    expect(html).not.toContain('tiptap-image-layout')
    expect(parseTiptapHTML(html)).toEqual(
      expect.objectContaining({ ok: true, value: editor.getJSON() }),
    )
    editor.commands.setNodeSelection(0)
    editor.commands.updateAttributes('image', { width: 400, height: 200 })
    expect(wrapper.style.getPropertyValue('--tiptap-image-width')).toBe('400px')
    expect(wrapper.style.getPropertyValue('--tiptap-image-ratio')).toBe('400 / 200')
    expect(parseTiptapHTML(editor.getHTML())).toEqual(
      expect.objectContaining({ ok: true, value: editor.getJSON() }),
    )
  },
)
it.each([{ width: 320 }, { height: 160 }, {}])(
  'uses intrinsic ratio only for missing dimensions: %j',
  (attrs) => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: createTiptapExtensions({ purpose: 'viewing' }),
      content: {
        type: 'doc',
        content: [{ type: 'image', attrs: { src: '/x.png', ...attrs } }, { type: 'paragraph' }],
      },
    })
    editors.push(editor)
    const wrapper = editor.view.dom.querySelector<HTMLElement>('[data-tiptap-image-layout]')!,
      image = wrapper.querySelector('img')!
    const snapshot = editor.getJSON()
    Object.defineProperties(image, { naturalWidth: { value: 320 }, naturalHeight: { value: 200 } })
    image.dispatchEvent(new Event('load'))
    expect(wrapper.style.getPropertyValue('--tiptap-image-ratio')).toBe('1.6')
    expect(wrapper.style.getPropertyValue('--tiptap-image-width')).toBe(
      'width' in attrs ? '320px' : 'height' in attrs ? '256px' : 'auto',
    )
    expect(wrapper.style.getPropertyValue('--tiptap-image-height')).toBe('auto')
    expect(editor.getJSON()).toEqual(snapshot)
  },
)
