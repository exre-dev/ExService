import { forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { EditorContent } from '@tiptap/react'
import { useEditorSession } from '../useTiptapEditor'
import { TiptapLifecycle } from '../lifecycle'
import { TiptapToolbar } from '../toolbar/TiptapToolbar'
import type {
  TiptapEditorHandle,
  TiptapEditorSessionOptions,
  TiptapServiceCallbacks,
  TiptapContentPolicy,
  TiptapPreset,
} from '../types'

type Props = TiptapEditorSessionOptions &
  TiptapServiceCallbacks & {
    preset?: TiptapPreset
    policy?: TiptapContentPolicy
    toolbar?: boolean
    renderToolbar?: (toolbar: ReactNode) => ReactNode
  }
/** Test-only consumer composition: production editors never mount a toolbar. */
export const ExplicitToolbarEditor = forwardRef<TiptapEditorHandle, Props>(
  function ExplicitToolbarEditor(props, ref) {
    const { result, runtime } = useEditorSession({
      ...props,
      preset: props.preset ?? { kind: 'tiptap', options: { policy: props.policy } },
    })
    const { editor, readJSON, exportMarkdown, replaceContent, focus } = result
    useImperativeHandle(ref, () => ({ readJSON, exportMarkdown, replaceContent, focus }), [
      readJSON,
      exportMarkdown,
      replaceContent,
      focus,
    ])
    const toolbar =
      editor &&
      props.editable !== false &&
      props.toolbar !== false &&
      runtime instanceof TiptapLifecycle ? (
        <TiptapToolbar editor={editor} runtime={runtime} uploadEnabled={!!props.uploadImage} />
      ) : null
    return (
      <>
        {toolbar && (props.renderToolbar ? props.renderToolbar(toolbar) : toolbar)}
        <EditorContent editor={editor} />
        {result.interactions}
        {result.issues.length > 0 && (
          <div role="alert">
            {result.issues.map((issue, i) => (
              <p key={i}>{issue.message}</p>
            ))}
          </div>
        )}
      </>
    )
  },
)
