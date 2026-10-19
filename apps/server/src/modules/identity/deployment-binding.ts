import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { createIdentityBinding } from '@workspace/common/node/identity-config'
import { assertDatabaseUrl } from '@server/src/db/client.js'
import type { IdentityConfig } from './config.js'
import { IdentityConfigError } from './config.js'

/** Pins all deployment routes before any worker can deliver a historical event. */
export function assertDeploymentBinding(
  identity: IdentityConfig | Readonly<{ enabled: false }>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!identity.enabled || identity.mode !== 'deployment') return
  try {
    if (!env.IDENTITY_DEPLOYMENT_RECEIPT_FILE) throw new Error()
    const receipt: unknown = JSON.parse(readFileSync(env.IDENTITY_DEPLOYMENT_RECEIPT_FILE, 'utf8'))
    const database = new URL(assertDatabaseUrl(env.DATABASE_URL))
    const expected = createIdentityBinding({
      websiteTarget: {
        host: database.hostname.toLowerCase(),
        port: Number(database.port || 5432),
        user: decodeURIComponent(database.username),
        database: 'exre',
        verifiedDatabase: 'exre',
      },
      issuer: identity.issuer,
      publicOrigin: identity.publicOrigin,
      hydraAdminUrl: identity.hydraAdminUrl,
      clients: identity.approvedClients,
      cleanupTargets: identity.cleanupTargets,
      flowKey: identity.keys.flow,
      bootstrapKey: identity.keys.bootstrap,
    })
    if (!isDeepStrictEqual(receipt, expected)) throw new Error()
  } catch {
    throw new IdentityConfigError('IDENTITY_DEPLOYMENT_RECEIPT_FILE')
  }
}
