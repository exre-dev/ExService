import { Button, ExMessage } from '@exre/exui'
import { Copy } from 'lucide-react'
import type { ComponentProps } from 'react'
import styles from './Content.module.scss'

export interface CodeBlockProps extends ComponentProps<'pre'> {
  rawCode?: string
  'data-language'?: string
}
export function CodeBlock({ rawCode, children, title, className, ...props }: CodeBlockProps) {
  const copy = async () => {
    try {
      if (rawCode === undefined || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(rawCode)
      ExMessage.info('代码已复制')
    } catch {
      ExMessage.error('无法复制，请手动选择代码')
    }
  }
  return (
    <figure className={styles.codeBlock}>
      <figcaption>
        <span>{title ?? props['data-language'] ?? '代码'}</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="复制代码"
          onClick={() => {
            void copy()
          }}
        >
          <Copy aria-hidden="true" />
        </Button>
      </figcaption>
      <pre {...props} className={`${styles.pre} ${className ?? ''}`}>
        {children}
      </pre>
    </figure>
  )
}
