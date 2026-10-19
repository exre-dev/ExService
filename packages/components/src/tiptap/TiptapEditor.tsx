import { forwardRef, useImperativeHandle } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorSession } from './useTiptapEditor'
import type { TiptapEditorHandle, TiptapEditorProps } from './types'
import contentStyles from './TiptapContent.module.scss'
import styles from './TiptapEditor.module.scss'

export const TiptapEditor = /*#__PURE__*/ forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor(props, ref) {
    const { result } = useEditorSession(props)
    const { editor, interactions, issues, readJSON, exportMarkdown, replaceContent, focus } = result
    useImperativeHandle(ref, () => ({ readJSON, exportMarkdown, replaceContent, focus }), [
      readJSON,
      exportMarkdown,
      replaceContent,
      focus,
    ])
    return (
      <div className={[styles.editor, props.className].filter(Boolean).join(' ')}>
        {issues.length > 0 && (
          <div role="alert" className={styles.error}>
            {issues.map((issue, i) => (
              <p key={i}>{issue.message}</p>
            ))}
          </div>
        )}
        <div className={contentStyles.content}>
          <EditorContent editor={editor} />
        </div>
        {interactions}
      </div>
    )
  },
)
