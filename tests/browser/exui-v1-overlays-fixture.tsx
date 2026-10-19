// Isolated browser acceptance only: synthetic labels and local callbacks, no account or API.
import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import {
  ExMessage,
  ExMessageContext,
  GlassSeed,
  ThemeProvider,
  type ExMessageLoadingHandle,
} from '@exre/exui'
import { AuthModal } from '@components/src/auth/AuthModal'
import { AuthForm } from '@components/src/auth/AuthForm'
import {
  InvitationEmailForm,
  InvitationCodeForm,
  InvitationProfileForm,
} from '@components/src/auth/InvitationForms'
import { CompleteJoinApplicationModal } from '@components/src/join/CompleteJoinApplicationModal'
import { JoinReviewDialog } from '@components/src/join/JoinReviewDialog'
import { OidcSharingDialog } from '@web/src/pages/IdentityPage/OidcSharingDialog'
import '@exre/exui/style.css'
import '@web/src/styles/website-theme.css'
import '@web/src/styles/index.scss'

document.documentElement.classList.add('website-theme-profile')
const mode = new URLSearchParams(location.search).get('mode') ?? 'login'
const paragraphs = Array.from({ length: 24 }, (_, index) => (
  <p key={index}>隔离测试资料段落 {index + 1}：检查正文滚动和底部操作。</p>
))

function AuthFixture() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [submissions, setSubmissions] = useState(0)
  const content =
    mode === 'captcha' ? (
      <AuthForm
        step="captcha"
        busy={false}
        onCaptchaSubmit={() => setSubmissions((n) => n + 1)}
        onContinueLogin={() => undefined}
        onJoin={() => undefined}
      />
    ) : mode === 'invitation-email' ? (
      <InvitationEmailForm
        initialEmail=""
        busy={false}
        onSubmit={async () => setSubmissions((n) => n + 1)}
        onEmailChange={() => undefined}
        onLogin={() => undefined}
        onJoin={() => undefined}
      />
    ) : mode === 'invitation-code' ? (
      <InvitationCodeForm
        email="fixture@example.test"
        busy={false}
        retry={false}
        resendSeconds={0}
        lockedSeconds={0}
        onVerify={async () => setSubmissions((n) => n + 1)}
        onResend={async () => true}
        onBack={() => undefined}
      />
    ) : mode === 'invitation-profile' ? (
      <InvitationProfileForm
        email="fixture@example.test"
        nickname=""
        busy={false}
        onSubmit={async () => setSubmissions((n) => n + 1)}
        onBack={() => undefined}
      />
    ) : (
      <AuthForm
        step="credentials"
        busy={false}
        onContinueLogin={() => setSubmissions((n) => n + 1)}
        onCaptchaSubmit={() => undefined}
        onJoin={() => undefined}
      />
    )
  return (
    <main style={{ padding: '2rem' }}>
      <button ref={trigger} onClick={() => setOpen(true)}>
        打开测试认证弹窗
      </button>
      <button>外部焦点</button>
      <output data-submissions={submissions}>{submissions}</output>
      <AuthModal
        open={open}
        mode={mode.startsWith('invitation') ? 'register' : 'login'}
        onOpenChange={setOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          trigger.current?.focus()
        }}
      >
        {content}
      </AuthModal>
    </main>
  )
}

function OidcFixture() {
  return (
    <main style={{ padding: '2rem' }}>
      <button>外部焦点</button>
      <OidcSharingDialog
        serviceName="隔离测试应用"
        scopes={['openid', 'profile', 'email', 'fixture:extra']}
      />
    </main>
  )
}

function JoinFixture() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [tab, setTab] = useState<'application' | 'review'>('application')
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <main style={{ padding: '2rem' }}>
      <button ref={trigger} onClick={() => setOpen(true)}>
        打开测试申请弹窗
      </button>
      <button>外部焦点</button>
      {mode === 'join-review' ? (
        <JoinReviewDialog
          open={open}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setOpen(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
          loading={false}
          error={null}
          application={<div>{paragraphs}</div>}
          review={<div>{paragraphs}</div>}
          actions={<button type="button">测试操作</button>}
          onRetry={() => undefined}
        />
      ) : (
        <CompleteJoinApplicationModal
          open={open}
          applicationType="new"
          step={step}
          busy={false}
          onStepChange={setStep}
          onOpenChange={setOpen}
          onSubmit={async () => undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        />
      )}
    </main>
  )
}

function MessageFixture() {
  const handle = useRef<ExMessageLoadingHandle | null>(null)
  const [transition, setTransition] = useState('idle')
  return (
    <main style={{ padding: '10rem 2rem 2rem' }}>
      <button
        onClick={() => {
          ExMessage.success('普通成功消息', { duration: 10000 })
          setTransition('ordinary-success')
        }}
      >
        普通成功
      </button>
      <button
        onClick={() => {
          handle.current = ExMessage.loading('隔离任务进行中', { duration: 10000 })
          setTransition('loading')
        }}
      >
        开始任务
      </button>
      <button
        onClick={() => {
          handle.current?.onSuccess('隔离任务完成', { duration: 10000 })
          handle.current = null
          setTransition('success')
        }}
      >
        完成任务
      </button>
      <button
        onClick={() => {
          handle.current?.onError('隔离任务失败', { duration: 10000 })
          handle.current = null
          setTransition('error')
        }}
      >
        任务失败
      </button>
      <button
        onClick={() => {
          handle.current?.dismiss()
          handle.current = null
          setTransition('dismissed')
        }}
      >
        取消任务
      </button>
      <output data-message-transition={transition} hidden>
        {transition}
      </output>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <GlassSeed />
      <ExMessageContext />
      <BrowserRouter>
        {mode === 'oidc' ? (
          <OidcFixture />
        ) : mode.startsWith('join-') ? (
          <JoinFixture />
        ) : mode === 'message' ? (
          <MessageFixture />
        ) : (
          <AuthFixture />
        )}
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
