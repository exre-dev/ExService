import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Alert, AlertDescription, Button, Card } from '@exre/exui'
import { instance, ExAxiosError } from '@workspace/sdk'
import { AuthFlow } from '@web/src/auth/AuthFlow'
import { readToken, removeMatchingToken, sessionScopeRevision } from '@web/src/auth/storage'
import { AuthBackdrop } from '@web/src/pages/AuthPage/AuthBackdrop'
import styles from '@web/src/pages/AuthPage/AuthPage.module.scss'
import identityStyles from './OidcPage.module.scss'
import { OidcSharingDialog } from './OidcSharingDialog'

type Phase = 'login' | 'consent' | 'logout'
type ClientInfo = { clientName: string; scopes: string[] }
type Stage =
  'checking' | 'login-required' | 'restart' | 'retry-inspect' | 'retry-accept' | 'invalid'

function inspectOidc(phase: 'login' | 'consent', challenge: string) {
  return instance({
    url: '/auth/oidc/inspect',
    method: 'POST',
    data: { phase, challenge },
    alert: false,
  })
}

function acceptOidc(phase: Phase, challenge: string, token: string) {
  const request = {
    data: { challenge },
    headers: { Authorization: `Bearer ${token}` },
    alert: false,
  }
  if (phase === 'login')
    return instance({ url: '/auth/oidc/login/accept', method: 'POST', ...request })
  if (phase === 'consent')
    return instance({ url: '/auth/oidc/consent/accept', method: 'POST', ...request })
  return instance({ url: '/auth/oidc/logout/accept', method: 'POST', ...request })
}

function challengeFromSearch(search: string, phase: Phase): string | null {
  const params = new URLSearchParams(search)
  const key = `${phase}_challenge`
  const values = params.getAll(key)
  if (values.length !== 1 || Array.from(params.keys()).some((name) => name !== key)) return null
  const challenge = values[0]
  return challenge &&
    challenge.length <= 8192 &&
    !/\s/u.test(challenge) &&
    !/[\u0000-\u001f\u007f]/u.test(challenge)
    ? challenge
    : null
}

function currentToken(): string | null {
  try {
    return readToken(window.localStorage)
  } catch {
    return null
  }
}

function redirectToHydra(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    window.location.replace(url.href)
    return true
  } catch {
    return false
  }
}

/** Completes one approved Hydra challenge through the generated Website client. */
export function OidcPage({ phase }: { phase: Phase }) {
  const location = useLocation()
  return (
    <OidcChallenge key={`${phase}:${location.search}`} phase={phase} search={location.search} />
  )
}

function OidcChallenge({ phase, search }: { phase: Phase; search: string }) {
  const navigate = useNavigate()
  const challenge = challengeFromSearch(search, phase)
  const [token, setToken] = useState(currentToken)
  const [info, setInfo] = useState<ClientInfo | null>(null)
  const [stage, setStage] = useState<Stage>('checking')
  const [attempt, setAttempt] = useState(0)
  const inspectRequest = useRef<{ key: string; promise: ReturnType<typeof inspectOidc> } | null>(
    null,
  )
  const acceptRequest = useRef<{ key: string; promise: ReturnType<typeof acceptOidc> } | null>(null)
  // A challenge belongs to the API scope where this page was mounted.
  const scope = useRef(sessionScopeRevision()).current
  const ownsScope = () => scope === sessionScopeRevision()

  useEffect(() => {
    if (!ownsScope() || challenge === null || phase === 'logout') return
    let active = true
    const key = `${phase}:${challenge}`
    if (inspectRequest.current?.key !== key) {
      inspectRequest.current = {
        key,
        promise: inspectOidc(phase, challenge),
      }
    }
    void inspectRequest.current.promise
      .then((result) => {
        if (!active || !ownsScope()) return
        setInfo(result)
        setStage('checking')
      })
      .catch((error) => {
        if (active && ownsScope())
          setStage(
            error instanceof ExAxiosError && (error.status === 400 || error.status === 403)
              ? 'invalid'
              : 'retry-inspect',
          )
      })
    return () => {
      active = false
    }
  }, [challenge, phase, attempt])

  useEffect(() => {
    if (
      !ownsScope() ||
      challenge === null ||
      (phase !== 'logout' && info === null) ||
      stage === 'invalid' ||
      stage === 'restart' ||
      stage === 'retry-inspect' ||
      stage === 'retry-accept'
    )
      return
    if (token === null) {
      if (phase === 'logout') {
        navigate('/identity/signed-out', { replace: true })
      } else {
        setStage(phase === 'login' ? 'login-required' : 'restart')
      }
      return
    }
    let active = true
    const key = `${phase}:${challenge}:${token}`
    if (acceptRequest.current?.key !== key) {
      acceptRequest.current = {
        key,
        promise: acceptOidc(phase, challenge, token),
      }
    }
    void acceptRequest.current.promise
      .then((result) => {
        if (!active || !ownsScope()) return
        const latestToken = currentToken()
        if (latestToken !== token) {
          setToken(latestToken)
          setStage('restart')
          return
        }
        if (phase === 'logout') removeMatchingToken(window.localStorage, token)
        if (!redirectToHydra(result.redirectUrl)) setStage('invalid')
      })
      .catch((error) => {
        if (!active || !ownsScope()) return
        const latestToken = currentToken()
        if (latestToken !== null && latestToken !== token) {
          setToken(latestToken)
          setStage('restart')
          return
        }
        if (
          error instanceof ExAxiosError &&
          (error.status === 401 || error.code === 'SESSION_INVALID')
        ) {
          if (phase === 'logout') {
            navigate('/identity/signed-out', { replace: true })
            return
          }
          if (latestToken === token) removeMatchingToken(window.localStorage, token)
          setToken(null)
          setStage(phase === 'login' ? 'login-required' : 'restart')
          return
        }
        setStage(
          error instanceof ExAxiosError && (error.status === 400 || error.status === 403)
            ? 'invalid'
            : error instanceof ExAxiosError && error.status === 409
              ? 'restart'
              : 'retry-accept',
        )
      })
    return () => {
      active = false
    }
  }, [challenge, phase, info, token, attempt, navigate, stage])

  const retry = () => {
    if (stage === 'retry-inspect') inspectRequest.current = null
    else acceptRequest.current = null
    setStage('checking')
    setAttempt((value) => value + 1)
  }

  const loginRequired = challenge !== null && stage === 'login-required' && phase === 'login'
  const serviceName = info?.clientName ?? '应用'

  return (
    <main className={styles.page} data-page="identity">
      <AuthBackdrop />
      <Card glass className={styles.panel} data-auth-mode={loginRequired ? 'login' : undefined}>
        {!loginRequired && (
          <h1 className={identityStyles.statusTitle}>
            {phase === 'logout' ? '退出应用' : '继续登录应用'}
          </h1>
        )}
        {challenge === null || stage === 'invalid' ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>身份入口无效，请从应用重新进入。</AlertDescription>
          </Alert>
        ) : stage === 'login-required' && phase === 'login' ? (
          <AuthFlow
            presentation="page"
            onSessionCreated={(value) => {
              setStage('checking')
              setToken(value)
            }}
            description={
              <>
                使用 Exre 账号，继续访问 <strong>{serviceName}</strong>
              </>
            }
          />
        ) : stage === 'restart' ? (
          <p role="alert">此登录流程已失效，请重新从应用发起登录。</p>
        ) : stage === 'retry-inspect' || stage === 'retry-accept' ? (
          <div className={identityStyles.retryState}>
            <p role="alert">暂时无法连接身份服务，请重试。</p>
            <Button type="button" onClick={retry}>
              重试
            </Button>
          </div>
        ) : (
          <p role="status">正在处理身份请求…</p>
        )}
        {info !== null && stage !== 'invalid' && phase !== 'logout' && (
          <OidcSharingDialog serviceName={serviceName} scopes={info.scopes} />
        )}
      </Card>
    </main>
  )
}
