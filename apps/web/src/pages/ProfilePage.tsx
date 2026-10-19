import { useEffect } from 'react'
import { Button } from '@exre/exui'
import { PageAsyncBoundary } from '@web/src/routes/PageAsyncBoundary'
import { useSnapshot } from 'valtio'
import { useAuth } from '@web/src/auth/AuthContext'
import { SettingsExperience } from '@web/src/settings/SettingsExperience'
import { settingsConfig } from '@web/src/settings/settingsConfig'
import styles from '@web/src/pages/ProfilePage.module.scss'

export function ProfilePage() {
  const auth = useAuth()
  const settings = useSnapshot(settingsConfig)
  useEffect(() => {
    if (auth.state.status === 'anonymous') auth.openModal('login')
  }, [auth.state.status, auth.openModal])
  if (auth.state.status === 'anonymous') {
    return (
      <main className={styles.page}>
        <div className={styles.message}>
          <h1>个人资料</h1>
          <p>登录后可以编辑资料。</p>
          <Button onClick={() => auth.openModal('login')}>登录</Button>
        </div>
      </main>
    )
  }
  if (auth.state.status === 'loading') {
    return <PageAsyncBoundary loading loadingTitle="正在读取登录状态…" />
  }
  if (auth.state.status === 'unavailable' && settings.profile.snapshot === null) {
    return (
      <main className={styles.page}>
        <div className={styles.message}>
          <h1>个人资料</h1>
          <p role="alert">{auth.state.message}</p>
          <Button onClick={auth.retrySession}>重试</Button>
        </div>
      </main>
    )
  }
  return (
    <main className={styles.page}>
      <h1 className={styles.visuallyHidden}>设置</h1>
      <SettingsExperience initialCategory="profile" />
    </main>
  )
}
