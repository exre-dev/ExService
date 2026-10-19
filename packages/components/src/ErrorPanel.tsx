import { useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { Alert, AlertTitle } from '@exre/exui'
import { CircleAlert } from 'lucide-react'
import styles from '@components/src/ErrorPanel.module.scss'

export interface ErrorPanelItem {
  id: string
  message: string
  description?: string
}
export interface ErrorPanelProps {
  errors: readonly ErrorPanelItem[]
  title?: string
  maxHeight?: number
  action?: ReactElement | null
  id?: string
  className?: string
}

export function ErrorPanel({ errors, title, maxHeight, action, id, className }: ErrorPanelProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  const previousContent = useRef<string | null>(null)
  const [overflowing, setOverflowing] = useState(false)
  const effectiveHeight =
    maxHeight !== undefined && Number.isFinite(maxHeight) && maxHeight >= 160 ? maxHeight : 240
  const content = JSON.stringify(
    errors.map(({ id, message, description }) => [id, message, description]),
  )

  useLayoutEffect(() => {
    const element = list.current,
      container = panel.current
    if (!element || !container) return
    if (previousContent.current !== content) element.scrollTop = 0
    previousContent.current = content
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(element)
    return () => observer.disconnect()
  }, [content, effectiveHeight, title, action])

  if (errors.length === 0) return null
  const multiple = errors.length > 1
  return (
    <Alert
      ref={panel}
      id={id}
      className={`${styles.panel}${className ? ` ${className}` : ''}`}
      style={{ maxHeight: effectiveHeight }}
      role="region"
      aria-live="polite"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : '错误信息'}
    >
      {title && (
        <header className={styles.header} data-slot="error-panel-header">
          <CircleAlert className={styles.icon} aria-hidden="true" />
          <AlertTitle id={titleId} className={styles.title}>
            {title}
          </AlertTitle>
          {multiple && <span className={styles.count}>{errors.length} 条</span>}
        </header>
      )}
      <ol ref={list} role="list" className={styles.list} tabIndex={overflowing ? 0 : undefined}>
        {errors.map((error, index) => (
          <li key={error.id} className={styles.item}>
            {multiple && (
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
            )}
            <div className={styles.content}>
              <p className={styles.message}>{error.message}</p>
              {error.description && <p className={styles.description}>{error.description}</p>}
            </div>
          </li>
        ))}
      </ol>
      {action != null && (
        <footer className={styles.footer} data-slot="error-panel-footer">
          {action}
        </footer>
      )}
    </Alert>
  )
}
