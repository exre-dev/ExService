import { Button, Card } from '@exre/exui'
import { Link } from 'react-router'
import { AuthBackdrop } from '@web/src/pages/AuthPage/AuthBackdrop'
import styles from '@web/src/pages/NotFound.module.scss'

/**
 * 未匹配路径的兜底页面。
 * 它不能替代 Server 的 404 envelope；这里只处理前端路由，不发起任何 API 请求。
 */
export function NotFound() {
  return (
    <main className={styles.page} aria-labelledby="not-found-title">
      <AuthBackdrop />
      <section className={styles.frame}>
        <Card glass className={styles.content}>
          <img
            className={styles.logo}
            src="/ExIcon.svg"
            alt="Ex"
            width="160"
            height="160"
            draggable={false}
          />
          <h1 id="not-found-title" className={styles.code}>
            404
          </h1>
          <p className={styles.description}>Page not found</p>
          <Button asChild className={styles.homeLink}>
            <Link to="/">返回首页</Link>
          </Button>
        </Card>
      </section>
    </main>
  )
}
