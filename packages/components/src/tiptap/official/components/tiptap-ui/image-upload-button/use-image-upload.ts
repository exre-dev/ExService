import type { Editor } from '@tiptap/react'
import { useTiptapEditor } from '../../../hooks/use-tiptap-editor'
import { useOfficialIntegration } from '../../../integration'
import { useHotkeys } from '../../../hooks/use-hotkeys'
import { ImagePlusIcon } from '../../tiptap-icons/image-plus-icon'
export const IMAGE_UPLOAD_SHORTCUT_KEY = 'mod+shift+i'
export interface UseImageUploadConfig {
  editor?: Editor | null
  hideWhenUnavailable?: boolean
  onInserted?: () => void
}
export function useImageUpload(config: UseImageUploadConfig = {}) {
  const { editor } = useTiptapEditor(config.editor)
  const integration = useOfficialIntegration()
  const canInsert =
    !!editor &&
    !editor.isDestroyed &&
    editor.isEditable &&
    editor.can().setImage({ src: '/image.png' })
  const handleImage = () => {
    if (canInsert) integration.upload()
    return canInsert
  }
  useHotkeys(
    IMAGE_UPLOAD_SHORTCUT_KEY,
    (event) => {
      event.preventDefault()
      handleImage()
    },
    { enabled: canInsert },
  )
  return {
    isVisible: !config.hideWhenUnavailable || canInsert,
    canInsert,
    isActive: false,
    handleImage,
    label: 'Add image',
    shortcutKeys: IMAGE_UPLOAD_SHORTCUT_KEY,
    Icon: ImagePlusIcon,
  }
}
