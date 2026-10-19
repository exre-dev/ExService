import {
  forwardRef,
  useEffect,
  useId,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react'
import {
  Button as ExButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  Popover as ExPopover,
  PopoverContent as ExPopoverContent,
  PopoverTrigger,
  DropdownMenu as ExDropdownMenu,
  DropdownMenuContent as ExDropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  Separator as ExSeparator,
} from '@exre/exui'
import { cn, parseShortcutKeys } from './lib/tiptap-utils'
import { translateLabel, useOfficialIntegration } from './integration'
import styles from './theme.module.scss'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  showTooltip?: boolean
  tooltip?: ReactNode
  shortcutKeys?: string
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    children,
    tooltip,
    showTooltip = true,
    shortcutKeys,
    'aria-label': ariaLabel,
    onMouseDown,
    onClick,
    ...props
  },
  ref,
) {
  const integration = useOfficialIntegration()
  const label = ariaLabel ? translateLabel(ariaLabel) : undefined
  const content = (
    <ExButton
      ref={ref}
      type="button"
      variant="ghost"
      className={cn(styles.button, className)}
      aria-label={label}
      {...props}
      onMouseDown={(event) => {
        onMouseDown?.(event)
        if (!event.defaultPrevented) event.preventDefault()
      }}
      onClick={(event) => {
        if (!integration.restore()) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
    >
      {children}
    </ExButton>
  )
  return tooltip && showTooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        {typeof tooltip === 'string' ? translateLabel(tooltip) : tooltip}
        {shortcutKeys && <span> {parseShortcutKeys({ shortcutKeys }).join('+')}</span>}
      </TooltipContent>
    </Tooltip>
  ) : (
    content
  )
})

export const ButtonGroup = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }
>(function ButtonGroup({ className, orientation = 'vertical', ...props }, ref) {
  return (
    <div
      ref={ref}
      role="group"
      className={cn(styles.group, className)}
      data-orientation={orientation}
      {...props}
    />
  )
})
export function Badge({ children }: { children?: ReactNode }) {
  return <span className={styles.badge}>{children}</span>
}
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn(styles.card, className)} {...props} />
})
export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardBody(props, ref) {
    return <div ref={ref} {...props} />
  },
)
export const CardItemGroup = ButtonGroup
export const Separator = forwardRef<HTMLDivElement, ComponentProps<typeof ExSeparator>>(
  function Separator({ className, ...props }, ref) {
    return <ExSeparator ref={ref} className={cn(styles.separator, className)} {...props} />
  },
)

export function Popover({ onOpenChange, ...props }: ComponentProps<typeof ExPopover>) {
  const integration = useOfficialIntegration()
  const id = useId()
  useEffect(() => {
    if (props.open === false) integration.end(id)
  }, [props.open, id, integration])
  useEffect(() => () => integration.end(id), [id, integration])
  return (
    <ExPopover
      {...props}
      onOpenChange={(open) => {
        if (open) integration.begin(id)
        onOpenChange?.(open)
        if (!open) integration.end(id)
      }}
    />
  )
}
export const PopoverContent = forwardRef<HTMLDivElement, ComponentProps<typeof ExPopoverContent>>(
  function PopoverContent({ className, ...props }, ref) {
    return (
      <ExPopoverContent
        ref={ref}
        align="start"
        className={cn(styles.panel, className)}
        {...props}
      />
    )
  },
)
export function DropdownMenu({ onOpenChange, ...props }: ComponentProps<typeof ExDropdownMenu>) {
  const integration = useOfficialIntegration()
  const id = useId()
  useEffect(() => {
    if (props.open === false) integration.end(id)
  }, [props.open, id, integration])
  useEffect(() => () => integration.end(id), [id, integration])
  return (
    <ExDropdownMenu
      {...props}
      modal={false}
      onOpenChange={(open) => {
        if (open) integration.begin(id)
        onOpenChange?.(open)
        if (!open) integration.end(id)
      }}
    />
  )
}
export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof ExDropdownMenuContent> & { portal?: boolean }
>(function DropdownMenuContent({ className, portal: _portal, ...props }, ref) {
  return <ExDropdownMenuContent ref={ref} className={cn(styles.panel, className)} {...props} />
})
export { PopoverTrigger, DropdownMenuTrigger, DropdownMenuItem, TooltipProvider }
