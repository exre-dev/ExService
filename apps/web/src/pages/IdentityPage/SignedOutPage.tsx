import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@exre/exui'
import { PageAsyncBoundary } from '@web/src/routes/PageAsyncBoundary'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { instance, ExAxiosError } from '@workspace/sdk'
import { readToken, removeMatchingToken, subscribeSessionChanges } from '@web/src/auth/storage'

import styles from './SignedOutStatus.module.scss'

type Result = 'checking' | 'signed-out' | 'active' | 'unavailable'

export function SignedOutPage() {
  const [result, setResult] = useState<Result>('checking')
  const generation = useRef(0)

  const check = useCallback(async () => {
    const current = ++generation.current
    setResult('checking')
    let token: string | null
    try {
      token = readToken(window.localStorage)
    } catch {
      setResult('unavailable')
      return
    }
    const finishSignedOut = () => {
      if (generation.current !== current || readToken(window.localStorage) !== null) return
      setResult('signed-out')
    }
    if (token === null) {
      try {
        finishSignedOut()
      } catch {
        setResult('unavailable')
      }
      return
    }
    try {
      await instance({
        url: '/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        alert: false,
      })
      if (generation.current !== current) return
      if (readToken(window.localStorage) !== token) {
        setResult('unavailable')
        return
      }
      setResult('active')
    } catch (error) {
      if (generation.current !== current) return
      if (error instanceof ExAxiosError && error.code === 'SESSION_INVALID') {
        try {
          if (readToken(window.localStorage) !== token) {
            setResult('unavailable')
            return
          }
          removeMatchingToken(window.localStorage, token)
          finishSignedOut()
        } catch {
          setResult('unavailable')
        }
      } else {
        setResult('unavailable')
      }
    }
  }, [])

  useEffect(() => {
    void check()
    const unsubscribe = subscribeSessionChanges(() => {
      void check()
    })
    return () => {
      generation.current += 1
      unsubscribe()
    }
  }, [check])

  return (
    <main>
      {result !== 'checking' && <h1>退出登录确认</h1>}
      {result === 'checking' && (
        <PageAsyncBoundary
          loading
          as="div"
          pageLayout="standalone"
          loadingTitle="正在确认登录状态"
          loadingDescription="正在核验当前浏览器会话，请稍候。"
        />
      )}
      <section
        className={result === 'checking' ? undefined : styles.status}
        role={result === 'unavailable' ? 'alert' : 'status'}
        aria-label="退出登录结果"
      >
        {result !== 'checking' && (
          <>
            {result === 'unavailable' ? (
              <CircleAlert aria-hidden="true" />
            ) : result === 'signed-out' ? (
              <CircleCheck aria-hidden="true" />
            ) : (
              <Info aria-hidden="true" />
            )}
            <h2>
              {result === 'signed-out'
                ? '已退出登录'
                : result === 'active'
                  ? '网站会话仍有效'
                  : '暂时无法确认登录状态'}
            </h2>
            <p>
              {result === 'signed-out'
                ? '当前浏览器已退出登录。'
                : result === 'active'
                  ? '当前浏览器有有效的网站登录会话。'
                  : '暂时无法确认登录状态，请稍后重试。'}
            </p>
            {result === 'unavailable' && (
              <Button type="button" onClick={() => void check()}>
                重试
              </Button>
            )}
          </>
        )}
      </section>
      {result !== 'checking' && <Link to="/">返回网站首页</Link>}
    </main>
  )
}
