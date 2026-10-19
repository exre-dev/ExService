import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@exre/exui'
import {
  AppWindow,
  ChevronDown,
  IdCard,
  Info,
  Mail,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import styles from './OidcPage.module.scss'

const scopeDetails = new Map<string, { title: string; description: string; icon: LucideIcon }>([
  [
    'openid',
    {
      title: '账号身份',
      description: '用于识别你的 Exre 账号，关联应用中的身份。',
      icon: IdCard,
    },
  ],
  [
    'profile',
    {
      title: '基本资料',
      description: '昵称、头像等基本资料，用于在应用中展示你的身份。',
      icon: UserRound,
    },
  ],
  [
    'email',
    {
      title: '邮箱地址',
      description: '与你的 Exre 账号关联的邮箱地址。',
      icon: Mail,
    },
  ],
])

export function OidcSharingDialog({
  serviceName,
  scopes,
}: {
  serviceName: string
  scopes: string[]
}) {
  const requestedScopes = Array.from(new Set(scopes))

  return (
    <div className={styles.sharing}>
      <Dialog>
        <DialogTrigger className={styles.sharingTrigger}>
          {serviceName}将获取哪些信息？
          <Info aria-hidden="true" />
        </DialogTrigger>
        <DialogContent className={styles.sharingDialog} closeLabel="关闭信息说明">
          <DialogHeader className={styles.sharingHeader}>
            <span className={styles.sharingService}>
              <AppWindow aria-hidden="true" />
              {serviceName}
            </span>
            <DialogTitle className={styles.sharingTitle}>登录时共享的信息</DialogTitle>
            <DialogDescription className={styles.sharingDescription}>
              使用 Exre 账号登录后，{serviceName}会获取以下信息。
            </DialogDescription>
          </DialogHeader>
          {requestedScopes.length === 0 ? (
            <p className={styles.sharingDescription}>未请求额外信息。</p>
          ) : (
            <>
              <ul className={styles.permissionList}>
                {requestedScopes.map((scope) => {
                  const detail = scopeDetails.get(scope)
                  const Icon = detail?.icon ?? Info
                  return (
                    <li className={styles.permissionItem} key={scope}>
                      <span className={styles.permissionIcon}>
                        <Icon aria-hidden="true" />
                      </span>
                      <div className={styles.permissionCopy}>
                        <h3>{detail?.title ?? '其他请求信息'}</h3>
                        <p>{detail?.description ?? '该信息项尚无详细说明，请参考下方技术标识。'}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <details className={styles.technicalDetails}>
                <summary>
                  查看技术标识
                  <ChevronDown aria-hidden="true" />
                </summary>
                <div>
                  {requestedScopes.map((scope) => (
                    <code key={scope}>{scope}</code>
                  ))}
                </div>
              </details>
            </>
          )}
          <DialogFooter className={styles.sharingFooter}>
            <DialogClose asChild>
              <Button type="button">知道了</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
