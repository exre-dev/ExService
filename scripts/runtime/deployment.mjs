import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createIdentityBinding } from '@workspace/common/node/identity-config'
import { digest, readJson, LocalError, atomicJson } from './local-config.mjs'
import { verifyHydraClient } from './hydra-client.mjs'
import { readRuntimeConfiguration } from './settings.mjs'

export function deploymentBinding(state) {
  return createIdentityBinding({
    websiteTarget: state.config.websiteTarget,
    issuer: state.config.issuer,
    publicOrigin: state.config.publicOrigin,
    hydraAdminUrl: state.internal.hydra,
    clients: state.clients,
    cleanupTargets: state.cleanupTargets,
    flowKey: state.secrets.IDENTITY_FLOW_KEY,
    bootstrapKey: state.secrets.IDENTITY_BOOTSTRAP_KEY,
  })
}
export const connectDatabase = async (url) => {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 })
  await client.connect()
  return client
}
/** Never rewrite a routing pin during ordinary startup, including empty-client startup. */
export async function validateDeployment(
  state,
  { prepare = false, connect = connectDatabase, verifyClient = verifyHydraClient } = {},
) {
  const path = join(state.workspace, '.local/runtime-deployment/identity.json'),
    binding = deploymentBinding(state)
  const existing = existsSync(path) ? readJson(path) : undefined
  if (existing && digest(existing) !== digest(binding))
    throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
  let client
  try {
    client = await connect(state.databases.DATABASE)
    await client.query('BEGIN READ ONLY')
    if ((await client.query('SELECT current_database() AS name')).rows[0]?.name !== 'exre')
      throw new LocalError('DEPLOYMENT_DATABASE_IDENTITY_CONFLICT')
    if (!existing) {
      const old = await client.query(`SELECT 1 FROM auth_oidc_bindings
        UNION ALL SELECT 1 FROM auth_oidc_flows
        UNION ALL SELECT 1 FROM auth_identity_outbox WHERE completed_at IS NULL LIMIT 1`)
      if (old.rows.length) throw new LocalError('DEPLOYMENT_OLD_IDENTITY_PENDING')
    }
    await client.query('ROLLBACK')
  } catch (error) {
    throw error instanceof LocalError ? error : new LocalError('DEPLOYMENT_DATABASE_NOT_READY')
  } finally {
    await client?.end().catch(() => {})
  }
  if (prepare && !existing) {
    // Verify actual client configuration before pinning, never provision implicitly.
    for (const configured of Object.values(state.clients))
      await verifyClient({
        mode: state.profile,
        adminUrl: state.internal.hydra,
        publicUrl: state.config.issuer,
        client: configured,
      })
    mkdirSync(join(state.workspace, '.local/runtime-deployment'), { recursive: true })
    try {
      writeFileSync(path, JSON.stringify(binding), { flag: 'wx', mode: 0o600 })
    } catch (error) {
      if (error.code !== 'EEXIST' || digest(readJson(path)) !== digest(binding))
        throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
    }
  } else if (!prepare) {
    if (!existing)
      throw new LocalError(
        'DEPLOYMENT_BINDING_MISSING',
        'node scripts/runtime/deployment.mjs prepare',
      )
    try {
      for (const configured of Object.values(state.clients))
        await verifyClient({
          mode: state.profile,
          adminUrl: state.internal.hydra,
          publicUrl: state.config.issuer,
          client: configured,
        })
    } catch {
      throw new LocalError('DEPLOYMENT_HYDRA_NOT_READY')
    }
  }
  return binding
}
export function validateLegacyBinding(state, original, before) {
  if (
    typeof original.OUTLINE_OIDC_CLIENT_SECRET !== 'string' ||
    !original.OUTLINE_OIDC_CLIENT_SECRET ||
    typeof original.IDENTITY_DELIVERY_KEY !== 'string' ||
    !original.IDENTITY_DELIVERY_KEY
  )
    throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
  const expected = {
    version: 1,
    websiteTarget: state.config.websiteTarget,
    issuer: state.config.issuer,
    publicOrigin: state.config.publicOrigin,
    clientSecretFingerprint: digest(original.OUTLINE_OIDC_CLIENT_SECRET),
    deliveryFingerprint: digest(original.IDENTITY_DELIVERY_KEY),
  }
  if (digest(before) !== digest(expected))
    throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
  return true
}
/** Explicit v1 conversion requires original secrets AND a verified, drained old client.
 * The callback executes actual client and resource checks; nothing can silently refresh a pin.
 */
export async function convertLegacyBinding(
  state,
  original,
  { connect = connectDatabase, verifyOriginal } = {},
) {
  const path = join(state.workspace, '.local/runtime-deployment/identity.json'),
    before = readJson(path)
  const next = deploymentBinding(state)
  if (before.version === 2) {
    if (digest(before) !== digest(next))
      throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
    return { changed: false }
  }
  validateLegacyBinding(state, original, before)
  if (typeof verifyOriginal !== 'function')
    throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
  await verifyOriginal()
  let client
  try {
    client = await connect(state.databases.DATABASE)
    await client.query('BEGIN READ ONLY')
    if ((await client.query('SELECT current_database() AS name')).rows[0]?.name !== 'exre')
      throw new LocalError('DEPLOYMENT_DATABASE_IDENTITY_CONFLICT')
    const ids = new Set([...Object.keys(state.clients), ...Object.keys(state.cleanupTargets)])
    for (const table of ['auth_oidc_bindings', 'auth_oidc_flows']) {
      for (const row of (await client.query(`SELECT DISTINCT client_id FROM ${table}`)).rows)
        if (!ids.has(row.client_id)) throw new LocalError('DEPLOYMENT_OLD_IDENTITY_PENDING')
    }
    for (const row of (
      await client.query(
        'SELECT target_bindings FROM auth_identity_outbox WHERE completed_at IS NULL',
      )
    ).rows) {
      const targets = JSON.parse(row.target_bindings)
      if (!Array.isArray(targets) || targets.some((target) => !target || !ids.has(target.clientId)))
        throw new LocalError('DEPLOYMENT_OLD_IDENTITY_PENDING')
    }
    await client.query('ROLLBACK')
  } catch (error) {
    throw error instanceof LocalError ? error : new LocalError('DEPLOYMENT_OLD_IDENTITY_PENDING')
  } finally {
    await client?.end().catch(() => {})
  }
  if (digest(readJson(path)) !== digest(before))
    throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
  // Preserve the original pin for audit/retry; it is never deleted to permit fresh prepare.
  const backup = `${path}.v1-backup`
  if (existsSync(backup)) {
    if (digest(readJson(backup)) !== digest(before))
      throw new LocalError('DEPLOYMENT_IDENTITY_MIGRATION_REQUIRED')
  } else writeFileSync(backup, JSON.stringify(before), { flag: 'wx', mode: 0o600 })
  atomicJson(path, next)
  return { changed: true }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!['validate', 'prepare'].includes(process.argv[2]) || process.argv.length !== 3)
      throw new LocalError('DEPLOYMENT_ARGUMENTS_INVALID')
    await validateDeployment(readRuntimeConfiguration({ profile: 'deployment' }), {
      prepare: process.argv[2] === 'prepare',
    })
    console.log('DEPLOYMENT_CONFIGURATION_VALIDATED')
  } catch (error) {
    console.error(error instanceof LocalError ? error.message : 'DEPLOYMENT_VALIDATION_FAILED')
    process.exitCode = 1
  }
}
