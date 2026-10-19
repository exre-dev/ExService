import { digest } from './local-config.mjs'

/** Preserve the exact Docker inspect fields used by persisted ownership proofs. */
export function containerProof(item) {
  const host = { ...item.HostConfig }
  // Docker normalizes unset DNS lists between null and [] after a restart.
  for (const key of ['Dns', 'DnsOptions', 'DnsSearch']) if (host[key] === null) host[key] = []
  return {
    id: item.Id,
    service: item.Config.Labels['com.docker.compose.service'],
    digest: digest({
      image: item.Image,
      config: item.Config,
      host,
      mounts: [...item.Mounts].sort((left, right) =>
        left.Destination.localeCompare(right.Destination),
      ),
    }),
  }
}
