import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  lstatSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { join, resolve, relative, isAbsolute, sep, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { isIdentityClientId } from '@workspace/common/node/identity-config'
import { atomicJson, digest, readJson, LocalError } from './local-config.mjs'
import { root } from './shared.mjs'
import { environmentFile, databaseUrl, readRuntimeConfiguration } from './settings.mjs'
import { verifyHydraClient, hydraClientBasic } from './hydra-client.mjs'
import {
  connectDatabase,
  convertLegacyBinding,
  validateLegacyBinding,
  deploymentBinding,
} from './deployment.mjs'
import { serializeEnvironment, convertValues } from './convert.mjs'
import { acquireApplicationLock } from './application-lock.mjs'
import { containerProof } from './container-proof.mjs'
import { identityAlive, acquireLock } from './ownership.mjs'

const environmentFingerprint = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex')

export const retirementSteps = Object.freeze([
  'stop',
  'clients',
  'website',
  'resources',
  'configuration',
  'restart',
  'readiness',
])
export function retirementOutcome(completed) {
  return {
    status: completed.includes('configuration')
      ? 'maintenance-applied-awaiting-restart-and-readiness'
      : 'maintenance-in-progress',
    appliedSteps: [...completed],
    pendingSteps: retirementSteps.filter((step) => !completed.includes(step)),
    exitCode: 2,
  }
}
export const retiredClientIds = Object.freeze(['ex-outline-local', 'ex-outline'])
const retired = (value) => retiredClientIds.includes(value)
const fail = (code) => {
  throw new LocalError(code)
}
/** Inspect complete parsed snapshots, never SQL LIKE or JSON substring matching. */
export function planRetiredTargets(targets) {
  if (
    !Array.isArray(targets) ||
    targets.some(
      (target) =>
        !target ||
        typeof target !== 'object' ||
        Array.isArray(target) ||
        !isIdentityClientId(target.clientId) ||
        typeof target.hydraSid !== 'string' ||
        !target.hydraSid ||
        Object.keys(target).some(
          (key) => !['clientId', 'hydraSid', 'sessionId', 'deliveryEventId'].includes(key),
        ) ||
        ['sessionId', 'deliveryEventId'].some(
          (key) => target[key] !== undefined && (typeof target[key] !== 'string' || !target[key]),
        ),
    )
  )
    fail('RETIREMENT_SNAPSHOT_INVALID')
  return {
    remaining: targets.filter((target) => !retired(target.clientId)),
    removed: targets.filter((target) => retired(target.clientId)),
  }
}
export function planOutboxRow(row) {
  let targets, delivered
  try {
    targets = JSON.parse(row.target_bindings)
    delivered = JSON.parse(row.delivered_targets)
  } catch {
    fail('RETIREMENT_SNAPSHOT_INVALID')
  }
  const { remaining, removed } = planRetiredTargets(targets)
  const allowed = new Set(
    targets.flatMap((target) =>
      ['hydra', 'outline', 'app'].map((type) => `${type}:${target.clientId}:${target.hydraSid}`),
    ),
  )
  if (
    !Array.isArray(delivered) ||
    delivered.some((value) => typeof value !== 'string' || !allowed.has(value))
  )
    fail('RETIREMENT_SNAPSHOT_INVALID')
  if (!removed.length) return row
  if (!remaining.length) return null
  const removedKeys = new Set(
    removed.flatMap((target) =>
      ['hydra', 'outline', 'app'].map((type) => `${type}:${target.clientId}:${target.hydraSid}`),
    ),
  )
  return {
    ...row,
    target_bindings: JSON.stringify(remaining),
    delivered_targets: JSON.stringify(delivered.filter((value) => !removedKeys.has(value))),
  }
}
/** All Website changes commit together; parse every row before the first mutation. */
export async function cleanRetiredDatabase(db, { plan = false } = {}) {
  await db.query(plan ? 'BEGIN READ ONLY' : 'BEGIN')
  try {
    if ((await db.query('SELECT current_database() AS name')).rows[0]?.name !== 'exre')
      fail('RETIREMENT_DATABASE_IDENTITY_CONFLICT')
    if (!plan)
      await db.query(
        'LOCK TABLE auth_oidc_flows, auth_oidc_bindings, auth_identity_outbox IN EXCLUSIVE MODE',
      )
    const rows = (
      await db.query(
        `SELECT event_id,target_bindings,delivered_targets FROM auth_identity_outbox${plan ? '' : ' FOR UPDATE'}`,
      )
    ).rows
    const changes = rows.map((row) => ({ old: row, next: planOutboxRow(row) }))
    const counts = {
      removedEvents: changes.filter((change) => change.next === null).length,
      changedEvents: changes.filter((change) => change.next && change.next !== change.old).length,
    }
    if (!plan) {
      await db.query('DELETE FROM auth_oidc_flows WHERE client_id = ANY($1::text[])', [
        retiredClientIds,
      ])
      await db.query('DELETE FROM auth_oidc_bindings WHERE client_id = ANY($1::text[])', [
        retiredClientIds,
      ])
      for (const { old, next } of changes) {
        if (next === null)
          await db.query('DELETE FROM auth_identity_outbox WHERE event_id=$1', [old.event_id])
        else if (next !== old)
          await db.query(
            'UPDATE auth_identity_outbox SET target_bindings=$1,delivered_targets=$2 WHERE event_id=$3',
            [next.target_bindings, next.delivered_targets, old.event_id],
          )
      }
    }
    await db.query(plan ? 'ROLLBACK' : 'COMMIT')
    return counts
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  }
}
/** Check immutable original evidence before every irreversible step and every retry. */
export async function executeRetirement({
  proof,
  workspace,
  inspect,
  steps,
  done = [],
  persist = async () => {},
}) {
  if (proof.workspace !== workspace || !proof.preserved?.postgres || !proof.preserved?.hydra)
    fail('RETIREMENT_OWNERSHIP_CONFLICT')
  const completed = [...done]
  for (const step of ['stop', 'clients', 'website', 'resources', 'configuration']) {
    const actual = await inspect(completed)
    if (
      actual.workspace !== proof.workspace ||
      digest(actual.preserved) !== digest(proof.preserved)
    )
      fail('RETIREMENT_PRESERVED_PROOF_CHANGED')
    if (completed.includes(step)) continue
    if (typeof steps[step] !== 'function') fail('RETIREMENT_STEP_UNAVAILABLE')
    await steps[step]()
    completed.push(step)
    await persist(completed)
  }
  const final = await inspect(completed)
  if (digest(final.preserved) !== digest(proof.preserved))
    fail('RETIREMENT_PRESERVED_PROOF_CHANGED')
  return { completed }
}
function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: 30000,
  })
  if (result.error || result.status !== 0) fail('RETIREMENT_DOCKER_CHECK_FAILED')
  return result.stdout
}
const containerExists = (id) =>
  docker(['ps', '-a', '--no-trunc', '--format', '{{.ID}}']).trim().split(/\r?\n/).includes(id)
const inspectContainer = (id) => JSON.parse(docker(['inspect', id]))[0]
function assertInside(workspace, target) {
  const checkout = resolve(workspace),
    base = resolve(checkout, '.local'),
    path = resolve(target),
    rel = relative(base, path)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    fail('RETIREMENT_STORAGE_OWNERSHIP_CONFLICT')
  // Include .local and every real parent, including checkout ancestors. Never cross a junction.
  let current = parse(path).root
  for (const part of path.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, part)
    if (!existsSync(current)) break
    if (lstatSync(current).isSymbolicLink()) fail('RETIREMENT_STORAGE_OWNERSHIP_CONFLICT')
  }
  const realCheckout = realpathSync(checkout)
  if (existsSync(base)) {
    const realBase = realpathSync(base)
    if (relative(realCheckout, realBase).toLowerCase() !== '.local')
      fail('RETIREMENT_STORAGE_OWNERSHIP_CONFLICT')
    if (existsSync(path)) {
      const inside = relative(realBase, realpathSync(path))
      if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))
        fail('RETIREMENT_STORAGE_OWNERSHIP_CONFLICT')
    }
  }
  return path
}
export function removeRetiredStorage(workspace, target, { remove = rmSync } = {}) {
  const path = assertInside(workspace, target)
  if (existsSync(path)) remove(path, { recursive: true })
}
/** All reads and writes use the same encoded original target, including local fallback and TLS options. */
export function retirementDatabaseTargets(values) {
  const port = Number(values.LOCAL_POSTGRES_PORT ?? 5432)
  const targets = Object.fromEntries(
    [
      ['DATABASE', 'exre'],
      ['HYDRA_DATABASE', 'hydra'],
      ['OUTLINE_DATABASE', 'outline'],
    ].map(([prefix, name]) => [name, databaseUrl(values, prefix, name, port)]),
  )
  if (!values.POSTGRES_PASSWORD) fail('RETIREMENT_ADMIN_CREDENTIALS_REQUIRED')
  const admin = new URL(targets.outline)
  admin.pathname = '/postgres'
  admin.username = encodeURIComponent(values.POSTGRES_USER ?? 'postgres')
  admin.password = encodeURIComponent(values.POSTGRES_PASSWORD)
  return { ...targets, outlineAdmin: admin.href }
}
async function databaseIdentity(db, name) {
  const actual = (await db.query('SELECT current_database() AS name,current_user AS owner')).rows[0]
  const database = (
    await db.query(
      'SELECT d.oid::text AS oid,r.rolname AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=$1',
      [name],
    )
  ).rows[0]
  return { name: actual?.name, user: actual?.owner, owner: database?.owner, oid: database?.oid }
}
async function assertDatabaseIdentity(db, url, proof) {
  if (digest(url) !== proof?.targetFingerprint) fail('RETIREMENT_DATABASE_TARGET_CHANGED')
  const actual = await databaseIdentity(db, proof.name)
  if (
    actual.name !== proof.name ||
    actual.user !== (proof.user ?? proof.owner) ||
    actual.owner !== proof.owner ||
    actual.oid !== proof.oid
  )
    fail('RETIREMENT_DATABASE_IDENTITY_CONFLICT')
}
function assertReceiptProof(workspace, plan, progress, expectedV2Fingerprint) {
  if (!Object.hasOwn(plan, 'receiptFingerprint')) fail('RETIREMENT_RECEIPT_PROOF_MISSING')
  const path = join(workspace, '.local/runtime-deployment/identity.json'),
    present = existsSync(path)
  if (plan.receiptFingerprint === null) {
    if (present) fail('RETIREMENT_RECEIPT_CHANGED')
    return
  }
  if (!present) fail('RETIREMENT_RECEIPT_MISSING')
  const current = readJson(path),
    fingerprint = digest(current)
  if (fingerprint === plan.receiptFingerprint) return
  const conversion = progress.receiptConversion,
    backup = `${path}.v1-backup`
  if (
    !conversion ||
    conversion.fromFingerprint !== plan.receiptFingerprint ||
    conversion.toFingerprint !== expectedV2Fingerprint ||
    fingerprint !== expectedV2Fingerprint ||
    current.version !== 2 ||
    !existsSync(backup) ||
    readJson(backup).version !== 1 ||
    digest(readJson(backup)) !== plan.receiptFingerprint
  )
    fail('RETIREMENT_RECEIPT_CHANGED')
}
/** A source record predating retirement must prove every container; never adopt names. */
const retiredEnvironmentKeys = new Set([
  ...[
    'HOST',
    'PORT',
    'NAME',
    'USER',
    'PASSWORD',
    'SSLMODE',
    'SSLROOTCERT',
    'CONNECT_TIMEOUT',
    'OPTIONS',
    'URL',
  ].map((field) => `OUTLINE_DATABASE_${field}`),
  'OUTLINE_PASSWORD',
  'OUTLINE_SECRET_KEY',
  'OUTLINE_UTILS_SECRET',
  'OUTLINE_INTEGRATION_KEY',
  'OUTLINE_INTERNAL_URL',
  'OUTLINE_REDIS_URL',
  'OUTLINE_OIDC_CLIENT_SECRET',
  'OUTLINE_OIDC_CLIENT_ID',
  'OUTLINE_OIDC_REDIRECT_URI',
  'OUTLINE_STORAGE_DIRECTORY',
  'OUTLINE_HOST',
  'OUTLINE_PORT',
  'OUTLINE_DEV_HTTP_PORT',
  'LOCAL_OUTLINE_PORT',
  'LOCAL_OUTLINE_VITE_PORT',
  'INTEGRATION_OUTLINE_VITE_PORT',
  'LOCAL_REDIS_PORT',
  'REDIS_VOLUME_NAME',
  'WEBSITE_INTEGRATION_ENABLED',
  'WEBSITE_INTEGRATION_MODE',
  'IDENTITY_DELIVERY_KEY',
])
export function retiredConfiguration(values) {
  const converted = convertValues(values)
  for (const key of retiredEnvironmentKeys) delete converted[key]
  if (converted.IDENTITY_OUTBOX_TARGETS_JSON) {
    const targets = JSON.parse(converted.IDENTITY_OUTBOX_TARGETS_JSON)
    for (const id of retiredClientIds) delete targets[id]
    converted.IDENTITY_OUTBOX_TARGETS_JSON = JSON.stringify(targets)
  }
  return converted
}
export async function buildRetirementPlan({ workspace = root, connect = connectDatabase } = {}) {
  const source = join(workspace, '.env.local')
  if (!existsSync(source)) fail('RETIREMENT_ORIGINAL_CONFIG_MISSING')
  const values = convertValues(environmentFile(source), { includeRetired: true }),
    state = readRuntimeConfiguration({
      workspace,
      inherited: {},
      sourceValues: retiredConfiguration(values),
    }),
    dependencyPath = join(workspace, '.local/runtime/dependencies.json')
  if (!existsSync(dependencyPath)) fail('RETIREMENT_OWNERSHIP_RECORD_MISSING')
  const record = readJson(dependencyPath)
  if (
    record.version !== 1 ||
    record.project !== 'exwebsite-runtime' ||
    !Array.isArray(record.proofs)
  )
    fail('RETIREMENT_OWNERSHIP_RECORD_INVALID')
  const ids = docker([
    'ps',
    '-a',
    '--no-trunc',
    '--filter',
    'label=com.docker.compose.project=exwebsite-runtime',
    '--format',
    '{{.ID}}',
  ])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
  const items = ids.map(inspectContainer)
  if (
    items.some(
      (item) => !record.proofs.some((proof) => digest(proof) === digest(containerProof(item))),
    )
  )
    fail('RETIREMENT_OWNERSHIP_CONFLICT')
  const byService = (name) => {
    const found = items.filter((item) => item.Config.Labels['com.docker.compose.service'] === name)
    if (found.length !== 1) fail('RETIREMENT_OWNERSHIP_CONFLICT')
    const item = found[0],
      labels = item.Config.Labels
    if (
      labels['com.docker.compose.project.working_dir'] &&
      resolve(labels['com.docker.compose.project.working_dir']) !== resolve(workspace)
    )
      fail('RETIREMENT_OTHER_CHECKOUT_OWNS_RESOURCE')
    return item
  }
  const postgres = byService('postgres'),
    hydra = byService('hydra'),
    redis = items.find((item) => item.Config.Labels['com.docker.compose.service'] === 'redis')
  const databaseProof = {},
    targets = retirementDatabaseTargets(values)
  for (const [prefix, name] of [
    ['DATABASE', 'exre'],
    ['HYDRA_DATABASE', 'hydra'],
    ['OUTLINE_DATABASE', 'outline'],
  ]) {
    const url = targets[name],
      db = await connect(url)
    try {
      const actual = (await db.query('SELECT current_database() AS name,current_user AS owner'))
        .rows[0]
      const database = (
          await db.query(
            'SELECT d.oid::text AS oid,r.rolname AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=$1',
            [name],
          )
        ).rows[0],
        owner = database?.owner
      if (
        actual?.name !== name ||
        actual.owner !== values[`${prefix}_USER`] ||
        owner !== actual.owner
      )
        fail('RETIREMENT_DATABASE_IDENTITY_CONFLICT')
      databaseProof[name] = { name, owner, oid: database.oid, targetFingerprint: digest(url) }
      if (name === 'exre') {
        await cleanRetiredDatabase(db, { plan: true })
        const known = new Set([
          ...retiredClientIds,
          ...Object.keys(state.clients),
          ...Object.keys(state.cleanupTargets),
        ])
        for (const table of ['auth_oidc_flows', 'auth_oidc_bindings'])
          for (const row of (await db.query(`SELECT DISTINCT client_id FROM ${table}`)).rows)
            if (!known.has(row.client_id)) fail('RETIREMENT_UNKNOWN_IDENTITY_TARGET')
        for (const row of (
          await db.query(
            'SELECT target_bindings FROM auth_identity_outbox WHERE completed_at IS NULL',
          )
        ).rows)
          for (const target of JSON.parse(row.target_bindings))
            if (!known.has(target.clientId)) fail('RETIREMENT_UNKNOWN_IDENTITY_TARGET')
      }
    } finally {
      await db.end()
    }
  }
  const admin = await connect(targets.outlineAdmin)
  let outlineAdmin
  try {
    const actual = await databaseIdentity(admin, 'postgres')
    if (
      actual.name !== 'postgres' ||
      actual.user !== (values.POSTGRES_USER ?? 'postgres') ||
      !actual.owner ||
      !actual.oid
    )
      fail('RETIREMENT_DATABASE_IDENTITY_CONFLICT')
    const outline = (
      await admin.query(
        'SELECT d.oid::text AS oid,r.rolname AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=$1',
        ['outline'],
      )
    ).rows[0]
    if (
      outline?.oid !== databaseProof.outline.oid ||
      outline?.owner !== databaseProof.outline.owner
    )
      fail('RETIREMENT_DATABASE_IDENTITY_CONFLICT')
    outlineAdmin = { ...actual, targetFingerprint: digest(targets.outlineAdmin) }
  } finally {
    await admin.end()
  }
  const receiptPath = join(workspace, '.local/runtime-deployment/identity.json')
  const receipt = existsSync(receiptPath) ? readJson(receiptPath) : null
  if (receipt?.version === 1) validateLegacyBinding(state, values, receipt)
  else if (receipt && digest(receipt) !== digest(deploymentBinding(state)))
    fail('RETIREMENT_RECEIPT_CONFLICT')
  for (const id of retiredClientIds) await verifyLegacyClient(values, id, { allowMissing: true })
  const runPath = join(workspace, '.local/runtime/run.json')
  if (!existsSync(runPath)) fail('RETIREMENT_PROCESS_PROOF_REQUIRED')
  const run = readJson(runPath)
  if (!run.identity || !Array.isArray(run.children) || !run.runId)
    fail('RETIREMENT_PROCESS_PROOF_REQUIRED')
  const storage = assertInside(
    workspace,
    values.OUTLINE_STORAGE_DIRECTORY ??
      join(workspace, '.local/docs-integration/local-dev/data/outline'),
  )
  const redisVolumes = (redis?.Mounts ?? []).map((mount) => {
    if (mount.Type !== 'volume') fail('RETIREMENT_REDIS_MOUNT_UNSUPPORTED')
    const volume = JSON.parse(docker(['volume', 'inspect', mount.Name]))[0]
    const consumers = docker([
      'ps',
      '-a',
      '--no-trunc',
      '--filter',
      `volume=${mount.Name}`,
      '--format',
      '{{.ID}}',
    ])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
    if (consumers.some((id) => id !== redis.Id)) fail('RETIREMENT_REDIS_VOLUME_SHARED')
    return { name: mount.Name, digest: digest(volume) }
  })
  const retiredResources = {
    redis: redis ? containerProof(redis) : null,
    redisMounts: redis?.Mounts ?? [],
    redisVolumes,
    storage,
  }
  return {
    version: 1,
    workspace: resolve(workspace),
    sourceFingerprint: environmentFingerprint(source),
    dependencyFingerprint: digest(record),
    receiptFingerprint: receipt ? digest(receipt) : null,
    run,
    databases: databaseProof,
    outlineAdmin,
    preserved: { postgres: containerProof(postgres), hydra: containerProof(hydra) },
    retired: retiredResources,
    completed: [],
    pendingSteps: [...retirementSteps],
    status: 'planned',
  }
}
async function verifyLegacyClient(values, id, { allowMissing = false } = {}) {
  const admin =
    values.HYDRA_ADMIN_URL ?? `http://127.0.0.1:${values.LOCAL_HYDRA_ADMIN_PORT ?? 4445}/`
  const origin = values.PUBLIC_ORIGIN ?? `http://127.0.0.1:${values.LOCAL_PUBLIC_PORT ?? 8080}`
  const response = await fetch(new URL(`/admin/clients/${id}`, admin), {
    redirect: 'manual',
    signal: AbortSignal.timeout(1000),
  })
  if (response.status === 404 && allowMissing) return
  if (!response.ok) fail('RETIREMENT_HYDRA_CLIENT_CHECK_FAILED')
  const client = await response.json()
  if (
    client.client_id !== id ||
    digest(client.redirect_uris) !== digest([`${origin}/docs/auth/oidc.callback`]) ||
    digest(client.post_logout_redirect_uris) !== digest([`${origin}/identity/signed-out`])
  )
    fail('RETIREMENT_HYDRA_CLIENT_CONFLICT')
  const secret = values.OUTLINE_OIDC_CLIENT_SECRET
  if (!secret) fail('RETIREMENT_ORIGINAL_SECRET_MISSING')
  const issuer =
    values.HYDRA_PUBLIC_URL ?? `http://127.0.0.1:${values.LOCAL_HYDRA_PUBLIC_PORT ?? 4444}/`
  if (
    digest(client.grant_types) !== digest(['authorization_code']) ||
    digest(client.response_types) !== digest(['code']) ||
    client.subject_type !== 'public' ||
    client.token_endpoint_auth_method !== 'client_secret_basic' ||
    digest((client.scope ?? '').split(/\s+/).sort()) !== digest(['email', 'openid', 'profile']) ||
    client.metadata?.issuer !== new URL(issuer).href ||
    client.metadata?.secretFingerprint !== digest(secret)
  )
    fail('RETIREMENT_HYDRA_CLIENT_CONFLICT')
  const probe = await fetch(new URL('/oauth2/token', issuer), {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(1000),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: hydraClientBasic(id, secret),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: `retirement-invalid-${crypto.randomUUID()}`,
      redirect_uri: client.redirect_uris[0],
    }),
  })
  if (probe.status !== 400 || (await probe.json()).error !== 'invalid_grant')
    fail('RETIREMENT_HYDRA_SECRET_CONFLICT')
}
export async function applyRetirementPlan(
  plan,
  {
    workspace = root,
    connect = connectDatabase,
    dockerCall = docker,
    acquire = acquireLock,
    applicationAcquire = acquireApplicationLock,
  } = {},
) {
  workspace = resolve(workspace)
  const directory = join(workspace, '.local/runtime'),
    path = join(directory, 'outline-retirement-plan.json'),
    source = join(workspace, '.env.local')
  if (plan.version !== 1 || plan.workspace !== workspace) fail('RETIREMENT_OWNERSHIP_CONFLICT')
  const progress = plan.progress ?? {},
    backupSource = join(directory, 'outline-retirement-original.env')
  const verifyOriginalEnvironment = () => {
    if (existsSync(backupSource) && environmentFingerprint(backupSource) !== plan.sourceFingerprint)
      fail('RETIREMENT_ORIGINAL_ENV_CONFLICT')
  }
  verifyOriginalEnvironment()
  const values = convertValues(
    progress.configurationIntent && existsSync(backupSource)
      ? environmentFile(backupSource)
      : environmentFile(source),
    { includeRetired: true },
  )
  if (!plan.outlineAdmin) fail('RETIREMENT_DATABASE_PROOF_MISSING')
  const targets = retirementDatabaseTargets(values),
    state = readRuntimeConfiguration({
      workspace,
      inherited: {},
      sourceValues: retiredConfiguration(values),
    })
  const expectedV2Fingerprint = digest(deploymentBinding(state))
  const verifyReceipt = () => assertReceiptProof(workspace, plan, progress, expectedV2Fingerprint)
  verifyReceipt()
  const lock = acquire({
    mode: 'local',
    fingerprint: digest(plan.preserved),
    directory,
    name: 'retire-outline-lock.json',
  })
  const inspectContainer = (id) => JSON.parse(dockerCall(['inspect', id]))[0]
  const containerExists = (id) =>
    dockerCall(['ps', '-a', '--no-trunc', '--format', '{{.ID}}']).trim().split(/\r?\n/).includes(id)
  const inspect = async (completed) => {
    verifyOriginalEnvironment()
    verifyReceipt()
    if (
      !completed.includes('configuration') &&
      environmentFingerprint(source) !== plan.sourceFingerprint &&
      (!progress.configurationIntent ||
        environmentFingerprint(source) !== progress.configurationIntent)
    )
      fail('RETIREMENT_SOURCE_CHANGED')
    const preserved = Object.fromEntries(
      Object.entries(plan.preserved).map(([name, proof]) => [
        name,
        containerProof(inspectContainer(proof.id)),
      ]),
    )
    if (!completed.includes('resources') && plan.retired.redis) {
      if (containerExists(plan.retired.redis.id)) {
        if (
          digest(containerProof(inspectContainer(plan.retired.redis.id))) !==
          digest(plan.retired.redis)
        )
          fail('RETIREMENT_REDIS_PROOF_CHANGED')
      } else if (!progress.redisRemovalIntent) fail('RETIREMENT_REDIS_PROOF_CHANGED')
    }
    for (const [name, proof] of Object.entries(plan.databases)) {
      if (
        name === 'outline' &&
        (completed.includes('resources') ||
          progress.outlineDatabase ||
          progress.outlineDatabaseIntent)
      )
        continue
      const url = targets[name],
        db = await connect(url, { purpose: 'inspect' })
      try {
        await assertDatabaseIdentity(db, url, proof)
      } finally {
        await db.end()
      }
    }
    return { workspace, preserved }
  }
  let completedSteps = [...plan.completed],
    applicationLock,
    dependencyLock
  const lockApplications = () => {
    applicationLock ??= applicationAcquire({ directory, fingerprint: digest(plan.preserved) })
    dependencyLock ??= acquire({
      mode: 'local',
      fingerprint: digest(plan.preserved),
      directory,
      name: 'service-lock.json',
    })
  }
  const persistProgress = () =>
    atomicJson(path, {
      ...plan,
      completed: completedSteps,
      progress,
      ...retirementOutcome(completedSteps),
    })
  const resourceStep = async (name, action) => {
    if (progress[name]) return
    await inspect(completedSteps)
    await action()
    progress[name] = true
    persistProgress()
  }
  try {
    if (completedSteps.includes('stop')) lockApplications()
    return await executeRetirement({
      proof: plan,
      workspace,
      inspect,
      done: plan.completed,
      persist: async (completed) => {
        completedSteps = [...completed]
        persistProgress()
      },
      steps: {
        stop: async () => {
          const runPath = join(directory, 'run.json'),
            run = readJson(runPath)
          if (run.runId !== plan.run.runId || digest(run.identity) !== digest(plan.run.identity))
            fail('RETIREMENT_PROCESS_PROOF_CHANGED')
          atomicJson(join(directory, 'control-request.json'), { runId: run.runId, action: 'stop' })
          const deadline = Date.now() + 30000
          while (identityAlive(run.identity) && Date.now() < deadline) await delay(200)
          if (
            identityAlive(run.identity) ||
            run.children.some((child) => identityAlive(child.identity))
          )
            fail('RETIREMENT_PROCESSES_STILL_ACTIVE')
          lockApplications()
        },
        clients: async () => {
          for (const id of retiredClientIds) {
            await verifyLegacyClient(values, id, { allowMissing: true })
            const admin =
              values.HYDRA_ADMIN_URL ?? `http://127.0.0.1:${values.LOCAL_HYDRA_ADMIN_PORT ?? 4445}/`
            const response = await fetch(new URL(`/admin/clients/${id}`, admin), {
              method: 'DELETE',
              redirect: 'manual',
              signal: AbortSignal.timeout(1000),
            })
            if (!response.ok && response.status !== 404) fail('RETIREMENT_HYDRA_DELETE_FAILED')
          }
        },
        website: async () => {
          verifyReceipt()
          const url = targets.exre,
            db = await connect(url, { purpose: 'website-mutation' })
          try {
            await assertDatabaseIdentity(db, url, plan.databases.exre)
            await cleanRetiredDatabase(db)
          } finally {
            await db.end()
          }
        },
        resources: async () => {
          if (plan.retired.redis) {
            await resourceStep('redisContainer', async () => {
              if (containerExists(plan.retired.redis.id)) {
                const item = inspectContainer(plan.retired.redis.id)
                if (digest(containerProof(item)) !== digest(plan.retired.redis))
                  fail('RETIREMENT_REDIS_PROOF_CHANGED')
                for (const mount of plan.retired.redisMounts) {
                  const consumers = dockerCall([
                    'ps',
                    '-a',
                    '--no-trunc',
                    '--filter',
                    `volume=${mount.Name}`,
                    '--format',
                    '{{.ID}}',
                  ])
                    .trim()
                    .split(/\r?\n/)
                    .filter(Boolean)
                  if (consumers.some((id) => id !== item.Id)) fail('RETIREMENT_REDIS_VOLUME_SHARED')
                }
                progress.redisRemovalIntent = true
                persistProgress()
                dockerCall(['rm', '--force', item.Id])
              } else if (!progress.redisRemovalIntent) fail('RETIREMENT_REDIS_PROOF_CHANGED')
            })
            for (const proof of plan.retired.redisVolumes)
              await resourceStep(`volume:${proof.name}`, async () => {
                const names = dockerCall(['volume', 'ls', '--format', '{{.Name}}'])
                  .trim()
                  .split(/\r?\n/)
                if (!names.includes(proof.name)) {
                  if (!progress[`volumeIntent:${proof.name}`])
                    fail('RETIREMENT_VOLUME_PROOF_CHANGED')
                  return
                }
                const volume = JSON.parse(dockerCall(['volume', 'inspect', proof.name]))[0]
                if (digest(volume) !== proof.digest) fail('RETIREMENT_VOLUME_PROOF_CHANGED')
                const consumers = dockerCall([
                  'ps',
                  '-a',
                  '--no-trunc',
                  '--filter',
                  `volume=${proof.name}`,
                  '--format',
                  '{{.ID}}',
                ]).trim()
                if (consumers) fail('RETIREMENT_REDIS_VOLUME_SHARED')
                progress[`volumeIntent:${proof.name}`] = true
                persistProgress()
                dockerCall(['volume', 'rm', proof.name])
              })
          }
          await resourceStep('storage', async () =>
            removeRetiredStorage(workspace, plan.retired.storage),
          )
          const { default: pg } = await import('pg')
          await resourceStep('outlineDatabase', async () => {
            const url = targets.outlineAdmin,
              admin = await connect(url, { purpose: 'outline-admin-mutation' })
            try {
              verifyReceipt()
              await assertDatabaseIdentity(admin, url, plan.outlineAdmin)
              const database = (
                  await admin.query(
                    'SELECT d.oid::text AS oid,r.rolname AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=$1',
                    ['outline'],
                  )
                ).rows[0],
                owner = database?.owner
              if (
                owner &&
                (owner !== plan.databases.outline.owner ||
                  database.oid !== plan.databases.outline.oid)
              )
                fail('RETIREMENT_DATABASE_OWNER_CONFLICT')
              if (owner) {
                progress.outlineDatabaseIntent = true
                persistProgress()
                await admin.query('DROP DATABASE outline')
              } else if (!progress.outlineDatabaseIntent)
                fail('RETIREMENT_DATABASE_IDENTITY_CONFLICT')
              const role = plan.databases.outline.owner
              if (
                ![
                  plan.databases.exre.owner,
                  plan.databases.hydra.owner,
                  values.POSTGRES_USER ?? 'postgres',
                ].includes(role)
              ) {
                const references = (
                  await admin.query(
                    "SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=(SELECT oid FROM pg_roles WHERE rolname=$1) LIMIT 1",
                    [role],
                  )
                ).rows
                if (!references.length)
                  await admin.query(`DROP ROLE IF EXISTS ${pg.escapeIdentifier(role)}`)
              }
            } finally {
              await admin.end()
            }
          })
          // Preserve the original record and proof; remove only its proven retired entry.
          const dep = join(directory, 'dependencies.json'),
            old = readJson(dep)
          const originalPath = join(directory, 'outline-retirement-original-dependencies.json')
          const original = existsSync(originalPath) ? readJson(originalPath) : old
          if (digest(original) !== plan.dependencyFingerprint)
            fail('RETIREMENT_OWNERSHIP_RECORD_CHANGED')
          const next = {
            ...original,
            proofs: original.proofs.filter((proof) => proof.service !== 'redis'),
            newlyStarted: original.newlyStarted.filter((id) => id !== plan.retired.redis?.id),
          }
          if (digest(old) !== digest(original) && digest(old) !== digest(next))
            fail('RETIREMENT_OWNERSHIP_RECORD_CHANGED')
          await inspect(completedSteps)
          if (!existsSync(originalPath)) atomicJson(originalPath, original)
          atomicJson(dep, next)
        },
        configuration: async () => {
          const converted = retiredConfiguration(values)
          const state = readRuntimeConfiguration({
            workspace,
            inherited: {},
            sourceValues: converted,
          })
          const receipt = join(workspace, '.local/runtime-deployment/identity.json')
          verifyReceipt()
          if (plan.receiptFingerprint !== null) {
            if (readJson(receipt).version === 1) {
              progress.receiptConversion = {
                fromFingerprint: plan.receiptFingerprint,
                toFingerprint: expectedV2Fingerprint,
              }
              persistProgress()
            }
            await convertLegacyBinding(state, values, {
              connect,
              verifyOriginal: async () => {
                await inspect(['resources', 'configuration'])
                for (const client of Object.values(state.clients))
                  await verifyHydraClient({
                    mode: state.profile,
                    publicUrl: state.config.issuer,
                    adminUrl: state.internal.hydra,
                    client,
                  })
              },
            })
          }
          verifyReceipt()
          const backup = join(directory, 'outline-retirement-original.env')
          verifyOriginalEnvironment()
          if (!existsSync(backup))
            writeFileSync(backup, readFileSync(source), { mode: 0o600, flag: 'wx' })
          const temporary = `${source}.retirement.tmp`
          if (existsSync(temporary)) {
            if (readFileSync(temporary, 'utf8') !== serializeEnvironment(converted))
              fail('RETIREMENT_TEMPORARY_CONFLICT')
          } else
            writeFileSync(temporary, serializeEnvironment(converted), { mode: 0o600, flag: 'wx' })
          progress.configurationIntent = digest(serializeEnvironment(converted))
          persistProgress()
          renameSync(temporary, source)
        },
      },
    })
  } finally {
    dependencyLock?.release()
    applicationLock?.release()
    lock.release()
  }
}
export async function main(
  args = process.argv.slice(2),
  { workspace = root, apply = applyRetirementPlan, readPlan = readJson, write = console.log } = {},
) {
  if (args.length > 1 || (args.length === 1 && !['--plan', '--apply'].includes(args[0])))
    fail('RETIREMENT_ARGUMENTS_INVALID')
  const path = join(workspace, '.local/runtime/outline-retirement-plan.json')
  if (args[0] === '--apply') {
    const result = await apply(readPlan(path), { workspace }),
      outcome = retirementOutcome(result.completed)
    write(JSON.stringify(outcome))
    return outcome
  }
  const plan = await buildRetirementPlan({ workspace })
  // --plan is read-only, including the filesystem. Save the reviewed plan explicitly through shell redirection.
  write(JSON.stringify(plan, null, 2))
  return { exitCode: 0 }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await main()
    process.exitCode = result.exitCode
  } catch (error) {
    console.error(error instanceof LocalError ? error.code : 'RETIREMENT_FAILED')
    process.exitCode = 1
  }
}
