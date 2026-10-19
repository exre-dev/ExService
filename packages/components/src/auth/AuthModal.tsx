import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@exre/exui'
import type { AuthMode } from '@components/src/auth/AuthForm'
import styles from '@components/src/auth/AuthModal.module.scss'

export interface AuthModalProps {
  open: boolean
  mode: AuthMode
  onOpenChange: (open: boolean) => void
  children: ReactNode
  onCloseAutoFocus?: (event: Event) => void
}

export function AuthModal({
  open,
  mode,
  onOpenChange,
  children,
  onCloseAutoFocus,
}: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader className={styles.hiddenHeader}>
          <DialogTitle>{mode === 'login' ? '登录' : '注册'}</DialogTitle>
          <DialogDescription>完成 Exre 账号认证。</DialogDescription>
        </DialogHeader>
        {children}
        <p className={styles.legal}>
          By signing up, you agree to our Terms, Acceptable Use, and Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>
  )
}
