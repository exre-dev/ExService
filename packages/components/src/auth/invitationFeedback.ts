import type { AuthFormErrors } from '@components/src/auth/AuthForm'
import type { ErrorPanelItem } from '@components/src/ErrorPanel'
import type { GlobalError } from 'react-hook-form'

export type InvitationFormErrorKind =
  | 'entry-invalid'
  | 'application-not-found'
  | 'not-eligible'
  | 'check-failed'
  | 'rate-limited'
  | 'send-failed'
  | 'completion-expired'
  | 'complete-failed'

export interface InvitationFormErrors extends AuthFormErrors {
  formKind?: InvitationFormErrorKind
}
export interface InvitationFormHandle {
  setServerErrors(errors: InvitationFormErrors): void
  clearServerErrors(): void
}

export function invitationFeedback(
  error: GlobalError | undefined,
): { errors: ErrorPanelItem[]; title?: string; join: boolean } | null {
  if (!error?.message) return null
  const applicationMissing = error.type === 'application-not-found'
  return {
    errors: [
      {
        id: 'server',
        message: error.message,
        ...(applicationMissing ? { description: '请先申请加入，获批后再回来注册。' } : {}),
      },
    ],
    ...(applicationMissing ? { title: '暂时无法注册' } : {}),
    join: applicationMissing,
  }
}
