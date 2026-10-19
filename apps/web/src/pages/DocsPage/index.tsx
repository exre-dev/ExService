import { Button } from '@exre/exui'
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import styles from './DocsPage.module.scss'

/** Public landing for the documentation area while its content is being prepared. */
export function DocsPage() {
  return (
    <main className={styles.page}>
      <BookOpen className={styles.icon} aria-hidden="true" />
      <h1>文档建设中</h1>
      <p>我们正在整理文档内容，敬请期待。</p>
      <Button asChild variant="outline">
        <Link to="/">返回网站首页</Link>
      </Button>
    </main>
  )
}
