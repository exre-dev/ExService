import type { ComponentProps } from 'react'
import type { MDXComponents } from 'mdx/types'
import { Callout, CodeBlock, ContentImage } from '@workspace/components'
import styles from '@components/src/content/Content.module.scss'

export const baseMdxComponents: MDXComponents = {
  pre: CodeBlock,
  table: ({ children, ...props }: ComponentProps<'table'>) => (
    <div className={styles.table} tabIndex={0} role="region" aria-label="内容表格">
      <table {...props}>{children}</table>
    </div>
  ),
  Callout,
  ContentImage,
}
export function createMdxComponents(overrides: MDXComponents = {}): MDXComponents {
  return { ...baseMdxComponents, ...overrides }
}
