import { useEffect, useMemo, useState } from 'react'
import { Button, Card } from '@exre/exui'
import { ExIcon } from '@workspace/components'
import { ArrowLeftIcon } from 'lucide-react'
import { readRecentSsoSuccess } from '@web/src/auth/storage'
import { AuthBackdrop } from '@web/src/pages/AuthPage/AuthBackdrop'
import styles from '@web/src/pages/AuthPage/AuthPage.module.scss'

export function SsoSuccess() {
  const [closeAttempted, setCloseAttempted] = useState(false)
  const record = useMemo(() => {
    try {
      return readRecentSsoSuccess(window.sessionStorage, Date.now())
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (record === null) return
    const timer = window.setTimeout(() => {
      try {
        window.close()
      } catch {
        // Browsers may reject closing a tab that was not opened by script.
      }
      setCloseAttempted(true)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [record])

  return (
    <main className={styles.page} data-page="auth">
      <AuthBackdrop />
      {record === null && (
        <Button asChild variant="ghost" className={styles.homeLink}>
          <a href="/">
            <ArrowLeftIcon aria-hidden="true" /> Home
          </a>
        </Button>
      )}
      <Card glass className={`${styles.panel} ${styles.successPanel}`}>
        <ExIcon size="6rem" />
        {record === null ? (
          <section className={styles.errorContent} role="alert">
            <h1>发生错误</h1>
            <p>请从发起应用重新进入登录。</p>
          </section>
        ) : (
          <>
            <h1>登录成功</h1>
            <p role="status">{closeAttempted ? '请手动关闭此页面并返回应用' : '正在返回应用'}</p>
          </>
        )}
      </Card>
    </main>
  )
}
