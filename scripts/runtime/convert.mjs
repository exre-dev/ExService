import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parseEnv } from 'node:util'
import { environmentFile, databaseUrl } from './settings.mjs'
import { verifyHydraClient } from './hydra-client.mjs'
import {
  parseIdentityClients,
  parseIdentityDeliveryTargets,
  composeIdentityClients,
} from '@workspace/common/node/identity-config'
import { root } from './shared.mjs'
import { RuntimeError, diagnostic } from './output.mjs'

const parameters = {
  sslmode: 'SSLMODE',
  sslrootcert: 'SSLROOTCERT',
  connect_timeout: 'CONNECT_TIMEOUT',
  options: 'OPTIONS',
}

/** Pure conversion preserves endpoints, secrets, unknown keys and supported connection semantics. */
export function convertValues(original, { includeRetired = false } = {}) {
  const values = { ...original },
    conflicts = []
  const set = (key, value) => {
    if (values[key] !== undefined && values[key] !== value) conflicts.push(key)
    else values[key] = value
  }
  for (const [prefix, name] of [
    ['DATABASE', 'exre'],
    ...(includeRetired ? [['OUTLINE_DATABASE', 'outline']] : []),
    ['HYDRA_DATABASE', 'hydra'],
  ]) {
    const oldKey = `${prefix}_URL`
    let value = values[oldKey]
    if (!value && prefix !== 'DATABASE' && values[`${name.toUpperCase()}_PASSWORD`]) {
      const port = values.LOCAL_POSTGRES_PORT ?? '17432'
      value = `postgresql://127.0.0.1:${port}/${name}`
      const url = new URL(value)
      url.username = name
      url.password = encodeURIComponent(values[`${name.toUpperCase()}_PASSWORD`])
      url.searchParams.set('sslmode', 'disable')
      value = url.href
    }
    if (!value) continue
    let url
    try {
      url = new URL(value)
    } catch {
      throw new RuntimeError('CONVERSION_URL_INVALID', { keys: [oldKey] })
    }
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.pathname !== `/${name}` ||
      url.hash ||
      !url.hostname ||
      !url.username
    )
      throw new RuntimeError('CONVERSION_DATABASE_INVALID', { keys: [oldKey] })
    try {
      for (const [field, value] of [
        ['HOST', url.hostname],
        ['PORT', url.port || '5432'],
        ['NAME', name],
        ['USER', decodeURIComponent(url.username)],
        ['PASSWORD', decodeURIComponent(url.password)],
      ])
        set(`${prefix}_${field}`, value)
    } catch {
      throw new RuntimeError('CONVERSION_ENCODING_INVALID', { keys: [oldKey] })
    }
    const seen = new Set()
    for (const [parameter, value] of url.searchParams) {
      if (!parameters[parameter] || seen.has(parameter))
        throw new RuntimeError('CONVERSION_OPTION_UNSUPPORTED', { keys: [oldKey] })
      seen.add(parameter)
      set(`${prefix}_${parameters[parameter]}`, value)
    }
    delete values[oldKey]
  }
  for (const [old, current] of [
    ...(includeRetired ? [['OUTLINE_PASSWORD', 'OUTLINE_DATABASE_PASSWORD']] : []),
    ['HYDRA_PASSWORD', 'HYDRA_DATABASE_PASSWORD'],
  ]) {
    if (values[old] !== undefined) {
      set(current, values[old])
      delete values[old]
    }
  }
  if (conflicts.length)
    throw new RuntimeError('CONVERSION_FIELD_CONFLICT', { keys: [...new Set(conflicts)] })
  // Preserve old ports/issuer explicitly: configuration conversion is not an identity migration.
  for (const [key, value] of Object.entries({
    LOCAL_POSTGRES_PORT: '17432',
    LOCAL_HYDRA_PUBLIC_PORT: '14444',
    LOCAL_HYDRA_ADMIN_PORT: '14447',
  }))
    if (original.RUNTIME_CONFIG_VERSION && values[key] === undefined) values[key] = value
  delete values.RUNTIME_CONFIG_VERSION
  delete values.EXUI_SOURCE_DIR
  delete values.IDENTITY_DEPLOYMENT_RECEIPT_FILE
  if (values.VITE_API_BASE_URL !== undefined && values.VITE_API_BASE_URL !== '/api')
    throw new RuntimeError('CONVERSION_FIELD_CONFLICT', { keys: ['VITE_API_BASE_URL'] })
  delete values.VITE_API_BASE_URL
  return values
}

export function serializeEnvironment(values) {
  const content =
    Object.entries(values)
      .map(([key, value]) => {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || /[\u0000\r\n]/.test(value))
          throw new RuntimeError('CONVERSION_ENV_INVALID', { keys: [key] })
        for (const quote of ['"', "'", '`']) {
          if (value.includes(quote)) continue
          const line = `${key}=${quote}${value}${quote}`
          if (parseEnv(line)[key] === value) return line
        }
        throw new RuntimeError('CONVERSION_QUOTING_UNSUPPORTED', { keys: [key] })
      })
      .join('\n') + '\n'
  const parsed = parseEnv(content)
  if (
    Object.keys(parsed).length !== Object.keys(values).length ||
    Object.entries(values).some(([key, value]) => parsed[key] !== value)
  )
    throw new RuntimeError('CONVERSION_ENV_ROUNDTRIP_FAILED')
  return content
}

/** Explicit file-only maintenance. Verify the old target before replacing root settings. */
export async function convertConfiguration({ workspace = root, verify } = {}) {
  const file = join(workspace, '.env.local'),
    original = readFileSync(file, 'utf8')
  const values = environmentFile(file),
    converted = convertValues(values),
    content = serializeEnvironment(converted)
  if (JSON.stringify(converted) === JSON.stringify(values)) return { changed: false }
  await (verify ?? verifyOriginalTargets)(values, converted)
  if (readFileSync(file, 'utf8') !== original) throw new RuntimeError('CONVERSION_SOURCE_CHANGED')
  const backupDirectory = join(workspace, '.local/runtime/config-backups')
  mkdirSync(backupDirectory, { recursive: true })
  const backup = join(backupDirectory, `${randomUUID()}.env`),
    temporary = `${file}.runtime-${randomUUID()}.tmp`
  writeFileSync(backup, original, { mode: 0o600, flag: 'wx' })
  try {
    writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' })
    if (readFileSync(file, 'utf8') !== original) throw new RuntimeError('CONVERSION_SOURCE_CHANGED')
    renameSync(temporary, file)
  } catch (error) {
    try {
      unlinkSync(temporary)
    } catch {}
    throw error
  }
  return { changed: true, backup }
}

/** Verify every original database and routing identity without delivering or changing records. */
export async function verifyOriginalTargets(
  original,
  converted = convertValues(original),
  { connect, verifyClient = verifyHydraClient } = {},
) {
  const factory =
    connect ??
    (async (url) => {
      const { default: pg } = await import('pg')
      const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 })
      await client.connect()
      return client
    })
  for (const key of [
    'PUBLIC_ORIGIN',
    'HYDRA_PUBLIC_URL',
    'HYDRA_ADMIN_URL',
    'IDENTITY_CLIENTS_JSON',
    'IDENTITY_OUTBOX_TARGETS_JSON',
    'IDENTITY_FLOW_KEY',
    'IDENTITY_BOOTSTRAP_KEY',
    'HYDRA_SYSTEM_SECRET',
  ])
    if (original[key] !== converted[key])
      throw new RuntimeError('CONVERSION_IDENTITY_CONFLICT', { keys: [key] })
  const issuer =
    converted.HYDRA_PUBLIC_URL ?? `http://127.0.0.1:${converted.LOCAL_HYDRA_PUBLIC_PORT ?? 4444}/`
  const adminUrl =
    converted.HYDRA_ADMIN_URL ?? `http://127.0.0.1:${converted.LOCAL_HYDRA_ADMIN_PORT ?? 4445}/`
  const clients = parseIdentityClients(converted.IDENTITY_CLIENTS_JSON, converted.RUNTIME_PROFILE)
  const targets = composeIdentityClients(
    clients,
    parseIdentityDeliveryTargets(converted.IDENTITY_OUTBOX_TARGETS_JSON, converted.RUNTIME_PROFILE),
    adminUrl,
  ).deliveryTargets
  for (const [prefix, name] of [
    ['DATABASE', 'exre'],
    ['HYDRA_DATABASE', 'hydra'],
  ]) {
    let client
    try {
      client = await factory(
        databaseUrl(converted, prefix, name, Number(converted.LOCAL_POSTGRES_PORT ?? 5432)),
      )
      await client.query('BEGIN READ ONLY')
      const identity = (
        await client.query('SELECT current_database() AS name, current_user AS owner')
      ).rows[0]
      if (identity?.name !== name || identity.owner !== converted[`${prefix}_USER`])
        throw new RuntimeError('CONVERSION_DATABASE_IDENTITY_CONFLICT', { service: name })
      if (name !== 'exre') {
        const owner = (
          await client.query(
            'SELECT r.rolname AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=$1',
            [name],
          )
        ).rows[0]
        if (owner?.owner !== identity.owner)
          throw new RuntimeError('CONVERSION_DATABASE_OWNER_CONFLICT', { service: name })
      }
      if (
        name === 'exre' &&
        (await client.query("SELECT to_regclass('public.auth_identity_outbox') AS name")).rows[0]
          ?.name
      ) {
        const pending = (
          await client.query(
            'SELECT target_bindings FROM auth_identity_outbox WHERE completed_at IS NULL',
          )
        ).rows
        for (const row of pending)
          for (const target of JSON.parse(row.target_bindings)) {
            const retained = targets[target.clientId]
            if (
              !retained ||
              ['hydraAdminUrl'].some(
                (key) => target[key] !== undefined && target[key] !== retained[key],
              ) ||
              (target.revocation !== undefined &&
                JSON.stringify(target.revocation) !== JSON.stringify(retained.revocation)) ||
              target.outlineInternalUrl !== undefined ||
              target.deliveryKey !== undefined
            )
              throw new RuntimeError('CONVERSION_OLD_IDENTITY_PENDING', {
                service: 'Website',
                next: '保留完整原目标并先投递原 pending 撤销事件；不要替换为新地址或新密钥',
              })
          }
      }
      await client.query('ROLLBACK')
    } catch (error) {
      throw diagnostic(error, {
        service: name,
        phase: '原目标转换前核验',
        keys: [`${prefix}_HOST`, `${prefix}_PORT`, `${prefix}_USER`, `${prefix}_PASSWORD`],
      })
    } finally {
      await client?.end().catch(() => {})
    }
  }
  for (const client of Object.values(clients))
    await verifyClient({ mode: converted.RUNTIME_PROFILE, publicUrl: issuer, adminUrl, client })
}
