export interface InvitationMail {
  email: string
  registrationUrl: string
  code: string
  invitationExpiresAt: number
  codeExpiresAt: number
  attemptId: string
}
export type InvitationMailer = (mail: InvitationMail) => void | Promise<void>
export function publicWebBaseUrl(value = 'http://localhost:8081'): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('SERVER_PUBLIC_WEB_BASE_URL 必须是完整 HTTP(S) 站点根地址。')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('SERVER_PUBLIC_WEB_BASE_URL 必须是无凭据、query、hash 的 HTTP(S) 站点根地址。')
  }
  return url.origin
}
export const terminalInvitationMailer: InvitationMailer = (mail) => {
  console.info(
    `[server-mail] To: ${mail.email}\n注册链接: ${mail.registrationUrl}\n验证码: ${mail.code}\n验证码截止: ${new Date(mail.codeExpiresAt).toISOString()}\n邀请截止: ${new Date(mail.invitationExpiresAt).toISOString()}\n投递标识: ${mail.attemptId}`,
  )
}
