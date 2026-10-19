import { Link, useLocation, useSearchParams } from 'react-router'
import { Alert, AlertDescription, Button, Card } from '@exre/exui'
import { ArrowLeftIcon } from 'lucide-react'
import { AuthFlow } from '@web/src/auth/AuthFlow'
import { AuthBackdrop } from '@web/src/pages/AuthPage/AuthBackdrop'
import styles from '@web/src/pages/AuthPage/AuthPage.module.scss'

export function AuthPage({ mode }: { mode: 'login' }) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const values = searchParams.getAll('ssoRequestId')
  const hasSsoParameter = searchParams.has('ssoRequestId')
  const ssoRequestId =
    values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0] ?? '') ? values[0] : undefined
  const invalidSso = hasSsoParameter && ssoRequestId === undefined
  const initialEmail = (location.state as { email?: unknown } | null)?.email
  const legal = (
    <p className={styles.legal}>
      By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.
    </p>
  )

  return (
    <main className={styles.page} data-page="auth">
      <AuthBackdrop />
      {!hasSsoParameter && (
        <Button asChild variant="ghost" className={styles.homeLink}>
          <Link to="/">
            <ArrowLeftIcon aria-hidden="true" /> Home
          </Link>
        </Button>
      )}
      <Card glass className={styles.panel} data-auth-mode={mode}>
        {invalidSso ? (
          <>
            <Alert variant="destructive" role="alert">
              <AlertDescription>登录入口无效，请从发起应用重新登录。</AlertDescription>
            </Alert>
            {legal}
          </>
        ) : (
          <AuthFlow
            key={`${mode}:${ssoRequestId ?? 'local'}:${typeof initialEmail === 'string' ? initialEmail : ''}`}
            initialMode={mode}
            initialEmail={typeof initialEmail === 'string' ? initialEmail : ''}
            presentation="page"
            ssoRequestId={ssoRequestId}
            footer={legal}
          />
        )}
      </Card>
    </main>
  )
}
