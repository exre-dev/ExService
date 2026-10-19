import { lazy, Suspense } from 'react'
import { currentEmojiAnchor } from '../emoji-trigger'
import type { MarkdownEmojiPickerProps } from './types'

const Panel = lazy(() => import('../EmojiPickerPanel'))
export function MarkdownEmojiPicker(props: MarkdownEmojiPickerProps) {
  if (
    props.editor.isDestroyed ||
    !props.editor.isEditable ||
    currentEmojiAnchor(props.editor)?.session !== props.session
  )
    return null
  return (
    <Suspense fallback={null}>
      <Panel {...props} />
    </Suspense>
  )
}
