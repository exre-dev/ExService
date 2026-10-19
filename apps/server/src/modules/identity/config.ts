import {
  IdentityConfigError,
  parseIdentityConfiguration,
  type IdentityConfiguration,
} from '@workspace/common/node/identity-config'
export { IdentityConfigError, isIdentityClientId } from '@workspace/common/node/identity-config'
export type {
  IdentityClientId,
  IdentityDeliveryTarget,
  IdentityMode,
} from '@workspace/common/node/identity-config'

export interface IdentityConfig extends IdentityConfiguration {
  readonly enabled: true
}

/** Independent identity configuration; no implicit application or legacy mode. */
export function parseIdentityConfig(
  env: NodeJS.ProcessEnv = process.env,
): IdentityConfig | Readonly<{ enabled: false }> {
  if (env.IDENTITY_ENABLED !== undefined && !['true', 'false'].includes(env.IDENTITY_ENABLED))
    throw new IdentityConfigError('IDENTITY_ENABLED')
  if (env.IDENTITY_ENABLED !== 'true') return Object.freeze({ enabled: false })
  const identity = parseIdentityConfiguration({
    mode: env.IDENTITY_MODE,
    publicOrigin: env.SERVER_PUBLIC_WEB_BASE_URL,
    publicOriginVariable: 'SERVER_PUBLIC_WEB_BASE_URL',
    issuer: env.HYDRA_PUBLIC_URL,
    hydraAdminUrl: env.HYDRA_ADMIN_URL,
    bootstrapKey: env.IDENTITY_BOOTSTRAP_KEY,
    flowKey: env.IDENTITY_FLOW_KEY,
    clientsJson: env.IDENTITY_CLIENTS_JSON,
    cleanupTargetsJson: env.IDENTITY_OUTBOX_TARGETS_JSON,
  })
  return Object.freeze({ enabled: true, ...identity })
}
