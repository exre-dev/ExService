import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { Button, toast } from '@exre/exui'
import {
  InvitationEmailForm,
  InvitationCodeForm,
  InvitationProfileForm,
  invitationEmailSchema,
  type InvitationFormHandle,
  type InvitationFormErrors,
  type InvitationProfileValues,
} from '@workspace/components'
import type { components } from '@workspace/sdk/types'
import { instance, ExAxiosError } from '@workspace/sdk'
import { sessionScopeRevision, subscribeSessionChanges } from '@web/src/auth/storage'

interface Props {
  presentation: 'page' | 'modal'
  initialEmail?: string
  onLogin?: (email: string) => void
  onJoin?: () => void
}
type Verified = components['schemas']['AccountInvitationVerifyData']
type FormStep = 'email' | 'code' | 'profile'
type Step = FormStep | 'registered'
interface PendingFeedback {
  targetStep: FormStep
  generation: number
  errors: InvitationFormErrors
}

function readEntry(presentation: Props['presentation'], initialEmail: string) {
  if (presentation === 'modal' || typeof window === 'undefined')
    return { email: initialEmail, code: null as string | null, error: false }
  const params = new URLSearchParams(window.location.search)
  const emails = params.getAll('email'),
    codes = params.getAll('code')
  const email = invitationEmailSchema.safeParse(emails[0] ?? '')
  const invalid =
    emails.length > 1 ||
    codes.length > 1 ||
    (emails.length === 1 && !email.success) ||
    (codes.length > 0 && (emails.length !== 1 || !email.success || !/^[0-9]{6}$/.test(codes[0]!)))
  return {
    email: email.success && emails.length === 1 ? email.data : initialEmail,
    code: !invalid && codes.length === 1 ? codes[0]! : null,
    error: invalid,
  }
}

export function InvitationRegistrationFlow(props: Props) {
  const scope = useSyncExternalStore(
    subscribeSessionChanges,
    sessionScopeRevision,
    sessionScopeRevision,
  )
  // A different API root needs fresh RHF owners as well as fresh request guards.
  return <InvitationScopeFlow key={scope} {...props} scope={scope} />
}

function InvitationScopeFlow({
  presentation,
  initialEmail = '',
  onLogin,
  onJoin,
  scope,
}: Props & { scope: number }) {
  const navigate = useNavigate()
  const entry = useRef<ReturnType<typeof readEntry> | null>(null)
  if (entry.current === null) entry.current = readEntry(presentation, initialEmail)
  const [email, setEmail] = useState(entry.current.email)
  const [step, setStep] = useState<Step>('email')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(false)
  const [nickname, setNickname] = useState('')
  const [resendUntil, setResendUntil] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const generation = useRef(0),
    mounted = useRef(false),
    pending = useRef(false)
  const grant = useRef<Verified | null>(null)
  const emailForm = useRef<InvitationFormHandle>(null)
  const codeForm = useRef<InvitationFormHandle>(null)
  const profileForm = useRef<InvitationFormHandle>(null)
  const activeStep = useRef<Step>('email')
  const pendingFeedback = useRef<PendingFeedback | null>(null)
  const timer = useRef<number | null>(null),
    finished = useRef(false)
  const autoChain = useRef<ReturnType<typeof runAutomatic> | null>(null)

  const ownsScope = () => scope === sessionScopeRevision()
  const valid = (current: number) =>
    mounted.current && current === generation.current && ownsScope()
  function formFor(targetStep: Step) {
    return targetStep === 'email'
      ? emailForm.current
      : targetStep === 'code'
        ? codeForm.current
        : targetStep === 'profile'
          ? profileForm.current
          : null
  }
  function clearFeedback() {
    pendingFeedback.current = null
    formFor(activeStep.current)?.clearServerErrors()
  }
  function deliverError(targetStep: FormStep, current: number, errors: InvitationFormErrors) {
    if (!valid(current)) return
    const target = formFor(targetStep)
    if (activeStep.current === targetStep && target !== null) {
      pendingFeedback.current = null
      target.setServerErrors(errors)
    } else pendingFeedback.current = { targetStep, generation: current, errors }
  }
  function cooldown(data: { serverTime: number; resendAvailableAt: number }) {
    const now = Date.now(),
      delay = Math.max(0, data.resendAvailableAt - data.serverTime) * 1000
    setClock(now)
    setResendUntil(delay === 0 ? 0 : now + delay)
  }
  function checkFailure(current: number, error: unknown) {
    const status = error instanceof ExAxiosError ? error.status : undefined
    const wait = retrySeconds(error)
    const form =
      status === 429
        ? wait > 0
          ? `检查失败，请在 ${wait} 秒后重试`
          : '检查失败，请稍后重试'
        : error instanceof ExAxiosError
          ? error.message
          : '检查失败，请重试'
    const formKind = status === 429 ? 'rate-limited' : 'check-failed'
    deliverError('email', current, { form, formKind })
  }
  function verifyFailure(current: number, error: unknown) {
    const message =
      error instanceof ExAxiosError && error.status === 429
        ? '验证暂时锁定，请稍后重试'
        : '验证码无效或已过期，请重新获取'
    const retryAfter = retrySeconds(error)
    setRetry(true)
    if (retryAfter > 0) {
      const now = Date.now()
      setClock(now)
      setLockedUntil(now + retryAfter * 1000)
    }
    deliverError('code', current, {
      form: error instanceof ExAxiosError ? error.message : message,
      formKind: 'check-failed',
    })
  }
  function accepted(data: Verified) {
    clearFeedback()
    grant.current = data
    setEmail(data.email)
    setNickname(data.nickname)
    setRetry(false)
    setStep('profile')
  }
  async function runAutomatic(current: number, targetEmail: string, code: string) {
    if (!valid(current)) return null
    let inspected
    try {
      const { data } = await instance({
        url: '/api/auth/invitations/check',
        method: 'POST',
        data: { email: targetEmail },
        alert: false,
      })
      inspected = data
    } catch (error) {
      return { stage: 'checkFailure' as const, error }
    }
    if (!valid(current)) return null
    try {
      const { data: result } = await instance({
        url: '/api/auth/invitations/verify',
        method: 'POST',
        data: { email: inspected.email, code },
        alert: false,
      })
      return { stage: 'verify' as const, result, eligibility: inspected }
    } catch (error) {
      return { stage: 'verifyFailure' as const, error, eligibility: inspected }
    }
  }
  useEffect(() => {
    mounted.current = true
    let subscribed = true
    const current = generation.current
    if (entry.current!.error) {
      entry.current!.error = false
      deliverError('email', current, {
        form: '注册入口参数无效，请重新填写邮箱',
        formKind: 'entry-invalid',
      })
    }
    if (presentation === 'page') {
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }
    if (entry.current!.code !== null && autoChain.current === null) {
      const code = entry.current!.code
      entry.current!.code = null
      pending.current = true
      setBusy(true)
      autoChain.current = runAutomatic(current, entry.current!.email, code)
    }
    if (autoChain.current !== null)
      void autoChain.current.then((outcome) => {
        if (!subscribed || !valid(current) || outcome === null) return
        pending.current = false
        setBusy(false)
        autoChain.current = null
        if (outcome.stage === 'checkFailure') {
          checkFailure(current, outcome.error)
          return
        }
        cooldown(outcome.eligibility)
        setEmail(outcome.eligibility.email)
        if (outcome.stage === 'verify') {
          accepted(outcome.result)
          return
        }
        setStep('code')
        verifyFailure(current, outcome.error)
      })
    const interval = window.setInterval(() => setClock(Date.now()), 1000)
    return () => {
      subscribed = false
      mounted.current = false
      window.clearInterval(interval)
      if (timer.current !== null) window.clearTimeout(timer.current)
      // StrictMode immediately re-subscribes; real unmount invalidates the flow.
      queueMicrotask(() => {
        if (!mounted.current) {
          generation.current++
          pendingFeedback.current = null
          grant.current = null
          entry.current!.code = null
          autoChain.current = null
        }
      })
    }
  }, [])

  function invalidate() {
    clearFeedback()
    generation.current++
    pending.current = false
    grant.current = null
    autoChain.current = null
    entry.current!.code = null
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setBusy(false)
    setRetry(false)
  }
  function back() {
    invalidate()
    setNickname('')
    setLockedUntil(0)
    setResendUntil(0)
    setStep('email')
  }
  async function check(targetEmail: string) {
    if (!ownsScope() || pending.current) return
    const current = ++generation.current
    pending.current = true
    setBusy(true)
    setEmail(targetEmail)
    clearFeedback()
    try {
      const { data: result } = await instance({
        url: '/api/auth/invitations/check',
        method: 'POST',
        data: { email: targetEmail },
        alert: false,
      })
      if (!valid(current)) return
      cooldown(result)
      setEmail(result.email)
      setStep('code')
    } catch (error) {
      if (valid(current)) checkFailure(current, error)
    } finally {
      if (valid(current)) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  async function verify(code: string) {
    if (!ownsScope() || pending.current || Date.now() < lockedUntil) return
    const current = generation.current
    pending.current = true
    setBusy(true)
    setRetry(false)
    clearFeedback()
    try {
      const { data: result } = await instance({
        url: '/api/auth/invitations/verify',
        method: 'POST',
        data: { email, code },
        alert: false,
      })
      if (!valid(current)) return
      accepted(result)
    } catch (error) {
      if (valid(current)) verifyFailure(current, error)
    } finally {
      if (valid(current)) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  async function resend() {
    if (!ownsScope() || pending.current || Date.now() < lockedUntil || Date.now() < resendUntil)
      return false
    const current = generation.current
    pending.current = true
    setBusy(true)
    clearFeedback()
    try {
      const { data: result } = await instance({
        url: '/api/auth/invitations/code',
        method: 'POST',
        data: { email },
        alert: false,
      })
      if (!valid(current)) return false
      cooldown(result)
      setRetry(false)
      toast.info('如邮箱符合邀请条件，将发送验证码')
      return true
    } catch {
      if (valid(current))
        deliverError('code', current, { form: '发送失败，请重试', formKind: 'send-failed' })
      return false
    } finally {
      if (valid(current)) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  function login() {
    if (!ownsScope() || finished.current) return
    finished.current = true
    invalidate()
    if (presentation === 'page') navigate('/login', { replace: true, state: { email } })
    else onLogin?.(email)
  }
  async function complete(values: InvitationProfileValues) {
    if (!ownsScope() || pending.current || grant.current === null) return
    const current = generation.current,
      completionToken = grant.current.completionToken
    pending.current = true
    setBusy(true)
    clearFeedback()
    try {
      await instance({
        url: '/api/auth/invitations/complete',
        method: 'POST',
        data: { completionToken, ...values },
        alert: false,
      })
      if (!valid(current)) return
      clearFeedback()
      grant.current = null
      setNickname('')
      setStep('registered')
      toast.info('注册成功，请前往登录')
    } catch (error) {
      if (valid(current)) {
        deliverError('profile', current, {
          form: error instanceof ExAxiosError ? error.message : '注册失败，请重试',
          formKind: 'complete-failed',
        })
      }
    } finally {
      if (valid(current)) {
        pending.current = false
        setBusy(false)
      }
    }
  }
  useEffect(() => {
    if (step !== 'registered') return
    timer.current = window.setTimeout(login, 1500)
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [step])
  useEffect(() => {
    activeStep.current = step
    const feedback = pendingFeedback.current
    if (!feedback) return
    if (!valid(feedback.generation)) {
      pendingFeedback.current = null
      return
    }
    const target = formFor(step)
    if (feedback.targetStep !== step || target === null) return
    pendingFeedback.current = null
    target.setServerErrors(feedback.errors)
  }, [step])
  const join = () => {
    if (!ownsScope()) return
    invalidate()
    if (onJoin) onJoin()
    else navigate('/communities/rifling-911')
  }
  return (
    <>
      {step === 'email' && (
        <InvitationEmailForm
          ref={emailForm}
          initialEmail={email}
          busy={busy}
          onSubmit={check}
          onEmailChange={invalidate}
          onLogin={login}
          onJoin={join}
        />
      )}
      {step === 'code' && (
        <InvitationCodeForm
          ref={codeForm}
          email={email}
          busy={busy}
          retry={retry}
          resendSeconds={Math.max(0, Math.ceil((resendUntil - clock) / 1000))}
          lockedSeconds={Math.max(0, Math.ceil((lockedUntil - clock) / 1000))}
          onVerify={verify}
          onResend={resend}
          onBack={back}
        />
      )}
      {step === 'profile' && (
        <InvitationProfileForm
          ref={profileForm}
          email={email}
          nickname={nickname}
          busy={busy}
          onSubmit={complete}
          onBack={back}
        />
      )}
      {step === 'registered' && (
        <section aria-live="polite">
          <h2>注册成功</h2>
          <p>账号已创建，即将前往登录。</p>
          <Button onClick={login}>前往登录</Button>
        </section>
      )}
    </>
  )
}

function retrySeconds(error: unknown) {
  return error instanceof ExAxiosError &&
    error.retryAfterSeconds !== undefined &&
    Number.isFinite(error.retryAfterSeconds) &&
    error.retryAfterSeconds > 0
    ? error.retryAfterSeconds
    : 0
}
