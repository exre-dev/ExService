// Exact host from the supplied ClickUp sharing iframe URLs.
// Content settings cannot extend this policy.
export const clickUpHosts: readonly string[] = Object.freeze(['sharing.clickup.com'])

export function isAllowedClickUpUrl(value: string, hosts: readonly string[]): boolean {
  if (
    !/^https:\/\//i.test(value) ||
    /[\s\u0000-\u001f\u007f-\u009f\\]/u.test(value) ||
    value.slice(8).includes('://')
  )
    return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      hosts.includes(url.hostname)
    )
  } catch {
    return false
  }
}
