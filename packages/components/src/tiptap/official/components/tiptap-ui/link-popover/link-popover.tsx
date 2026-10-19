'use client'

import * as React from 'react'
import type { Editor } from '@tiptap/react'

// --- Hooks ---
import { useIsMobile } from '../../../hooks/use-mobile'
import { useTiptapEditor } from '../../../hooks/use-tiptap-editor'

// --- Icons ---
import { CornerDownLeftIcon } from '../../tiptap-icons/corner-down-left-icon'
import { ExternalLinkIcon } from '../../tiptap-icons/external-link-icon'
import { LinkIcon } from '../../tiptap-icons/link-icon'
import { TrashIcon } from '../../tiptap-icons/trash-icon'

// --- Tiptap UI ---
import type { UseLinkPopoverConfig } from '.'
import { useLinkPopover } from '.'

// --- UI Primitives ---
import type { ButtonProps } from '../../tiptap-ui-primitive/button'
import { Button } from '../../tiptap-ui-primitive/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../tiptap-ui-primitive/popover'
import type { UseFormReturn } from 'react-hook-form'
import styles from './link-popover.module.scss'

export interface LinkMainProps {
  form: UseFormReturn<{ href: string }>
  setLink: () => Promise<boolean>
  removeLink: () => boolean
  openLink: () => void
  isActive: boolean
}

export interface LinkPopoverProps extends Omit<ButtonProps, 'type'>, UseLinkPopoverConfig {
  /**
   * Callback for when the popover opens or closes.
   */
  onOpenChange?: (isOpen: boolean) => void
  /**
   * Whether to automatically open the popover when a link is active.
   * @default true
   */
  autoOpenOnLinkActive?: boolean
}

/**
 * Link button component for triggering the link popover
 */
export const LinkButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        type="button"
        className={className}
        data-style="ghost"
        role="button"
        tabIndex={-1}
        aria-label="Link"
        tooltip="Link"
        ref={ref}
        {...props}
      >
        {children || <LinkIcon className="tiptap-button-icon" />}
      </Button>
    )
  },
)

LinkButton.displayName = 'LinkButton'

/**
 * Main content component for the link popover
 */
const LinkMain: React.FC<LinkMainProps> = ({ form, setLink, removeLink, openLink, isActive }) => {
  const id = React.useId()
  const isMobile = useIsMobile()
  const url = form.watch('href')
  return (
    <form
      className={styles.card}
      noValidate
      style={isMobile ? { boxShadow: 'none', border: 0 } : undefined}
      onSubmit={(event) => {
        event.preventDefault()
        void setLink()
      }}
    >
      <div className={styles.body} style={isMobile ? { padding: 0 } : undefined}>
        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <input
              className={styles.input}
              id={id}
              type="url"
              placeholder="Paste a link..."
              aria-label="链接地址"
              {...form.register('href')}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              aria-invalid={!!form.formState.errors.href}
              aria-describedby={form.formState.errors.href ? `${id}-error` : undefined}
            />
          </div>
          <div className={styles.buttonGroup}>
            <button
              className={styles.button}
              type="submit"
              title="Apply link"
              aria-label="应用链接"
              disabled={form.formState.isSubmitting || (!url && !isActive)}
              data-style="ghost"
            >
              <CornerDownLeftIcon className="tiptap-button-icon" />
            </button>
          </div>
          <div className={styles.separator} role="separator" aria-orientation="vertical" />
          <div className={styles.buttonGroup}>
            <button
              className={styles.button}
              type="button"
              title="Open in new window"
              aria-label="打开链接"
              disabled={!url && !isActive}
              data-style="ghost"
              onClick={openLink}
            >
              <ExternalLinkIcon className="tiptap-button-icon" />
            </button>
            <button
              className={styles.button}
              type="button"
              title="Remove link"
              aria-label="移除链接"
              disabled={!isActive}
              data-style="ghost"
              onClick={removeLink}
            >
              <TrashIcon className="tiptap-button-icon" />
            </button>
          </div>
        </div>
        {form.formState.errors.href && (
          <p className={styles.error} id={`${id}-error`} role="alert">
            {form.formState.errors.href.message}
          </p>
        )}
        {form.formState.errors.root && (
          <p className={styles.error} role="alert">
            {form.formState.errors.root.message}
          </p>
        )}
      </div>
    </form>
  )
}

/**
 * Link content component for standalone use
 */
export const LinkContent: React.FC<{
  editor?: Editor | null
}> = ({ editor }) => {
  const linkPopover = useLinkPopover({
    editor,
  })

  return <LinkMain {...linkPopover} />
}

/**
 * Link popover component for Tiptap editors.
 *
 * For custom popover implementations, use the `useLinkPopover` hook instead.
 */
export const LinkPopover = React.forwardRef<HTMLButtonElement, LinkPopoverProps>(
  (
    {
      editor: providedEditor,
      hideWhenUnavailable = false,
      onSetLink,
      onOpenChange,
      autoOpenOnLinkActive = true,
      onClick,
      children,
      ...buttonProps
    },
    ref,
  ) => {
    const { editor } = useTiptapEditor(providedEditor)
    const [isOpen, setIsOpen] = React.useState(false)

    const { isVisible, canSet, isActive, form, setLink, removeLink, openLink, label, Icon } =
      useLinkPopover({
        editor,
        hideWhenUnavailable,
        onSetLink,
      })

    const handleOnOpenChange = React.useCallback(
      (nextIsOpen: boolean) => {
        setIsOpen(nextIsOpen)
        onOpenChange?.(nextIsOpen)
      },
      [onOpenChange],
    )

    const handleSetLink = React.useCallback(async () => {
      const accepted = await setLink()
      if (accepted) handleOnOpenChange(false)
      return accepted
    }, [setLink, handleOnOpenChange])

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        // The Radix trigger owns opening and selection capture.
        return
      },
      [onClick, isOpen],
    )

    React.useEffect(() => {
      if (autoOpenOnLinkActive && isActive) {
        setIsOpen(true)
      }
    }, [autoOpenOnLinkActive, isActive])

    if (!isVisible) {
      return null
    }

    return (
      <Popover open={isOpen} onOpenChange={handleOnOpenChange}>
        <PopoverTrigger asChild>
          <LinkButton
            disabled={!canSet}
            data-active-state={isActive ? 'on' : 'off'}
            data-disabled={!canSet}
            aria-label={label}
            aria-pressed={isActive}
            onClick={handleClick}
            {...buttonProps}
            ref={ref}
          >
            {children ?? <Icon className="tiptap-button-icon" />}
          </LinkButton>
        </PopoverTrigger>

        <PopoverContent className={styles.popover}>
          <LinkMain
            form={form}
            setLink={handleSetLink}
            removeLink={() => {
              const accepted = removeLink()
              if (accepted) handleOnOpenChange(false)
              return accepted
            }}
            openLink={openLink}
            isActive={isActive}
          />
        </PopoverContent>
      </Popover>
    )
  },
)

LinkPopover.displayName = 'LinkPopover'

export default LinkPopover
