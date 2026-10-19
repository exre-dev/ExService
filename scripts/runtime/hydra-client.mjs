import { parseIdentityClients, parseIdentityUrl } from '@workspace/common/node/identity-config'
import { createHash, randomBytes } from 'node:crypto'

const checkMessages = Object.freeze({
  CLIENT_MISSING: 'Hydra client is not registered',
  CLIENT_CONFLICT: 'Hydra client configuration differs',
  CREDENTIAL_PROBE_FAILED: 'Hydra credential probe failed',
  INVALID_CONFIG: 'Invalid Hydra client configuration',
  NETWORK_FAILURE: 'Hydra request failed',
  CHECK_FAILED: 'Hydra client check failed',
})

export class HydraClientCheckError extends Error {
  constructor(kind, { cause } = {}) {
    if (!Object.hasOwn(checkMessages, kind)) throw new TypeError('Invalid Hydra client check kind')
    super(checkMessages[kind], cause === undefined ? undefined : { cause })
    this.name = 'HydraClientCheckError'
    Object.defineProperty(this, 'kind', { value: kind, enumerable: true })
  }
}

async function fetchHydra(url, options) {
  try {
    return await fetch(url, options)
  } catch (cause) {
    throw new HydraClientCheckError('NETWORK_FAILURE', { cause })
  }
}

async function responseJson(response) {
  try {
    return await response.json()
  } catch {
    throw new HydraClientCheckError('CHECK_FAILED')
  }
}

/** OAuth Basic credentials encode each original field as form data before Base64. */
export function hydraClientBasic(clientId, clientSecret) {
  const formField = (value) => new URLSearchParams({ value }).toString().slice('value='.length)
  return `Basic ${Buffer.from(`${formField(clientId)}:${formField(clientSecret)}`).toString('base64')}`
}

/** Provisions a fixed confidential OIDC client without widening existing grants. */
export async function ensureHydraClient(options) {
  return checkHydraClient(options, true)
}
/** Runtime verification can never provision a missing client. */
export async function verifyHydraClient(options) {
  return checkHydraClient(options, false)
}
async function checkHydraClient({ adminUrl, publicUrl, client: input, mode }, create) {
  let client, base, issuer
  try {
    client = Object.values(parseIdentityClients(JSON.stringify([input]), mode))[0]
    base = new URL(parseIdentityUrl(adminUrl, mode, 'HYDRA_ADMIN_URL', { root: true, admin: true }))
    issuer = new URL(parseIdentityUrl(publicUrl, mode, 'HYDRA_PUBLIC_URL', { root: true }))
  } catch {
    throw new HydraClientCheckError('INVALID_CONFIG')
  }
  const { clientId, clientSecret } = client
  const desired = {
    client_id: clientId,
    client_name: client.name,
    client_secret: clientSecret,
    redirect_uris: [client.redirectUri],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    scope: client.scopes.join(' '),
    subject_type: 'public',
    token_endpoint_auth_method: 'client_secret_basic',
    post_logout_redirect_uris: [client.postLogoutRedirectUri],
    authorization_code_grant_access_token_lifespan: '60s',
    authorization_code_grant_id_token_lifespan: '60s',
    metadata: {
      integration: 'website-identity',
      issuer: issuer.href,
      secretFingerprint: createHash('sha256').update(clientSecret).digest('hex'),
    },
  }
  const request = (path, options = {}) =>
    fetchHydra(new URL(path, base), {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(1000),
    })
  let response = await request(`/admin/clients/${clientId}`)
  if (response.status === 404 && !create) throw new HydraClientCheckError('CLIENT_MISSING')
  if (response.status === 404 && create) {
    response = await request('/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(desired),
    })
    // A competing bootstrap may have created the same client. Recheck exact state.
    if (response.status === 409) response = await request(`/admin/clients/${clientId}`)
  }
  if (!response.ok) throw new HydraClientCheckError('CHECK_FAILED')
  const actual = await responseJson(response)
  if (
    !actual ||
    typeof actual !== 'object' ||
    Array.isArray(actual) ||
    typeof actual.scope !== 'string'
  )
    throw new HydraClientCheckError('CHECK_FAILED')
  const lists = ['redirect_uris', 'grant_types', 'response_types', 'post_logout_redirect_uris']
  const scalars = ['client_id', 'subject_type', 'token_endpoint_auth_method']
  const lifespans = [
    'authorization_code_grant_access_token_lifespan',
    'authorization_code_grant_id_token_lifespan',
  ]
  const equalList = (left, right) =>
    Array.isArray(left) &&
    Array.isArray(right) &&
    JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
  if (
    lists.some((key) => !equalList(actual[key], desired[key])) ||
    scalars.some((key) => actual[key] !== desired[key]) ||
    lifespans.some((key) => !['60s', '1m0s'].includes(actual[key])) ||
    !equalList(actual.scope?.split(/\s+/), desired.scope.split(' ')) ||
    Object.entries(desired.metadata).some(([key, value]) => actual.metadata?.[key] !== value) ||
    ['allowed_cors_origins', 'audience'].some((key) => actual[key]?.length) ||
    ['frontchannel_logout_uri', 'backchannel_logout_uri', 'jwks_uri'].some((key) => actual[key])
  ) {
    throw new HydraClientCheckError('CLIENT_CONFLICT')
  }
  // A non-existent random code cannot issue a token, but proves the stored client secret
  // is valid. Hydra does not return stored secrets through its administrative GET API.
  const probe = await fetchHydra(new URL('/oauth2/token', publicUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: hydraClientBasic(clientId, clientSecret),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: randomBytes(32).toString('base64url'),
      redirect_uri: desired.redirect_uris[0],
      code_verifier: randomBytes(32).toString('base64url'),
    }),
    redirect: 'manual',
    signal: AbortSignal.timeout(1000),
  })
  const result = await responseJson(probe)
  if (probe.status !== 400 || result?.error !== 'invalid_grant') {
    throw new HydraClientCheckError('CREDENTIAL_PROBE_FAILED')
  }
  return { clientId: desired.client_id }
}
