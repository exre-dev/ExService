import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { parseTiptapContent } from './conversion'
import { parseMarkdownContent } from './markdown/conversion'
import { createMarkdownExtensions } from './markdown/extensions'
import { snapshotPreset } from './presets'
import { createTiptapExtensions } from './extensions'
import type { TiptapViewerProps } from './types'
import styles from './TiptapContent.module.scss'

export function TiptapViewer({
  content,
  ariaLabel,
  className,
  preset,
  onError,
}: TiptapViewerProps) {
  const callback = useRef(onError)
  callback.current = onError
  const [fixed] = useState(() => snapshotPreset(preset ?? { kind: 'tiptap', options: {} }))
  const parsed = useMemo(
    () =>
      fixed.kind === 'markdown'
        ? parseMarkdownContent(content)
        : parseTiptapContent(content, fixed.options.policy),
    [content, fixed],
  )
  const extensions = useMemo(
    () =>
      fixed.kind === 'markdown'
        ? createMarkdownExtensions({ purpose: 'viewing' })
        : createTiptapExtensions({ purpose: 'viewing', policy: fixed.options.policy }),
    [fixed],
  )
  const editor = useEditor(
    {
      extensions,
      editable: false,
      content: parsed.ok ? parsed.value : { type: 'doc', content: [{ type: 'paragraph' }] },
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: { attributes: { role: 'region', 'aria-label': ariaLabel } },
    },
    [],
  )
  useEffect(() => {
    if (!parsed.ok) {
      callback.current?.(parsed.issues)
      return
    }
    if (
      editor &&
      !editor.isDestroyed &&
      !editor.state.doc.eq(editor.schema.nodeFromJSON(parsed.value))
    )
      editor.commands.setContent(parsed.value, { emitUpdate: false })
  }, [editor, parsed])
  useEffect(() => {
    if (editor && !editor.isDestroyed)
      editor.setOptions({
        editorProps: { attributes: { role: 'region', 'aria-label': ariaLabel } },
      })
  }, [editor, ariaLabel])
  return (
    <div className={[styles.content, className].filter(Boolean).join(' ')}>
      {parsed.ok ? (
        <EditorContent editor={editor} />
      ) : (
        <div role="alert">内容无法显示，请检查文档格式。</div>
      )}
    </div>
  )
}
