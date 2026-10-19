import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { createIdentityBinding } from '@workspace/common/node/identity-config'
import { parseIdentityConfig } from '@server/src/modules/identity/config'
import { assertDeploymentBinding } from '@server/src/modules/identity/deployment-binding'

const oldServerEmptyV2 =
  '{"version":2,"websiteTarget":{"host":"postgres","port":5432,"user":"website","database":"exre","verifiedDatabase":"exre"},"issuer":"https://issuer.example/","publicOrigin":"https://site.example","hydraAdminUrl":"http://hydra:4445/","clients":[],"cleanupTargets":[],"flowKeyFingerprint":"ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb","bootstrapKeyFingerprint":"a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4"}'
const oldServerFilledV2 =
  '{"version":2,"websiteTarget":{"host":"postgres","port":5432,"user":"website","database":"exre","verifiedDatabase":"exre"},"issuer":"https://issuer.example/","publicOrigin":"https://site.example","hydraAdminUrl":"http://hydra:4445/","clients":[{"clientId":"test-app","name":"Test App","redirectUri":"https://app.example/callback?exact=true","postLogoutRedirectUri":"https://app.example/out","scopes":["email","openid"],"clientSecretFingerprint":"7977fd45a6717b935cec23e7ec648eda6033ad70b4f1d27033a631df59b0184d","integrationKeyFingerprint":"52b6419d27bd7f547cee3b92f8c17a908b8a49601ecbec161e5030de1dfe9e0a","revocation":{"url":"https://app.example/revoke","keyFingerprint":"d91323a5298f3b9f814db29efaa271f24fbdccedfdd062491b8abc8e07b7fb69"}}],"cleanupTargets":[{"clientId":"old-app","hydraAdminUrl":"http://old-hydra:4445/","revocation":null}],"flowKeyFingerprint":"ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb","bootstrapKeyFingerprint":"a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4"}'

it('keeps Server binding bytes equal to the pre-change empty and approved-client v2 receipts', () => {
  const app = {
    clientId: 'test-app',
    name: 'Test App',
    redirectUri: 'https://app.example/callback?exact=true',
    postLogoutRedirectUri: 'https://app.example/out',
    scopes: ['openid', 'email'],
    clientSecret: 'existing non-hex secret',
    integrationKey: 'c'.repeat(64),
    revocation: { url: 'https://app.example/revoke', key: 'd'.repeat(64) },
  }
  const env = {
    IDENTITY_ENABLED: 'true',
    IDENTITY_MODE: 'deployment',
    SERVER_PUBLIC_WEB_BASE_URL: 'https://site.example',
    HYDRA_PUBLIC_URL: 'https://issuer.example/',
    HYDRA_ADMIN_URL: 'http://hydra:4445/',
    IDENTITY_FLOW_KEY: 'a'.repeat(64),
    IDENTITY_BOOTSTRAP_KEY: 'b'.repeat(64),
  }
  for (const [extra, expected] of [
    [{}, oldServerEmptyV2],
    [
      {
        IDENTITY_CLIENTS_JSON: JSON.stringify([app]),
        IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({
          'old-app': { hydraAdminUrl: 'http://old-hydra:4445/' },
        }),
      },
      oldServerFilledV2,
    ],
  ] as const) {
    const identity = parseIdentityConfig({ ...env, ...extra })
    if (!identity.enabled) throw new Error('expected enabled')
    const binding = createIdentityBinding({
      websiteTarget: {
        host: 'postgres',
        port: 5432,
        user: 'website',
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
    expect(JSON.stringify(binding)).toBe(expected)
    expect(JSON.stringify(binding)).not.toContain(app.clientSecret)
  }
})

it('pins every deployment route, capability and secret before outbox startup, without disclosing secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'website-deployment-')),
    file = join(directory, 'identity.json')
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const key = 'a'.repeat(64),
    app = {
      clientId: 'test-app',
      name: 'Test App',
      redirectUri: 'https://app.example/callback?exact=true',
      postLogoutRedirectUri: 'https://app.example/out',
      scopes: ['openid', 'email'],
      clientSecret: 'existing non-hex secret',
      integrationKey: key,
      revocation: { url: 'https://app.example/revoke', key },
    }
  const env = {
    IDENTITY_ENABLED: 'true',
    IDENTITY_MODE: 'deployment',
    SERVER_PUBLIC_WEB_BASE_URL: 'https://site.example',
    HYDRA_PUBLIC_URL: 'https://issuer.example/',
    HYDRA_ADMIN_URL: 'http://hydra:4445/',
    IDENTITY_BOOTSTRAP_KEY: key,
    IDENTITY_FLOW_KEY: key,
    IDENTITY_CLIENTS_JSON: JSON.stringify([app]),
    IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({
      'old-app': { hydraAdminUrl: 'http://old-hydra:4445/' },
    }),
    DATABASE_URL: 'postgres://website:secret@postgres:5432/exre',
    IDENTITY_DEPLOYMENT_RECEIPT_FILE: file,
  }
  const identity = parseIdentityConfig(env)
  const receipt = {
    version: 2,
    issuer: env.HYDRA_PUBLIC_URL,
    publicOrigin: env.SERVER_PUBLIC_WEB_BASE_URL,
    hydraAdminUrl: env.HYDRA_ADMIN_URL,
    websiteTarget: {
      host: 'postgres',
      port: 5432,
      user: 'website',
      database: 'exre',
      verifiedDatabase: 'exre',
    },
    flowKeyFingerprint: hash(key),
    bootstrapKeyFingerprint: hash(key),
    clients: [
      {
        ...app,
        scopes: ['email', 'openid'],
        clientSecret: undefined,
        integrationKey: undefined,
        clientSecretFingerprint: hash(app.clientSecret),
        integrationKeyFingerprint: hash(key),
        revocation: { url: app.revocation.url, keyFingerprint: hash(key) },
      },
    ],
    cleanupTargets: [
      { clientId: 'old-app', hydraAdminUrl: 'http://old-hydra:4445/', revocation: null },
    ],
  }
  try {
    expect(() => assertDeploymentBinding(identity, env)).toThrow('IDENTITY_DEPLOYMENT_RECEIPT_FILE')
    writeFileSync(file, JSON.stringify(receipt))
    expect(() => assertDeploymentBinding(identity, env)).not.toThrow()
    for (const changes of [
      { IDENTITY_FLOW_KEY: 'b'.repeat(64) },
      { IDENTITY_BOOTSTRAP_KEY: 'c'.repeat(64) },
      { HYDRA_ADMIN_URL: 'http://different:4445/' },
      { DATABASE_URL: 'postgres://website:secret@different:5432/exre' },
      { HYDRA_PUBLIC_URL: 'https://other-issuer.example/' },
      { IDENTITY_OUTBOX_TARGETS_JSON: '{}' },
      ...[
        { ...app, clientSecret: 'changed-secret' },
        { ...app, integrationKey: undefined },
        { ...app, scopes: ['openid'] },
        { ...app, revocation: undefined },
        { ...app, redirectUri: 'https://app.example/different' },
        { ...app, postLogoutRedirectUri: 'https://app.example/different-out' },
      ].map((client) => ({ IDENTITY_CLIENTS_JSON: JSON.stringify([client]) })),
    ]) {
      expect(() =>
        assertDeploymentBinding(parseIdentityConfig({ ...env, ...changes }), {
          ...env,
          ...changes,
        }),
      ).toThrow('IDENTITY_DEPLOYMENT_RECEIPT_FILE')
    }
    for (const invalid of [
      { ...receipt, version: 1 },
      { ...receipt, clients: [] },
      { ...receipt, arbitrary: true },
    ]) {
      writeFileSync(file, JSON.stringify(invalid))
      expect(() => assertDeploymentBinding(identity, env)).toThrow(
        'IDENTITY_DEPLOYMENT_RECEIPT_FILE',
      )
    }
    expect(JSON.stringify(receipt)).not.toContain(app.clientSecret)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
