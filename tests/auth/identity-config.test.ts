import { expect, it } from 'vitest'
import { IdentityConfigError, parseIdentityConfig } from '@server/src/modules/identity/config'
import {
  createIdentityBinding,
  parseIdentityClients,
  parseIdentityDeliveryTargets,
} from '@workspace/common/node/identity-config'
import { readRuntimeConfiguration } from '../../scripts/runtime/settings.mjs'
import { deploymentBinding } from '../../scripts/runtime/deployment.mjs'
import { digest } from '../../scripts/runtime/local-config.mjs'

const local = {
  IDENTITY_ENABLED: 'true',
  IDENTITY_MODE: 'local',
  SERVER_PUBLIC_WEB_BASE_URL: 'http://127.0.0.1:8080',
  HYDRA_PUBLIC_URL: 'http://127.0.0.1:4444/',
  HYDRA_ADMIN_URL: 'http://127.0.0.1:4445/',
  IDENTITY_FLOW_KEY: 'a'.repeat(64),
  IDENTITY_BOOTSTRAP_KEY: 'b'.repeat(64),
}
const client = {
  clientId: 'test-app',
  name: 'Test App',
  redirectUri: 'http://127.0.0.1:9000/callback?exact=true',
  postLogoutRedirectUri: 'http://127.0.0.1:9000/signed-out',
  scopes: ['openid', 'email'],
  clientSecret: 'existing non-hex secret',
  integrationKey: 'c'.repeat(64),
  revocation: { url: 'http://127.0.0.1:9000/internal/revoke', key: 'd'.repeat(64) },
}

it('enables independent identity with no clients or Outline configuration', () => {
  for (const IDENTITY_CLIENTS_JSON of [undefined, '[]']) {
    expect(parseIdentityConfig({ ...local, IDENTITY_CLIENTS_JSON })).toMatchObject({
      enabled: true,
      approvedClients: {},
      integrationClients: {},
      deliveryTargets: {},
    })
  }
  expect(
    parseIdentityConfig({ ...local, OUTLINE_INTEGRATION_KEY: 'retired invalid value' }),
  ).toMatchObject({ enabled: true })
  expect(parseIdentityConfig({})).toEqual({ enabled: false })
  expect(parseIdentityConfig({ IDENTITY_ENABLED: 'false' })).toEqual({ enabled: false })
})
it('uses the same parsers and projects only explicit internal permissions', () => {
  const second = {
    ...client,
    clientId: 'another-app',
    integrationKey: undefined,
    revocation: undefined,
  }
  const raw = JSON.stringify([client, second]),
    old = { 'old-app': { hydraAdminUrl: 'http://127.0.0.1:5555/' } }
  const config = parseIdentityConfig({
    ...local,
    IDENTITY_CLIENTS_JSON: raw,
    IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify(old),
  })
  if (!config.enabled) throw new Error('expected enabled')
  expect(config.approvedClients).toEqual(parseIdentityClients(raw, 'local'))
  expect(config.cleanupTargets).toEqual(parseIdentityDeliveryTargets(JSON.stringify(old), 'local'))
  expect(config.integrationClients).toEqual({ 'test-app': client.integrationKey })
  expect(config.deliveryTargets['another-app']).toEqual({ hydraAdminUrl: local.HYDRA_ADMIN_URL })
  expect(config.deliveryTargets['test-app']).toEqual({
    hydraAdminUrl: local.HYDRA_ADMIN_URL,
    revocation: client.revocation,
  })
  expect(config.approvedClients['old-app']).toBeUndefined()
  expect(config.integrationClients['old-app']).toBeUndefined()
  for (const value of [
    config,
    config.keys,
    config.approvedClients,
    config.approvedClients['test-app'],
    config.approvedClients['test-app']!.scopes,
    config.approvedClients['test-app']!.revocation,
    config.integrationClients,
    config.cleanupTargets,
    config.deliveryTargets,
  ])
    expect(Object.isFrozen(value)).toBe(true)
})
it('requires an identical target when active and cleanup-only IDs overlap', () => {
  const current = { hydraAdminUrl: local.HYDRA_ADMIN_URL, revocation: client.revocation }
  const env = { ...local, IDENTITY_CLIENTS_JSON: JSON.stringify([client]) }
  expect(() =>
    parseIdentityConfig({
      ...env,
      IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({ 'test-app': current }),
    }),
  ).not.toThrow()
  for (const target of [
    { ...current, hydraAdminUrl: 'http://127.0.0.1:5555/' },
    { hydraAdminUrl: local.HYDRA_ADMIN_URL },
    { ...current, revocation: { ...client.revocation, key: 'e'.repeat(64) } },
  ]) {
    expect(() =>
      parseIdentityConfig({
        ...env,
        IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({ 'test-app': target }),
      }),
    ).toThrow('IDENTITY_CONFIG_INVALID:IDENTITY_OUTBOX_TARGETS_JSON')
  }
})
it('reports local origin collisions through IDENTITY_MODE for each pair', () => {
  for (const [left, right] of [
    ['SERVER_PUBLIC_WEB_BASE_URL', 'HYDRA_PUBLIC_URL'],
    ['SERVER_PUBLIC_WEB_BASE_URL', 'HYDRA_ADMIN_URL'],
    ['HYDRA_PUBLIC_URL', 'HYDRA_ADMIN_URL'],
  ] as const)
    expect(() => parseIdentityConfig({ ...local, [left]: local[right] })).toThrow(
      'IDENTITY_CONFIG_INVALID:IDENTITY_MODE',
    )
})
it.each([
  ['IDENTITY_ENABLED', 'yes'],
  ['IDENTITY_MODE', undefined],
  ['IDENTITY_MODE', 'dev'],
  ['IDENTITY_MODE', 'full'],
  ['IDENTITY_FLOW_KEY', 'private'],
  ['IDENTITY_BOOTSTRAP_KEY', undefined],
  ['HYDRA_ADMIN_URL', undefined],
  ['HYDRA_PUBLIC_URL', 'http://localhost:4444/'],
  ['SERVER_PUBLIC_WEB_BASE_URL', 'http://127.0.0.1:8080/a/..'],
  ['HYDRA_PUBLIC_URL', 'http://127.0.0.1:8080/'],
  ['SERVER_PUBLIC_WEB_BASE_URL', 'http://127.0.0.1:8080/?secret=x'],
])('rejects invalid %s without disclosing its value', (variable, value) => {
  expect(() => parseIdentityConfig({ ...local, [variable]: value })).toThrow(IdentityConfigError)
})
it('retains deployment HTTPS issuer boundaries and private HTTP Hydra admin routing', () => {
  const deployment = {
    ...local,
    IDENTITY_MODE: 'deployment',
    SERVER_PUBLIC_WEB_BASE_URL: 'https://site.example',
    HYDRA_PUBLIC_URL: 'https://issuer.example/',
    HYDRA_ADMIN_URL: 'http://hydra:4445/',
  }
  expect(parseIdentityConfig(deployment)).toMatchObject({
    enabled: true,
    publicOrigin: 'https://site.example',
    issuer: 'https://issuer.example/',
  })
  for (const variable of ['HYDRA_PUBLIC_URL', 'SERVER_PUBLIC_WEB_BASE_URL'])
    expect(() =>
      parseIdentityConfig({ ...deployment, [variable]: 'http://insecure.example/' }),
    ).toThrow(IdentityConfigError)
})
it.each(['local', 'deployment'] as const)(
  'projects the same identity and binding through runtime and Server in %s mode',
  (mode) => {
    const endpoint = mode === 'local' ? 'http://127.0.0.1:9000' : 'https://app.example'
    const configured = {
      ...client,
      redirectUri: `${endpoint}/callback?exact=true`,
      postLogoutRedirectUri: `${endpoint}/signed-out`,
      revocation: { ...client.revocation, url: `${endpoint}/internal/revoke` },
    }
    const sourceValues = {
      RUNTIME_PROFILE: mode,
      AUTH_CODE_HMAC_KEY: 'a'.repeat(64),
      HYDRA_SYSTEM_SECRET: 'b'.repeat(64),
      IDENTITY_BOOTSTRAP_KEY: 'c'.repeat(64),
      IDENTITY_FLOW_KEY: 'd'.repeat(64),
      IDENTITY_CLIENTS_JSON: JSON.stringify([configured]),
      IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({
        'old-app': {
          hydraAdminUrl: mode === 'local' ? 'http://127.0.0.1:5555/' : 'http://old-hydra:4445/',
        },
      }),
      DATABASE_HOST: 'postgres',
      DATABASE_NAME: 'exre',
      DATABASE_USER: 'website',
      DATABASE_PASSWORD: 'fixture',
      HYDRA_DATABASE_HOST: 'postgres',
      HYDRA_DATABASE_NAME: 'hydra',
      HYDRA_DATABASE_USER: 'hydra',
      HYDRA_DATABASE_PASSWORD: 'fixture',
      ...(mode === 'deployment'
        ? {
            PUBLIC_ORIGIN: 'https://site.example',
            HYDRA_PUBLIC_URL: 'https://issuer.example/',
            HYDRA_ADMIN_URL: 'http://127.0.0.1:4445/',
            WEBSITE_INTERNAL_URL: 'http://127.0.0.1:8082/',
          }
        : {}),
    }
    const state = readRuntimeConfiguration({ sourceValues, inherited: {} })
    const server = parseIdentityConfig(state.environments.server)
    if (!server.enabled) throw new Error('expected enabled')
    expect(state.config.mode).toBe(server.mode)
    expect(state.config.publicOrigin).toBe(server.publicOrigin)
    expect(state.config.issuer).toBe(server.issuer)
    expect(state.internal.hydra).toBe(server.hydraAdminUrl)
    expect(state.secrets.IDENTITY_BOOTSTRAP_KEY).toBe(server.keys.bootstrap)
    expect(state.secrets.IDENTITY_FLOW_KEY).toBe(server.keys.flow)
    expect(state.clients).toEqual(server.approvedClients)
    expect(state.cleanupTargets).toEqual(server.cleanupTargets)
    expect(state.identity.integrationClients).toEqual(server.integrationClients)
    expect(state.identity.deliveryTargets).toEqual(server.deliveryTargets)
    const database = new URL(state.databases.DATABASE)
    const serverBinding = createIdentityBinding({
      websiteTarget: {
        host: database.hostname.toLowerCase(),
        port: Number(database.port || 5432),
        user: decodeURIComponent(database.username),
        database: 'exre',
        verifiedDatabase: 'exre',
      },
      issuer: server.issuer,
      publicOrigin: server.publicOrigin,
      hydraAdminUrl: server.hydraAdminUrl,
      clients: server.approvedClients,
      cleanupTargets: server.cleanupTargets,
      flowKey: server.keys.flow,
      bootstrapKey: server.keys.bootstrap,
    })
    expect(deploymentBinding(state)).toEqual(serverBinding)
    expect(digest(deploymentBinding(state))).toBe(digest(serverBinding))
    for (const key of [
      'IDENTITY_BOOTSTRAP_KEY',
      'IDENTITY_FLOW_KEY',
      'IDENTITY_CLIENTS_JSON',
      'IDENTITY_OUTBOX_TARGETS_JSON',
    ])
      expect(state.environments.web[key]).toBeUndefined()
  },
)
