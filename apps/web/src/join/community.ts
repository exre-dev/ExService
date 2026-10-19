// 社区地址由 apps/web/public/config.json 在构建时注入；空值保留禁用的入口。
function configuredUrl(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}
export const communityDestinations = [
  { label: 'QQ 社区', url: configuredUrl(import.meta.env.VITE_COMMUNITY_QQ_URL) },
  { label: 'KOOK 社区', url: configuredUrl(import.meta.env.VITE_COMMUNITY_KOOK_URL) },
]

export const communityLinks = communityDestinations.filter(
  (link): link is { label: string; url: string } => link.url !== undefined,
)
