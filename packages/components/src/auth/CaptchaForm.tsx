import { forwardRef, useId, useImperativeHandle } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
} from '@exre/exui'
import type { AuthFormHandle, AuthFormProps } from '@components/src/auth/AuthForm'
import { ExIcon } from '@components/src/ExIcon'
import styles from '@components/src/auth/AuthForm.module.scss'

const captchaSchema = z.object({
  answer: z.string().max(64, '验证码不能超过 64 个字符'),
})

type CaptchaFields = z.infer<typeof captchaSchema>

export const CaptchaForm = forwardRef<AuthFormHandle, AuthFormProps>(function CaptchaForm(
  { busy, onCaptchaSubmit, description },
  ref,
) {
  const id = useId()
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<CaptchaFields>({
    resolver: zodResolver(captchaSchema),
    defaultValues: { answer: '' },
  })
  const disabled = busy || isSubmitting

  useImperativeHandle(
    ref,
    () => ({
      setServerErrors(nextErrors) {
        if (nextErrors.captcha) setError('answer', { type: 'server', message: nextErrors.captcha })
        const message =
          nextErrors.form ??
          nextErrors.email ??
          nextErrors.nickname ??
          nextErrors.password ??
          nextErrors.code
        if (message) setError('root.server', { type: 'server', message })
      },
      clearServerErrors() {
        if (getFieldState('answer').error?.type === 'server') clearErrors('answer')
        clearErrors('root.server')
      },
    }),
    [setError, clearErrors, getFieldState],
  )

  return (
    <form
      className={`${styles.form} ${styles.loginForm}`}
      data-auth-step="captcha"
      noValidate
      aria-busy={disabled}
      onSubmit={handleSubmit(async ({ answer }) => {
        if (!busy) await onCaptchaSubmit(answer)
      })}
    >
      <div className={`${styles.intro} ${styles.loginIntro}`}>
        <ExIcon size="6rem" className={styles.authIcon} />
        <h2 tabIndex={-1}>输入验证码</h2>
        {description && <p className={styles.destination}>{description}</p>}
      </div>
      {errors.root?.server && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errors.root.server.message}</AlertDescription>
        </Alert>
      )}
      <Field data-invalid={errors.answer ? true : undefined}>
        <FieldContent>
          <FieldLabel htmlFor={`${id}-answer`}>图片验证码</FieldLabel>
          <div className={styles.captchaRow}>
            <Input
              {...register('answer')}
              id={`${id}-answer`}
              autoComplete="off"
              autoFocus
              disabled={disabled}
              maxLength={64}
              aria-invalid={errors.answer ? true : undefined}
              aria-describedby={errors.answer ? `${id}-answer-error` : `${id}-notice`}
            />
            <div className={styles.captchaImage} role="img" aria-label="验证码图片占位区域">
              验证码图片预留区域
            </div>
          </div>
          {errors.answer && (
            <FieldError id={`${id}-answer-error`}>{errors.answer.message}</FieldError>
          )}
        </FieldContent>
      </Field>
      <p className={styles.captchaNotice} id={`${id}-notice`}>
        验证码功能开发中，当前输入不校验；留空也可继续。
      </p>
      <Button type="submit" disabled={disabled} className={styles.submit}>
        {disabled ? (
          <>
            <Spinner aria-hidden="true" />
            处理中
          </>
        ) : (
          '登录'
        )}
      </Button>
    </form>
  )
})
