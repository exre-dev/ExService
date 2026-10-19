import type { ReactNode } from 'react'
import { Button } from '@exre/exui'
import { useOutletContext } from 'react-router'
import { useAuth } from '@web/src/auth/AuthContext'
import type { SiteOutletContext } from './RootLayout'
import styles from './SupportAccess.module.scss'

/** Check the real session before mounting the lazy Support subtree. */
export function SupportAccess({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const layout = useOutletContext<SiteOutletContext>()
  if (auth.state.status === 'authenticated') return children
  return (
    <main className={styles.prompt}>
      <h1>支持中心</h1>
      {auth.state.status === 'loading' ? (
        <p role="status">正在确认登录状态…</p>
      ) : auth.state.status === 'anonymous' ? (
        <>
          <p>登录后可访问支持中心</p>
          <Button onClick={(event) => layout.requestLogin(event.currentTarget)}>登录</Button>
        </>
      ) : (
        <>
          <p role="alert">暂时无法确认登录状态，请稍后重试。</p>
          <Button onClick={auth.retrySession}>重试登录状态</Button>
        </>
      )}
    </main>
  )
}
