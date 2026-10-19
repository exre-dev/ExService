import { createHash } from 'node:crypto'

/** Fixed errors never include configuration values or nested parser messages. */
export class IdentityConfigError extends Error {
  code = 'IDENTITY_CONFIG_INVALID'
  constructor(variable) {
    super(`IDENTITY_CONFIG_INVALID:${variable}`)
    this.variable = variable
    this.name = 'IdentityConfigError'
  }
}
const retiredIds = new Set(['ex-outline', 'ex-outline-local'])
const control = /[\u0000-\u001f\u007f-\u009f]/u
const byId = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
export const isIdentityClientId = (value) =>
  typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value)
const fail = (variable) => {
  throw new IdentityConfigError(variable)
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const fields = (value, allowed, variable) => {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key))) fail(variable)
}
const text = (value, variable) => {
  if (typeof value !== 'string' || !value.trim() || control.test(value)) fail(variable)
  return value
}
export function parseIdentityKey(value, variable) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) fail(variable)
  return value
}
const modeCheck = (mode) => {
  if (!['local', 'deployment'].includes(mode)) fail('IDENTITY_MODE')
}

/** Preserve exact endpoint/query spelling while refusing URL normalization traps. */
export function parseIdentityUrl(
  value,
  mode,
  variable,
  { root = false, query = true, admin = false } = {},
) {
  modeCheck(mode)
  if (typeof value !== 'string' || /[\s\\*]/u.test(value) || control.test(value)) fail(variable)
  let url
  try {
    url = new URL(value)
  } catch {
    fail(variable)
  }
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?$/.exec(value)
  if (
    !match ||
    match[2].includes('@') ||
    url.username ||
    url.password ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol)
  )
    fail(variable)
  const path = match[3] || '/'
  let decoded
  try {
    decoded = decodeURIComponent(path)
  } catch {
    fail(variable)
  }
  if (
    path !== url.pathname ||
    /%(?:2f|5c|25)/i.test(path) ||
    control.test(decoded) ||
    decoded.split('/').some((part) => part === '.' || part === '..') ||
    decoded.includes('//') ||
    (root && (path !== '/' || url.search || match[4])) ||
    (!query && match[4])
  )
    fail(variable)
  if (mode === 'local') {
    if (
      url.protocol !== 'http:' ||
      !/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(match[2]) ||
      Number(match[2].split(':')[1]) > 65535
    )
      fail(variable)
  } else if (!admin && url.protocol !== 'https:') fail(variable)
  return root ? url.href : value
}
const decode = (raw, fallback, variable) => {
  if (raw === undefined) return fallback
  if (typeof raw !== 'string') fail(variable)
  try {
    return JSON.parse(raw)
  } catch {
    fail(variable)
  }
}
function revocation(value, mode, variable) {
  fields(value, ['url', 'key'], variable)
  return Object.freeze({
    url: parseIdentityUrl(value.url, mode, variable, { query: false }),
    key: parseIdentityKey(value.key, variable),
  })
}

/** An explicit allowlist; no built-in clients or historical authorization. */
export function parseIdentityClients(raw, mode) {
  modeCheck(mode)
  const variable = 'IDENTITY_CLIENTS_JSON',
    decoded = decode(raw, [], variable)
  if (!Array.isArray(decoded)) fail(variable)
  const clients = {},
    integrationKeys = new Set()
  for (const value of decoded) {
    fields(
      value,
      [
        'clientId',
        'name',
        'redirectUri',
        'postLogoutRedirectUri',
        'scopes',
        'clientSecret',
        'integrationKey',
        'revocation',
      ],
      variable,
    )
    const { clientId } = value
    if (
      !isIdentityClientId(clientId) ||
      retiredIds.has(clientId) ||
      Object.hasOwn(clients, clientId)
    )
      fail(variable)
    if (
      !Array.isArray(value.scopes) ||
      !value.scopes.includes('openid') ||
      new Set(value.scopes).size !== value.scopes.length ||
      value.scopes.some((scope) => !['openid', 'profile', 'email'].includes(scope))
    )
      fail(variable)
    const client = {
      clientId,
      name: text(value.name, variable),
      redirectUri: parseIdentityUrl(value.redirectUri, mode, variable),
      postLogoutRedirectUri: parseIdentityUrl(value.postLogoutRedirectUri, mode, variable),
      scopes: Object.freeze([...value.scopes].sort()),
      clientSecret: text(value.clientSecret, variable),
    }
    if (value.integrationKey !== undefined) {
      client.integrationKey = parseIdentityKey(value.integrationKey, variable)
      const comparable = client.integrationKey.toLowerCase()
      if (integrationKeys.has(comparable)) fail(variable)
      integrationKeys.add(comparable)
    }
    if (value.revocation !== undefined)
      client.revocation = revocation(value.revocation, mode, variable)
    clients[clientId] = Object.freeze(client)
  }
  return Object.freeze(Object.fromEntries(Object.entries(clients).sort(byId)))
}

/** Cleanup-only routes; callers must never use this map as an authorization list. */
export function parseIdentityDeliveryTargets(raw, mode) {
  modeCheck(mode)
  const variable = 'IDENTITY_OUTBOX_TARGETS_JSON',
    decoded = decode(raw, {}, variable)
  if (!record(decoded)) fail(variable)
  const targets = {}
  for (const [clientId, value] of Object.entries(decoded)) {
    if (!isIdentityClientId(clientId)) fail(variable)
    fields(value, ['hydraAdminUrl', 'revocation'], variable)
    const target = {
      hydraAdminUrl: parseIdentityUrl(value.hydraAdminUrl, mode, variable, {
        root: true,
        admin: true,
      }),
    }
    if (value.revocation !== undefined)
      target.revocation = revocation(value.revocation, mode, variable)
    targets[clientId] = Object.freeze(target)
  }
  return Object.freeze(Object.fromEntries(Object.entries(targets).sort(byId)))
}

/** Separate internal caller capabilities from delivery-only historical routes. */
export function composeIdentityClients(clients, cleanupTargets, hydraAdminUrl) {
  const deliveryTargets = { ...cleanupTargets },
    integrationClients = {}
  for (const [clientId, client] of Object.entries(clients)) {
    const current = Object.freeze({
      hydraAdminUrl,
      ...(client.revocation ? { revocation: client.revocation } : {}),
    })
    const cleanup = Object.hasOwn(cleanupTargets, clientId) ? cleanupTargets[clientId] : undefined
    if (
      cleanup &&
      (cleanup.hydraAdminUrl !== current.hydraAdminUrl ||
        cleanup.revocation?.url !== current.revocation?.url ||
        cleanup.revocation?.key !== current.revocation?.key)
    )
      fail('IDENTITY_OUTBOX_TARGETS_JSON')
    deliveryTargets[clientId] = current
    if (client.integrationKey) integrationClients[clientId] = client.integrationKey
  }
  return Object.freeze({
    integrationClients: Object.freeze(
      Object.fromEntries(Object.entries(integrationClients).sort(byId)),
    ),
    deliveryTargets: Object.freeze(Object.fromEntries(Object.entries(deliveryTargets).sort(byId))),
  })
}

/** Parse one explicit identity configuration without reading its source or runtime state. */
export function parseIdentityConfiguration(input) {
  if (!record(input)) fail('IDENTITY_MODE')
  const {
    mode,
    publicOrigin,
    publicOriginVariable,
    issuer,
    hydraAdminUrl,
    bootstrapKey,
    flowKey,
    clientsJson,
    cleanupTargetsJson,
  } = input
  modeCheck(mode)
  if (!['SERVER_PUBLIC_WEB_BASE_URL', 'PUBLIC_ORIGIN'].includes(publicOriginVariable))
    fail('IDENTITY_MODE')
  const parsedPublicOrigin = new URL(
    parseIdentityUrl(publicOrigin, mode, publicOriginVariable, { root: true }),
  ).origin
  const parsedIssuer = parseIdentityUrl(issuer, mode, 'HYDRA_PUBLIC_URL', { root: true })
  const parsedHydraAdminUrl = parseIdentityUrl(hydraAdminUrl, mode, 'HYDRA_ADMIN_URL', {
    root: true,
    admin: true,
  })
  if (
    mode === 'local' &&
    new Set([parsedPublicOrigin, new URL(parsedIssuer).origin, new URL(parsedHydraAdminUrl).origin])
      .size !== 3
  )
    fail('IDENTITY_MODE')
  const keys = Object.freeze({
    bootstrap: parseIdentityKey(bootstrapKey, 'IDENTITY_BOOTSTRAP_KEY'),
    flow: parseIdentityKey(flowKey, 'IDENTITY_FLOW_KEY'),
  })
  const approvedClients = parseIdentityClients(clientsJson, mode)
  const cleanupTargets = parseIdentityDeliveryTargets(cleanupTargetsJson, mode)
  const { integrationClients, deliveryTargets } = composeIdentityClients(
    approvedClients,
    cleanupTargets,
    parsedHydraAdminUrl,
  )
  return Object.freeze({
    mode,
    publicOrigin: parsedPublicOrigin,
    issuer: parsedIssuer,
    hydraAdminUrl: parsedHydraAdminUrl,
    keys,
    approvedClients,
    cleanupTargets,
    integrationClients,
    deliveryTargets,
  })
}

/** Project already-validated configuration into the shared, secret-free v2 receipt. */
export function createIdentityBinding({
  websiteTarget,
  issuer,
  publicOrigin,
  hydraAdminUrl,
  clients,
  cleanupTargets,
  flowKey,
  bootstrapKey,
}) {
  const fingerprint = (value) => createHash('sha256').update(value).digest('hex')
  const route = (value) =>
    value
      ? Object.freeze({
          url: value.url,
          keyFingerprint: fingerprint(value.key),
        })
      : null
  return Object.freeze({
    version: 2,
    websiteTarget: Object.freeze({ ...websiteTarget }),
    issuer,
    publicOrigin,
    hydraAdminUrl,
    clients: Object.freeze(
      Object.entries(clients)
        .sort(byId)
        .map(([clientId, client]) =>
          Object.freeze({
            clientId,
            name: client.name,
            redirectUri: client.redirectUri,
            postLogoutRedirectUri: client.postLogoutRedirectUri,
            scopes: Object.freeze([...client.scopes].sort()),
            clientSecretFingerprint: fingerprint(client.clientSecret),
            integrationKeyFingerprint:
              client.integrationKey === undefined ? null : fingerprint(client.integrationKey),
            revocation: route(client.revocation),
          }),
        ),
    ),
    cleanupTargets: Object.freeze(
      Object.entries(cleanupTargets)
        .sort(byId)
        .map(([clientId, target]) =>
          Object.freeze({
            clientId,
            hydraAdminUrl: target.hydraAdminUrl,
            revocation: route(target.revocation),
          }),
        ),
    ),
    flowKeyFingerprint: fingerprint(flowKey),
    bootstrapKeyFingerprint: fingerprint(bootstrapKey),
  })
}
