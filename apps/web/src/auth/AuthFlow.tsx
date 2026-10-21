import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription, Button } from '@exre/exui'
import {
  AuthForm,
  type AuthFormHandle,
  type AuthFormErrors,
  type LoginDraft,
} from '@workspace/components'
import { instance, ExAxiosError } from '@workspace/sdk'
import {
  readRawToken,
  readToken,
  sessionScopeRevision,
  writeSsoSuccess,
  writeToken,
} from '@web/src/auth/storage'

export interface AuthFlowProps {
  initialMode?: 'login'
  initialEmail?: string
  presentation: 'modal' | 'page'
  ssoRequestId?: string
  onJoin?: () => void
  onFinished?: () => void
  onSessionCreated?: (token: string) => void
  footer?: ReactNode
  description?: ReactNode
}

export function AuthFlow({
  initialEmail = '',
  presentation,
  ssoRequestId,
  onJoin,
  onFinished,
  onSessionCreated,
  footer,
  description,
}: AuthFlowProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<'credentials' | 'captcha'>('credentials')
  const [flowBusy, setFlowBusy] = useState(ssoRequestId !== undefined)
  const [email, setEmail] = useState(initialEmail)
  const [fatalSsoError, setFatalSsoError] = useState<string | null>(null)
  const [ssoRetryError, setSsoRetryError] = useState<string | null>(null)
  const generation = useRef(0)
  const authForm = useRef<AuthFormHandle>(null)
  const pendingDraft = useRef<LoginDraft | null>(null)
  const scope = useRef(sessionScopeRevision()).current
  const ownsScope = () => scope === sessionScopeRevision()

  useEffect(
    () => () => {
      generation.current += 1
      pendingDraft.current = null
    },
    [],
  )

  function continueLogin(draft: LoginDraft) {
    pendingDraft.current = draft
    setEmail(draft.email)
    setStep('captcha')
  }

  async function submitCaptcha(_answer: string) {
    const draft = pendingDraft.current
    if (draft === null) return
    await submitLogin(draft)
  }

  useEffect(() => {
    if (ssoRequestId === undefined) {
      setFlowBusy(false)
      return
    }
    const current = ++generation.current
    void prepareSso(ssoRequestId, current)
  }, [ssoRequestId])

  async function prepareSso(requestId: string, current: number) {
    if (!ownsScope()) return
    const isCurrent = () => current === generation.current && ownsScope()
    setFatalSsoError(null)
    setSsoRetryError(null)
    setFlowBusy(true)
    try {
      const { data: inspection } = await instance({
        url: '/api/auth/sso/inspect',
        method: 'POST',
        data: { ssoRequestId: requestId },
        alert: false,
      })
      if (!isCurrent()) return
      if (inspection.status === 'completed') {
        finishSso(requestId)
        return
      }
      let token: string | null
      try {
        token = readToken(window.localStorage)
      } catch {
        authForm.current?.setServerErrors({ form: '浏览器无法读取登录信息，请使用邮箱和密码继续' })
        setFlowBusy(false)
        return
      }
      if (token === null) {
        setFlowBusy(false)
        return
      }
      await instance({
        url: '/api/auth/sso/confirm',
        method: 'POST',
        data: { ssoRequestId: requestId },
        alert: false,
      })
      if (!isCurrent()) return
      finishSso(requestId)
    } catch (error) {
      if (isCurrent()) {
        if (error instanceof ExAxiosError && error.status === 401) {
          setFlowBusy(false)
          return
        }
        if (
          error instanceof ExAxiosError &&
          ssoRequestId !== undefined &&
          isFatalSsoStatus(error.status)
        )
          setFatalSsoError(error.message)
        else setSsoRetryError('暂时无法连接认证服务，请重试')
        setFlowBusy(false)
      }
    }
  }

  async function submitLogin(draft: LoginDraft) {
    if (!ownsScope()) return
    const current = ++generation.current
    const isCurrent = () => current === generation.current && ownsScope()
    authForm.current?.clearServerErrors()
    try {
      if (ssoRequestId !== undefined) {
        await instance({
          url: '/api/auth/sso/login',
          method: 'POST',
          data: { ssoRequestId, email: draft.email, password: draft.password },
          alert: false,
        })
        if (!isCurrent()) return
        finishSso(ssoRequestId)
        return
      }

      const { data: result } = await instance({
        url: '/api/auth/login',
        method: 'POST',
        data: { email: draft.email, password: draft.password },
        alert: false,
      })
      if (!isCurrent()) return
      let oldToken: string | null
      try {
        oldToken = readRawToken(window.localStorage)
      } catch {
        authForm.current?.setServerErrors({ form: '浏览器无法读取登录信息，请检查存储设置后重试' })
        return
      }
      if (oldToken !== null && oldToken !== result.token) {
        try {
          await instance({
            url: '/api/auth/logout',
            method: 'POST',
            headers: { Authorization: `Bearer ${oldToken}` },
            alert: false,
          })
          if (!isCurrent()) return
        } catch (error) {
          if (!isCurrent()) return
          if (!(error instanceof ExAxiosError && error.status === 401)) {
            authForm.current?.setServerErrors({ form: '旧账号退出失败，请重试登录' })
            return
          }
          // ExAxios may already have removed this expired token; never accept a replacement token.
          if (readRawToken(window.localStorage) === null) oldToken = null
        }
      }
      try {
        if (readRawToken(window.localStorage) !== oldToken) {
          authForm.current?.setServerErrors({ form: '登录状态已在其他页面更改，请重试' })
          return
        }
        writeToken(window.localStorage, result.token)
      } catch {
        authForm.current?.setServerErrors({ form: '浏览器无法保存登录信息，请检查存储设置后重试' })
        return
      }
      if (onSessionCreated) {
        onSessionCreated(result.token)
        return
      }
      onFinished?.()
      if (presentation === 'modal') {
        window.location.reload()
      } else {
        window.location.replace('/')
      }
    } catch (error) {
      if (!isCurrent()) return
      if (error instanceof ExAxiosError) {
        if (ssoRequestId !== undefined && isFatalSsoStatus(error.status))
          setFatalSsoError(error.message)
        else authForm.current?.setServerErrors({ form: error.message || '请求失败，请稍后重试' })
      } else authForm.current?.setServerErrors({ form: '暂时无法连接认证服务，请重试' })
    }
  }

  function join() {
    generation.current += 1
    pendingDraft.current = null
    if (onJoin) onJoin()
    else navigate('/communities/rifling-911')
  }

  function finishSso(requestId: string) {
    try {
      writeSsoSuccess(window.sessionStorage, { ssoRequestId: requestId, confirmedAt: Date.now() })
    } catch {
      authForm.current?.setServerErrors({ form: '浏览器无法保存本次确认结果，请重试' })
      setFlowBusy(false)
      return
    }
    onFinished?.()
    window.location.replace('/sso/success')
  }

  const visibleFooter = step === 'captcha' ? null : footer

  if (fatalSsoError !== null) {
    return (
      <>
        <Alert variant="destructive" role="alert">
          <AlertDescription>{fatalSsoError}</AlertDescription>
        </Alert>
        {visibleFooter}
      </>
    )
  }

  if (ssoRetryError !== null && ssoRequestId !== undefined) {
    return (
      <>
        <Alert variant="destructive" role="alert">
          <AlertDescription>{ssoRetryError}</AlertDescription>
          <Button
            type="button"
            variant="outline"
            onClick={() => void prepareSso(ssoRequestId, ++generation.current)}
          >
            重试
          </Button>
        </Alert>
        {visibleFooter}
      </>
    )
  }

  return (
    <>
      <AuthForm
        ref={authForm}
        step={step}
        busy={flowBusy}
        initialEmail={email}
        description={description}
        onContinueLogin={continueLogin}
        onCaptchaSubmit={submitCaptcha}
        onJoin={join}
      />
      {visibleFooter}
    </>
  )
}

function isFatalSsoStatus(status: number | undefined): boolean {
  return status === 404 || status === 409 || status === 410
}
