import { useEffect, useId, useRef, useState } from 'react'
import {
  Alert,
  AlertTitle,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  ExMessage,
  Spinner,
} from '@exre/exui'
import { Check, CircleAlert, Copy, RotateCcw } from 'lucide-react'
import styles from './AsyncBoundary.module.scss'

export interface FeedbackProps {
  layout?: 'page' | 'section'
  /** Only the fallback acquires this element/class; successful content is returned directly. */
  as?: 'main' | 'div'
  className?: string
  loadingTitle?: string
  loadingDescription?: string
  homeUrl?: string
}

function frameClass({ layout = 'section', className }: FeedbackProps) {
  return `${styles.frame} ${styles[layout]}${className ? ` ${className}` : ''}`
}

// Pending layout adapted from ExUI c-spinner-5 (ReUI); see AsyncBoundary.LICENSE.md.
export function AsyncPending(props: FeedbackProps) {
  const { as: Container = 'div', loadingTitle = '正在加载…', loadingDescription } = props
  const [visible, setVisible] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 150)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <Container className={frameClass(props)}>
      <Empty
        className={styles.pending}
        role="status"
        aria-labelledby={visible ? titleId : undefined}
        aria-describedby={visible && loadingDescription ? descriptionId : undefined}
      >
        {visible && (
          <EmptyHeader className={styles.pendingHeader}>
            <EmptyMedia variant="icon">
              <Spinner className={styles.spinner} role="presentation" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle id={titleId}>{loadingTitle}</EmptyTitle>
            {loadingDescription && (
              <EmptyDescription id={descriptionId}>{loadingDescription}</EmptyDescription>
            )}
          </EmptyHeader>
        )}
      </Empty>
    </Container>
  )
}

function errorReport(kind: 'load' | 'render', error: unknown, componentStack?: string) {
  const summary =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : '未提供可显示的错误详情。'
  const stack = error instanceof Error ? error.stack : undefined
  return [
    kind === 'load' ? '加载错误' : 'React 渲染错误',
    summary,
    stack && stack !== summary ? stack : undefined,
    componentStack ? `React 组件堆栈：${componentStack}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function AsyncFailure({
  kind,
  error,
  componentStack,
  onRetry,
  ...props
}: FeedbackProps & {
  kind: 'load' | 'render'
  error: unknown
  componentStack?: string
  onRetry: () => void
}) {
  const { as: Container = 'div', homeUrl } = props
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const copying = useRef(false)
  const detailsId = useId()
  const titleId = useId()
  const report = errorReport(kind, error, componentStack)
  useEffect(() => {
    setExpanded(false)
    setCopied(false)
  }, [error, kind])

  async function copyReport() {
    if (copying.current) return
    copying.current = true
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      ExMessage.error('复制失败，请选择错误信息后手动复制。')
    } finally {
      copying.current = false
    }
  }

  return (
    <Container className={frameClass(props)}>
      <section className={styles.failure} aria-labelledby={titleId}>
        <div className={styles.errorIcon}>
          <CircleAlert aria-hidden="true" />
        </div>
        <div role="alert">
          <h2 id={titleId} className={styles.heading}>
            {kind === 'load' ? '内容暂时无法加载' : '这部分内容暂时无法显示'}
          </h2>
          <p className={styles.description}>
            {kind === 'load' ? '请稍后重试，或' : '可以重试恢复，或'}
            <a
              href={`#${detailsId}`}
              aria-expanded={expanded}
              aria-controls={expanded ? detailsId : undefined}
              onClick={(event) => {
                event.preventDefault()
                setExpanded((value) => !value)
              }}
            >
              {expanded ? '收起错误' : '查看错误'}
            </a>
            。
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            重试
          </Button>
          {homeUrl && (
            <Button variant="outline" asChild>
              <a href={homeUrl}>返回首页</a>
            </Button>
          )}
        </div>
        {expanded && (
          <Alert
            id={detailsId}
            variant="destructive"
            role="region"
            aria-label="错误详情"
            className={styles.details}
          >
            <header className={styles.detailsHeader}>
              <AlertTitle>错误详情</AlertTitle>
              <Button
                variant="ghost"
                size="sm"
                aria-label="复制完整错误信息"
                onClick={() => void copyReport()}
              >
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span aria-live="polite">{copied ? '已复制' : '复制'}</span>
              </Button>
            </header>
            <div
              className={styles.detailsBody}
              tabIndex={0}
              role="region"
              aria-label="可滚动的错误详情"
            >
              <pre>{report}</pre>
            </div>
          </Alert>
        )}
      </section>
    </Container>
  )
}
