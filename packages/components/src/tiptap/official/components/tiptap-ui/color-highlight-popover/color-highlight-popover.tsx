import * as React from 'react'
import { useEditorState, type Editor } from '@tiptap/react'

// --- Hooks ---
import { useTiptapEditor } from '../../../hooks/use-tiptap-editor'

// --- Icons ---
import { HighlighterIcon } from '../../tiptap-icons/highlighter-icon'
import { TextColorSmallIcon } from '../../tiptap-icons/text-color-small-icon'
import { useOfficialIntegration } from '../../../integration'
import styles from '../../../theme.module.scss'

// --- UI Primitives ---
import type { ButtonProps } from '../../tiptap-ui-primitive/button'
import { Button } from '../../tiptap-ui-primitive/button'
import { Popover, PopoverTrigger, PopoverContent } from '../../tiptap-ui-primitive/popover'

// --- Tiptap UI ---
import type { HighlightColor, UseColorHighlightConfig } from '../color-highlight-button'
import {
  ColorHighlightButton,
  pickHighlightColorsByValue,
  useColorHighlight,
} from '../color-highlight-button'

export interface ColorHighlightPopoverContentProps {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null
  /**
   * Optional colors to use in the highlight popover.
   * If not provided, defaults to a predefined set of colors.
   */
  colors?: HighlightColor[]
  textColors?: HighlightColor[]
}

export interface ColorHighlightPopoverProps
  extends
    Omit<ButtonProps, 'type'>,
    Pick<UseColorHighlightConfig, 'editor' | 'hideWhenUnavailable' | 'onApplied'> {
  /**
   * Optional colors to use in the highlight popover.
   * If not provided, defaults to a predefined set of colors.
   */
  colors?: HighlightColor[]
  textColors?: HighlightColor[]
}

export const ColorHighlightPopoverButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, ...props }, ref) => (
    <Button
      type="button"
      className={className}
      data-style="ghost"
      data-appearance="default"
      role="button"
      tabIndex={-1}
      aria-label="Highlight text"
      tooltip="Highlight"
      ref={ref}
      {...props}
    >
      {children ?? <HighlighterIcon className="tiptap-button-icon" />}
    </Button>
  ),
)

ColorHighlightPopoverButton.displayName = 'ColorHighlightPopoverButton'

export function ColorHighlightPopoverContent({
  editor,
  textColors = [],
  colors = pickHighlightColorsByValue([
    'var(--tt-color-highlight-green)',
    'var(--tt-color-highlight-blue)',
    'var(--tt-color-highlight-red)',
    'var(--tt-color-highlight-purple)',
    'var(--tt-color-highlight-yellow)',
  ]),
}: ColorHighlightPopoverContentProps) {
  const { handleRemoveHighlight, canColorHighlight } = useColorHighlight({ editor })
  const integration = useOfficialIntegration()
  const state = useEditorState({
    editor: editor ?? null,
    selector: ({ editor: instance }) => ({
      color: instance?.getAttributes('textStyle').color as string | undefined,
      highlight: instance?.getAttributes('highlight').color as string | undefined,
    }),
  })
  const applyTextColor = (value: string | null) =>
    integration.run((instance) =>
      value ? instance.chain().setColor(value).run() : instance.chain().unsetColor().run(),
    )
  const canTextColor =
    !!editor && !editor.isDestroyed && editor.isEditable && editor.can().setColor('#000000')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const headingId = React.useId()
  const navigateColors = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    )
    if (!buttons.length) return
    const current = buttons.indexOf(
      event.currentTarget.ownerDocument.activeElement as HTMLButtonElement,
    )
    let next: number
    switch (event.key) {
      case 'ArrowRight':
        next = current + 1
        break
      case 'ArrowLeft':
        next = current - 1
        break
      case 'ArrowDown':
        next = current + 5
        break
      case 'ArrowUp':
        next = current - 5
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = buttons.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    event.stopPropagation()
    buttons[(next + buttons.length) % buttons.length]?.focus()
  }

  return (
    <div ref={containerRef} className={styles.colorSections} onKeyDown={navigateColors}>
      {textColors.length > 0 && (
        <section aria-labelledby={`${headingId}-text`}>
          <h3 id={`${headingId}-text`} className={styles.colorHeading}>
            Text Color
          </h3>
          <div className={styles.colorGrid} role="group" aria-label="文字颜色">
            <Button
              className={styles.colorChoice}
              data-default="true"
              aria-label="清除文字颜色"
              title="默认文字颜色"
              disabled={!canTextColor}
              aria-pressed={!state?.color}
              onClick={() => applyTextColor(null)}
            >
              <TextColorSmallIcon className="tiptap-button-icon" />
            </Button>
            {textColors.map((color) => (
              <Button
                key={color.value}
                className={styles.colorChoice}
                aria-label={`文字颜色 ${color.label}`}
                title={color.label}
                disabled={!canTextColor}
                aria-pressed={state?.color === color.value}
                style={{
                  color: color.value,
                  borderColor: `color-mix(in srgb, ${color.border} 35%, transparent)`,
                }}
                onClick={() => applyTextColor(color.value)}
              >
                <TextColorSmallIcon className="tiptap-button-icon" />
              </Button>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby={`${headingId}-highlight`}>
        <h3 id={`${headingId}-highlight`} className={styles.colorHeading}>
          Highlight Color
        </h3>
        <div className={styles.colorGrid} role="group" aria-label="高亮颜色">
          <Button
            className={styles.colorChoice}
            data-default="true"
            aria-label="清除高亮"
            title="默认高亮颜色"
            disabled={!canColorHighlight}
            aria-pressed={!state?.highlight}
            onClick={handleRemoveHighlight}
          >
            <span className={styles.colorFill} />
          </Button>
          {colors.map((color) => (
            <ColorHighlightButton
              key={color.value}
              editor={editor}
              className={styles.colorChoice}
              highlightColor={color.value}
              showTooltip={false}
              title={color.label}
              aria-label={`高亮 ${color.label}`}
            >
              <span
                className={styles.colorFill}
                style={{
                  backgroundColor: color.value,
                  borderColor: `color-mix(in srgb, ${color.border} 35%, transparent)`,
                }}
              />
            </ColorHighlightButton>
          ))}
        </div>
      </section>
    </div>
  )
}

export function ColorHighlightPopover({
  editor: providedEditor,
  textColors,
  colors = pickHighlightColorsByValue([
    'var(--tt-color-highlight-green)',
    'var(--tt-color-highlight-blue)',
    'var(--tt-color-highlight-red)',
    'var(--tt-color-highlight-purple)',
    'var(--tt-color-highlight-yellow)',
  ]),
  hideWhenUnavailable = false,
  onApplied,
  ...props
}: ColorHighlightPopoverProps) {
  const { editor } = useTiptapEditor(providedEditor)
  const [isOpen, setIsOpen] = React.useState(false)
  const applying = React.useRef(false)
  const { isVisible, canColorHighlight, isActive, label, Icon } = useColorHighlight({
    editor,
    hideWhenUnavailable,
    onApplied,
  })

  if (!isVisible) return null

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <ColorHighlightPopoverButton
          disabled={!canColorHighlight}
          data-active-state={isActive ? 'on' : 'off'}
          data-disabled={!canColorHighlight}
          aria-pressed={isActive}
          aria-label={label}
          tooltip={label}
          {...props}
        >
          <Icon className="tiptap-button-icon" />
        </ColorHighlightPopoverButton>
      </PopoverTrigger>
      <PopoverContent
        className={styles.colorPanel}
        aria-label="文字颜色与高亮"
        onClickCapture={(event) => {
          const button = (event.target as HTMLElement).closest('button')
          if (!button) return
          // Host commands focus the editor after committing. Keep this palette's
          // session and keyboard focus so its other color group remains usable.
          applying.current = true
          requestAnimationFrame(() => {
            if (button.isConnected && button.closest('[data-state="open"]'))
              button.focus({ preventScroll: true })
            applying.current = false
          })
        }}
        onFocusOutside={(event) => {
          if (applying.current) event.preventDefault()
        }}
      >
        <ColorHighlightPopoverContent editor={editor} colors={colors} textColors={textColors} />
      </PopoverContent>
    </Popover>
  )
}

export default ColorHighlightPopover
