import { forwardRef, type ReactNode } from 'react'
import { LoginForm } from '@components/src/auth/LoginForm'
import { CaptchaForm } from '@components/src/auth/CaptchaForm'

export type AuthMode = 'login' | 'register'
export type AuthStep = 'credentials' | 'captcha'
export interface LoginDraft {
  email: string
  password: string
}
export interface AuthFormErrors {
  email?: string
  nickname?: string
  password?: string
  code?: string
  captcha?: string
  form?: string
}
export interface AuthFormHandle {
  setServerErrors: (errors: AuthFormErrors) => void
  clearServerErrors: () => void
}
export interface AuthFormProps {
  step: AuthStep
  busy: boolean
  initialEmail?: string
  description?: ReactNode
  onContinueLogin: (draft: LoginDraft) => void
  onCaptchaSubmit: (answer: string) => void | Promise<void>
  onJoin: () => void
}

export const AuthForm = forwardRef<AuthFormHandle, AuthFormProps>(function AuthForm(props, ref) {
  return props.step === 'captcha' ? (
    <CaptchaForm {...props} ref={ref} />
  ) : (
    <LoginForm {...props} ref={ref} />
  )
})
