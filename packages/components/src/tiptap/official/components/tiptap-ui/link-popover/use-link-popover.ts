import * as React from 'react'
import type { Editor } from '@tiptap/react'

// --- Hooks ---
import { useTiptapEditor } from '../../../hooks/use-tiptap-editor'

// --- Icons ---
import { LinkIcon } from '../../tiptap-icons/link-icon'

// --- Lib ---
import { isMarkInSchema } from '../../../lib/tiptap-utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { isSafeTiptapUrl } from '../../../../conversion'
import { useOfficialIntegration } from '../../../integration'
const linkSchema = /*#__PURE__*/ z.object({
  href: z
    .string()
    .refine(
      (value) => isSafeTiptapUrl(value, 'link'),
      '请输入安全的 http、https、mailto 或站内地址。',
    ),
})

/**
 * Configuration for the link popover functionality
 */
export interface UseLinkPopoverConfig {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Whether to hide the link popover when not available.
   * @default false
   */
  hideWhenUnavailable?: boolean
  /**
   * Callback function called when the link is set.
   */
  onSetLink?: () => void
}

/**
 * Configuration for the link handler functionality
 */
export interface LinkHandlerProps {
  /**
   * The Tiptap editor instance.
   */
  editor: Editor | null
  /**
   * Callback function called when the link is set.
   */
  onSetLink?: () => void
}

/**
 * Checks if a link can be set in the current editor state
 */
export function canSetLink(editor: Editor | null): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable) return false
  return editor.can().setMark('link')
}

/**
 * Checks if a link is currently active in the editor
 */
export function isLinkActive(editor: Editor | null): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable) return false
  return editor.isActive('link')
}

/**
 * Determines if the link button should be shown
 */
export function shouldShowLinkButton(props: {
  editor: Editor | null
  hideWhenUnavailable: boolean
}): boolean {
  const { editor, hideWhenUnavailable } = props

  const linkInSchema = isMarkInSchema('link', editor)

  if (!linkInSchema || !editor) {
    return false
  }

  if (hideWhenUnavailable && !editor.isActive('code')) {
    return canSetLink(editor)
  }

  return true
}

/**
 * Custom hook for handling link operations in a Tiptap editor
 */
export function useLinkHandler({ editor, onSetLink }: LinkHandlerProps) {
  const integration = useOfficialIntegration()
  const form = useForm<{ href: string }>({
    resolver: zodResolver(linkSchema),
    defaultValues: { href: String(editor?.getAttributes('link').href ?? '') },
  })
  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const refresh = () => form.reset({ href: String(editor.getAttributes('link').href ?? '') })
    editor.on('selectionUpdate', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
    }
  }, [editor, form])
  const setLink = React.useCallback(async () => {
    let accepted = false
    await form.handleSubmit((values) => {
      accepted = integration.run((instance) =>
        instance
          .chain()
          .extendMarkRange('link')
          .setLink({ href: values.href, target: null, rel: null })
          .run(),
      )
      if (accepted) onSetLink?.()
      else form.setError('root', { message: '链接未能应用，请检查选区或文档大小后重试。' })
    })()
    return accepted
  }, [form, integration, onSetLink])
  const removeLink = React.useCallback(() => {
    const accepted = integration.run((instance) =>
      instance.chain().extendMarkRange('link').unsetLink().setMeta('preventAutolink', true).run(),
    )
    if (!accepted) form.setError('root', { message: '链接未能移除，请选择已有链接后重试。' })
    return accepted
  }, [form, integration])
  const openLink = React.useCallback(() => {
    const href = form.getValues('href')
    if (isSafeTiptapUrl(href, 'link')) window.open(href, '_blank', 'noopener,noreferrer')
  }, [form])
  return { form, setLink, removeLink, openLink }
}

/**
 * Custom hook for link popover state management
 */
export function useLinkState(props: { editor: Editor | null; hideWhenUnavailable: boolean }) {
  const { editor, hideWhenUnavailable = false } = props

  const canSet = canSetLink(editor)
  const isActive = isLinkActive(editor)

  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const handleSelectionUpdate = () => {
      setIsVisible(
        shouldShowLinkButton({
          editor,
          hideWhenUnavailable,
        }),
      )
    }

    handleSelectionUpdate()

    editor.on('selectionUpdate', handleSelectionUpdate)

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, hideWhenUnavailable])

  return {
    isVisible,
    canSet,
    isActive,
  }
}

/**
 * Main hook that provides link popover functionality for Tiptap editor
 *
 * @example
 * ```tsx
 * // Simple usage
 * function MyLinkButton() {
 *   const { isVisible, canSet, isActive, Icon, label } = useLinkPopover()
 *
 *   if (!isVisible) return null
 *
 *   return <button disabled={!canSet}>Link</button>
 * }
 *
 * // Advanced usage with configuration
 * function MyAdvancedLinkButton() {
 *   const { isVisible, canSet, isActive, Icon, label } = useLinkPopover({
 *     editor: myEditor,
 *     hideWhenUnavailable: true,
 *     onSetLink: () => console.log('Link set!')
 *   })
 *
 *   if (!isVisible) return null
 *
 *   return (
 *     <MyButton
 *       disabled={!canSet}
 *       aria-label={label}
 *       aria-pressed={isActive}
 *     >
 *       <Icon />
 *       {label}
 *     </MyButton>
 *   )
 * }
 * ```
 */
export function useLinkPopover(config?: UseLinkPopoverConfig) {
  const { editor: providedEditor, hideWhenUnavailable = false, onSetLink } = config || {}

  const { editor } = useTiptapEditor(providedEditor)

  const { isVisible, canSet, isActive } = useLinkState({
    editor,
    hideWhenUnavailable,
  })

  const linkHandler = useLinkHandler({
    editor,
    onSetLink,
  })

  return {
    isVisible,
    canSet,
    isActive,
    label: 'Link',
    Icon: LinkIcon,
    ...linkHandler,
  }
}
