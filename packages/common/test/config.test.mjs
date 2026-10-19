import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IdentityConfigError,
  parseIdentityClients,
  parseIdentityDeliveryTargets,
  createIdentityBinding,
  composeIdentityClients,
} from '@workspace/common/node/identity-config'
const client = {
  clientId: 'test-app',
  name: 'Test App',
  redirectUri: 'http://127.0.0.1:9000/callback?exact=true',
  postLogoutRedirectUri: 'http://127.0.0.1:9000/signed-out',
  scopes: ['openid', 'profile', 'email'],
  clientSecret: 'non-hex existing secret',
  integrationKey: 'a'.repeat(64),
  revocation: { url: 'http://127.0.0.1:9000/revoke/session', key: 'b'.repeat(64) },
}
const parse = (value) => parseIdentityClients(JSON.stringify(value), 'local')
test('explicit identity configuration parses and freezes an empty local allowlist', async () => {
  const module = await import('@workspace/common/node/identity-config')
  assert.equal(typeof module.parseIdentityConfiguration, 'function')
  const configuration = module.parseIdentityConfiguration({
    mode: 'local',
    publicOrigin: 'http://127.0.0.1:8080',
    publicOriginVariable: 'SERVER_PUBLIC_WEB_BASE_URL',
    issuer: 'http://127.0.0.1:4444/',
    hydraAdminUrl: 'http://127.0.0.1:4445/',
    bootstrapKey: 'a'.repeat(64),
    flowKey: 'b'.repeat(64),
  })
  assert.deepEqual(configuration.approvedClients, {})
  assert.deepEqual(configuration.cleanupTargets, {})
  assert.deepEqual(configuration.integrationClients, {})
  assert.deepEqual(configuration.deliveryTargets, {})
  assert.equal(configuration.publicOrigin, 'http://127.0.0.1:8080')
  for (const value of [
    configuration,
    configuration.keys,
    configuration.approvedClients,
    configuration.cleanupTargets,
    configuration.integrationClients,
    configuration.deliveryTargets,
  ])
    assert.ok(Object.isFrozen(value))
})
test('explicit identity configuration rejects invalid input shape with a fixed diagnostic', async () => {
  const { parseIdentityConfiguration } = await import('@workspace/common/node/identity-config')
  for (const input of [null, undefined, []])
    assert.throws(
      () => parseIdentityConfiguration(input),
      (error) => {
        assert.ok(error instanceof IdentityConfigError)
        assert.equal(error.message, 'IDENTITY_CONFIG_INVALID:IDENTITY_MODE')
        return true
      },
    )
})
test('explicit identity configuration keeps historical delivery routes separate from client permissions', async () => {
  const { parseIdentityConfiguration } = await import('@workspace/common/node/identity-config')
  const values = {
    mode: 'local',
    publicOrigin: 'http://127.0.0.1:8080/',
    publicOriginVariable: 'PUBLIC_ORIGIN',
    issuer: 'http://127.0.0.1:4444/',
    hydraAdminUrl: 'http://127.0.0.1:4445/',
    bootstrapKey: 'c'.repeat(64),
    flowKey: 'd'.repeat(64),
    clientsJson: JSON.stringify([client]),
    cleanupTargetsJson: JSON.stringify({ 'old-app': { hydraAdminUrl: 'http://127.0.0.1:5555/' } }),
  }
  const parsed = parseIdentityConfiguration(values)
  assert.equal(parsed.publicOrigin, 'http://127.0.0.1:8080')
  assert.deepEqual(Object.keys(parsed.approvedClients), ['test-app'])
  assert.deepEqual(parsed.integrationClients, { 'test-app': client.integrationKey })
  assert.deepEqual(Object.keys(parsed.deliveryTargets), ['old-app', 'test-app'])
  assert.equal(parsed.approvedClients['old-app'], undefined)
  assert.equal(parsed.integrationClients['old-app'], undefined)
  for (const value of [
    parsed.approvedClients['test-app'],
    parsed.approvedClients['test-app'].scopes,
    parsed.approvedClients['test-app'].revocation,
    parsed.cleanupTargets['old-app'],
    parsed.deliveryTargets['test-app'],
    parsed.deliveryTargets['test-app'].revocation,
  ])
    assert.ok(Object.isFrozen(value))
  const same = { hydraAdminUrl: values.hydraAdminUrl, revocation: client.revocation }
  assert.deepEqual(
    parseIdentityConfiguration({
      ...values,
      cleanupTargetsJson: JSON.stringify({ 'test-app': same }),
    }).deliveryTargets['test-app'],
    same,
  )
  for (const conflicting of [
    { hydraAdminUrl: values.hydraAdminUrl },
    { ...same, revocation: { ...client.revocation, key: 'e'.repeat(64) } },
  ])
    assert.throws(
      () =>
        parseIdentityConfiguration({
          ...values,
          cleanupTargetsJson: JSON.stringify({ 'test-app': conflicting }),
        }),
      { message: 'IDENTITY_CONFIG_INVALID:IDENTITY_OUTBOX_TARGETS_JSON' },
    )
  assert.throws(() => parseIdentityConfiguration({ ...values, hydraAdminUrl: values.issuer }), {
    message: 'IDENTITY_CONFIG_INVALID:IDENTITY_MODE',
  })
  assert.throws(
    () => parseIdentityConfiguration({ ...values, publicOriginVariable: 'secret-value' }),
    (error) => {
      assert.equal(error.message, 'IDENTITY_CONFIG_INVALID:IDENTITY_MODE')
      assert.doesNotMatch(error.message, /secret-value/)
      return true
    },
  )
})
test('defaults are empty, clients immutable, query exact and cleanup does not grant authorization', () => {
  assert.deepEqual(parseIdentityClients(undefined, 'local'), {})
  assert.deepEqual(parseIdentityDeliveryTargets(undefined, 'local'), {})
  const clients = parse([client])
  assert.equal(clients['test-app'].redirectUri, client.redirectUri)
  for (const value of [
    clients,
    clients['test-app'],
    clients['test-app'].scopes,
    clients['test-app'].revocation,
  ])
    assert.ok(Object.isFrozen(value))
  const targets = parseIdentityDeliveryTargets(
    JSON.stringify({ 'old-app': { hydraAdminUrl: 'http://127.0.0.1:4445/' } }),
    'local',
  )
  assert.equal(targets['old-app'].hydraAdminUrl, 'http://127.0.0.1:4445/')
  assert.equal(clients['old-app'], undefined)
})
for (const [name, value] of [
  ['duplicate id', [client, client]],
  ['duplicate key', [client, { ...client, clientId: 'second-app' }]],
  [
    'duplicate key with different hex case',
    [
      { ...client, integrationKey: 'a'.repeat(64) },
      { ...client, clientId: 'second-app', integrationKey: 'A'.repeat(64) },
    ],
  ],
  ['object', {}],
  ['null', null],
  ['null client', [null]],
  ['unknown field', [{ ...client, grants: [] }]],
  ...['ex-outline', 'ex-outline-local', '', 'Upper', '0app', 'a'.repeat(65), '__proto__'].map(
    (clientId) => ['invalid id ' + clientId, [{ ...client, clientId }]],
  ),
  ...[[], ['profile'], ['openid', 'openid'], ['openid', 'offline_access'], 'openid', null].map(
    (scopes) => ['invalid scope ' + scopes, [{ ...client, scopes }]],
  ),
  ...['', 'secret\nprivate', null].map((clientSecret) => [
    'invalid secret ' + clientSecret,
    [{ ...client, clientSecret }],
  ]),
  ['empty name', [{ ...client, name: ' ' }]],
  ['control name', [{ ...client, name: 'Test\u007f' }]],
  ['invalid integration key', [{ ...client, integrationKey: 'private' }]],
  ['missing revocation key', [{ ...client, revocation: { url: client.revocation.url } }]],
  ['unknown revocation field', [{ ...client, revocation: { ...client.revocation, other: true } }]],
])
  test('rejects ' + name, () => assert.throws(() => parse(value), IdentityConfigError))
for (const url of [
  'http://localhost:9000/cb',
  'http://127.1:9000/cb',
  'http://127.0.0.1/cb',
  'https://127.0.0.1:9000/cb',
  'http://user:secret@127.0.0.1:9000/cb',
  'http://127.0.0.1:9000/cb#fragment',
  'http://127.0.0.1:9000/cb#',
  'http://127.0.0.1:9000/a/../cb',
  'http://127.0.0.1:9000/a/%2e%2e/cb',
  'http://127.0.0.1:9000/a%2fcb',
  'http://127.0.0.1:9000/a%5ccb',
  'http://127.0.0.1:9000/a%252ecb',
  'http://127.0.0.1:9000/cb*',
  'http://127.0.0.1:9000/cb\n',
  'http://127.0.0.1:9000/cb%00',
  'http://127.0.0.1:9000\\cb',
  'http://127.0.0.1:9000//cb',
]) {
  test('rejects ambiguous/local unsafe endpoint ' + JSON.stringify(url), () => {
    assert.throws(() => parse([{ ...client, redirectUri: url }]), IdentityConfigError)
    assert.throws(() => parse([{ ...client, postLogoutRedirectUri: url }]), IdentityConfigError)
  })
}
test('revocation forbids query, including empty query, and retains explicit endpoint path', () => {
  for (const url of [client.revocation.url + '?x=y', client.revocation.url + '?'])
    assert.throws(
      () => parse([{ ...client, revocation: { ...client.revocation, url } }]),
      IdentityConfigError,
    )
  assert.equal(parse([client])['test-app'].revocation.url, client.revocation.url)
})
test('deployment callback and app notification require HTTPS, with private HTTP Hydra admin retained', () => {
  const secure = {
    ...client,
    redirectUri: 'https://app.example/callback?x=y',
    postLogoutRedirectUri: 'https://app.example/logout',
    revocation: { ...client.revocation, url: 'https://app.example/internal/revoke' },
  }
  assert.equal(
    parseIdentityClients(JSON.stringify([secure]), 'deployment')['test-app'].redirectUri,
    secure.redirectUri,
  )
  assert.throws(
    () => parseIdentityClients(JSON.stringify([client]), 'deployment'),
    IdentityConfigError,
  )
  assert.deepEqual(
    parseIdentityDeliveryTargets(
      '{"old-app":{"hydraAdminUrl":"http://hydra:4445/"}}',
      'deployment',
    ),
    { 'old-app': { hydraAdminUrl: 'http://hydra:4445/' } },
  )
})
for (const raw of [
  '[]',
  'null',
  '{"old-app":null}',
  '{"old-app":{"hydraAdminUrl":"http://127.0.0.1:4445/","integrationKey":"private"}}',
  '{"old-app":{"hydraAdminUrl":"http://127.0.0.1:4445/path"}}',
  '{"old-app":{"hydraAdminUrl":"http://127.0.0.1:4445/","revocation":{"url":"http://127.0.0.1:9000/revoke","key":"private"}}}',
]) {
  test('rejects invalid cleanup target ' + raw, () =>
    assert.throws(() => parseIdentityDeliveryTargets(raw, 'local'), IdentityConfigError),
  )
}

test('rejects empty userinfo on deployment endpoints', () => {
  const secure = {
    ...client,
    redirectUri: 'https://@app.example/callback',
    postLogoutRedirectUri: 'https://app.example/out',
    revocation: undefined,
  }
  assert.throws(
    () => parseIdentityClients(JSON.stringify([secure]), 'deployment'),
    IdentityConfigError,
  )
})

test('shared composition keeps cleanup-only identities out of internal capabilities', () => {
  const clients = parse([client]),
    cleanup = parseIdentityDeliveryTargets(
      '{"old-app":{"hydraAdminUrl":"http://127.0.0.1:4446/"}}',
      'local',
    )
  const result = composeIdentityClients(clients, cleanup, 'http://127.0.0.1:4445/')
  assert.deepEqual(result.integrationClients, { 'test-app': client.integrationKey })
  assert.equal(result.deliveryTargets['old-app'].hydraAdminUrl, 'http://127.0.0.1:4446/')
  assert.equal(result.deliveryTargets['test-app'].revocation.url, client.revocation.url)
  assert.throws(
    () =>
      composeIdentityClients(
        clients,
        { 'test-app': { hydraAdminUrl: 'http://127.0.0.1:9999/' } },
        'http://127.0.0.1:4445/',
      ),
    IdentityConfigError,
  )
})
test('receipt is deterministic for client and scope reordering and exposes no raw secrets', () => {
  const input = {
    websiteTarget: {
      host: 'postgres',
      port: 5432,
      user: 'website',
      database: 'exre',
      verifiedDatabase: 'exre',
    },
    issuer: 'https://issuer.example/',
    publicOrigin: 'https://site.example',
    hydraAdminUrl: 'http://hydra:4445/',
    clients: parse([client, { ...client, clientId: 'another-app', integrationKey: undefined }]),
    cleanupTargets: {},
    flowKey: 'c'.repeat(64),
    bootstrapKey: 'd'.repeat(64),
  }
  const first = createIdentityBinding(input)
  const second = createIdentityBinding({
    ...input,
    clients: parse([
      {
        ...client,
        clientId: 'another-app',
        integrationKey: undefined,
        scopes: [...client.scopes].reverse(),
      },
      { ...client, scopes: [...client.scopes].reverse() },
    ]),
  })
  assert.deepEqual(first, second)
  const serialized = JSON.stringify(first)
  for (const secret of [
    client.clientSecret,
    client.integrationKey,
    client.revocation.key,
    input.flowKey,
    input.bootstrapKey,
  ])
    assert.ok(!serialized.includes(secret))
  assert.deepEqual(
    first.clients.map((value) => value.clientId),
    ['another-app', 'test-app'],
  )
  assert.equal(first.clients[0].integrationKeyFingerprint, null)
})
