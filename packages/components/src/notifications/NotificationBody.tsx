import { Fragment, type ReactNode } from 'react'
import {
  parseNotificationContent,
  type NotificationContentInput,
  type SafeContentNode,
  type SafeElementNode,
} from '@components/src/notifications/notificationContent'
import { notificationCopy } from '@components/src/notifications/notificationsView'
import styles from '@components/src/notifications/NotificationBody.module.scss'

export interface NotificationBodyProps {
  content: NotificationContentInput | null
  fallbackText: string | null
}

/**
 * 通知正文：把已校验的安全节点树渲染成固定 React 元素。
 *
 * 三个出口：
 *
 * 1. 树可用 → 渲染白名单元素与转义文本；
 * 2. 树不可用但有 `fallbackText` → 展示「正文格式暂不可用」+ 完整纯文本；
 * 3. 两者都没有 → 返回 `null`，由调用方走安全失败（保留未读并提供重试）。
 *
 * 任何分支都不输出原始 HTML，也不调用 `dangerouslySetInnerHTML`。
 */
export function NotificationBody({ content, fallbackText }: NotificationBodyProps) {
  const tree = parseNotificationContent(content)
  if (tree !== null) {
    return <div className={styles.body}>{tree.map((node, index) => renderNode(node, index))}</div>
  }
  if (fallbackText !== null && fallbackText.length > 0) {
    return (
      <div className={styles.body}>
        <p className={styles.fallbackNotice}>{notificationCopy.bodyUnavailable}</p>
        <p className={styles.fallbackText}>{fallbackText}</p>
      </div>
    )
  }
  return null
}

/** 调用方据此区分「回退可用」与「必须安全失败并重试」。 */
export function hasRenderableNotificationBody(
  content: NotificationContentInput | null,
  fallbackText: string | null,
): boolean {
  return (
    parseNotificationContent(content) !== null || (fallbackText !== null && fallbackText.length > 0)
  )
}

function renderNode(node: SafeContentNode, key: number): ReactNode {
  if (node.type === 'text') return <Fragment key={key}>{node.value}</Fragment>
  return renderElement(node, key)
}

function renderChildren(nodes: SafeContentNode[]): ReactNode[] {
  return nodes.map((child, index) => renderNode(child, index))
}

function renderElement(node: SafeElementNode, key: number): ReactNode {
  const children = renderChildren(node.children)
  switch (node.tag) {
    case 'p':
      return (
        <p key={key} className={styles.paragraph}>
          {children}
        </p>
      )
    case 'br':
      return <br key={key} />
    case 'h2':
      return (
        <h2 key={key} className={styles.heading2}>
          {children}
        </h2>
      )
    case 'h3':
      return (
        <h3 key={key} className={styles.heading3}>
          {children}
        </h3>
      )
    case 'strong':
      return <strong key={key}>{children}</strong>
    case 'em':
      return <em key={key}>{children}</em>
    case 's':
      return <s key={key}>{children}</s>
    case 'ul':
      return (
        <ul key={key} className={styles.list}>
          {children}
        </ul>
      )
    case 'ol':
      return (
        <ol key={key} className={styles.list}>
          {children}
        </ol>
      )
    case 'li':
      return <li key={key}>{children}</li>
    case 'blockquote':
      return (
        <blockquote key={key} className={styles.quote}>
          {children}
        </blockquote>
      )
    case 'code':
      return (
        <code key={key} className={styles.code}>
          {children}
        </code>
      )
    case 'pre':
      return (
        <pre key={key} className={styles.pre}>
          {children}
        </pre>
      )
    case 'hr':
      return <hr key={key} className={styles.rule} />
    case 'a':
      // 只可能是已通过 URL 政策的站内只读路径；外链目前一律被政策拒绝，
      // 因此这里不设置 target/rel —— 一旦外链放开必须在此补 `rel="noopener noreferrer"`。
      return (
        <a key={key} className={styles.link} href={node.href}>
          {children}
        </a>
      )
    case 'table':
      return (
        <div
          key={key}
          className={styles.tableScroll}
          role="region"
          tabIndex={0}
          aria-label="通知正文表格，可横向滚动"
        >
          <table className={styles.table}>{children}</table>
        </div>
      )
    case 'caption':
      return (
        <caption key={key} className={styles.caption}>
          {children}
        </caption>
      )
    case 'thead':
      return <thead key={key}>{children}</thead>
    case 'tbody':
      return <tbody key={key}>{children}</tbody>
    case 'tr':
      return <tr key={key}>{children}</tr>
    case 'th':
      return (
        <th key={key} scope={node.scope}>
          {children}
        </th>
      )
    case 'td':
      return <td key={key}>{children}</td>
  }
}
