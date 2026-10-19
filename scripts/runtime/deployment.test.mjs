import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateDeployment, convertLegacyBinding, deploymentBinding } from './deployment.mjs'
import { readRuntimeConfiguration } from './settings.mjs'

const oldEmptyV2 =
  '{"version":2,"websiteTarget":{"host":"postgres","port":5432,"database":"exre","user":"website","verifiedDatabase":"exre"},"issuer":"https://issuer.example/","publicOrigin":"https://site.example","hydraAdminUrl":"http://hydra:4445/","clients":[],"cleanupTargets":[],"flowKeyFingerprint":"ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb","bootstrapKeyFingerprint":"a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4"}'
const oldFilledV2 =
  '{"version":2,"websiteTarget":{"host":"postgres","port":5432,"database":"exre","user":"website","verifiedDatabase":"exre"},"issuer":"https://issuer.example/","publicOrigin":"https://site.example","hydraAdminUrl":"http://hydra:4445/","clients":[{"clientId":"test-app","name":"Test App","redirectUri":"https://app.example/callback?exact=true","postLogoutRedirectUri":"https://app.example/out","scopes":["email","openid"],"clientSecretFingerprint":"7977fd45a6717b935cec23e7ec648eda6033ad70b4f1d27033a631df59b0184d","integrationKeyFingerprint":"52b6419d27bd7f547cee3b92f8c17a908b8a49601ecbec161e5030de1dfe9e0a","revocation":{"url":"https://app.example/revoke","keyFingerprint":"d91323a5298f3b9f814db29efaa271f24fbdccedfdd062491b8abc8e07b7fb69"}}],"cleanupTargets":[{"clientId":"old-app","hydraAdminUrl":"http://old-hydra:4445/","revocation":null}],"flowKeyFingerprint":"ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb","bootstrapKeyFingerprint":"a0fab1377f49a759b57f63318262ebe89fabfc990e8e93ceac2984561482b9d4"}'

test('runtime binding matches fixed pre-change v2 bytes with empty and approved clients', () => {
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
  const values = {
    RUNTIME_PROFILE: 'deployment',
    PUBLIC_ORIGIN: 'https://site.example',
    HYDRA_PUBLIC_URL: 'https://issuer.example/',
    HYDRA_ADMIN_URL: 'http://hydra:4445/',
    WEBSITE_INTERNAL_URL: 'http://127.0.0.1:8082/',
    AUTH_CODE_HMAC_KEY: 'e'.repeat(64),
    HYDRA_SYSTEM_SECRET: 'f'.repeat(64),
    IDENTITY_FLOW_KEY: 'a'.repeat(64),
    IDENTITY_BOOTSTRAP_KEY: 'b'.repeat(64),
    DATABASE_HOST: 'postgres',
    DATABASE_NAME: 'exre',
    DATABASE_USER: 'website',
    DATABASE_PASSWORD: 'fixture',
    HYDRA_DATABASE_HOST: 'postgres',
    HYDRA_DATABASE_NAME: 'hydra',
    HYDRA_DATABASE_USER: 'hydra',
    HYDRA_DATABASE_PASSWORD: 'fixture',
  }
  for (const [extra, expected] of [
    [{}, oldEmptyV2],
    [
      {
        IDENTITY_CLIENTS_JSON: JSON.stringify([app]),
        IDENTITY_OUTBOX_TARGETS_JSON: JSON.stringify({
          'old-app': { hydraAdminUrl: 'http://old-hydra:4445/' },
        }),
      },
      oldFilledV2,
    ],
  ]) {
    const state = readRuntimeConfiguration({ sourceValues: { ...values, ...extra }, inherited: {} })
    const receipt = JSON.stringify(deploymentBinding(state))
    assert.equal(receipt, expected)
    assert.ok(!receipt.includes(app.clientSecret))
  }
})

function fixture(t, pending = false) {
  const workspace = mkdtempSync(join(tmpdir(), 'exwebsite-deployment-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const state = {
    workspace,
    config: {
      websiteTarget: { database: 'exre' },
      publicOrigin: 'https://site.example',
      issuer: 'https://issuer.example/',
    },
    secrets: { IDENTITY_FLOW_KEY: 'f'.repeat(64), IDENTITY_BOOTSTRAP_KEY: 'b'.repeat(64) },
    clients: {},
    cleanupTargets: {},
    internal: { hydra: 'http://127.0.0.1:4445/' },
    databases: { DATABASE: 'exre' },
    values: { HYDRA_ADMIN_URL: 'http://hydra:4445' },
  }
  const queries = [],
    connect = async (name) => ({
      async query(sql) {
        queries.push(sql)
        return {
          rows: sql.includes('current_database')
            ? [{ name }]
            : sql.includes('UNION ALL')
              ? pending
                ? [{}]
                : []
              : sql.includes('to_regclass')
                ? [{ name: 'website_integrations' }]
                : sql.includes('SELECT issuer')
                  ? [{ issuer: state.config.issuer }]
                  : [],
        }
      },
      async end() {},
    })
  return { state, connect, queries, verifyClient: async () => {} }
}
test('deployment prepare rejects unaccounted old ex-outline identities using read-only queries', async (t) => {
  const f = fixture(t, true)
  await assert.rejects(validateDeployment(f.state, { ...f, prepare: true }), /OLD_IDENTITY_PENDING/)
  assert.ok(f.queries.every((sql) => /^(BEGIN READ ONLY|ROLLBACK|SELECT)/.test(sql)))
})
test('deployment pins identity and refuses issuer/secret changes on subsequent validation', async (t) => {
  const f = fixture(t)
  await validateDeployment(f.state, { ...f, prepare: true })
  await validateDeployment(f.state, f)
  f.state.secrets.IDENTITY_FLOW_KEY = 'changed'
  await assert.rejects(validateDeployment(f.state, f), /IDENTITY_MIGRATION_REQUIRED/)
})

test('concurrent prepare cannot overwrite a different deployment routing binding', async (t) => {
  const f = fixture(t),
    different = { ...f.state, secrets: { ...f.state.secrets, IDENTITY_FLOW_KEY: 'other' } }
  const outcomes = await Promise.allSettled([
    validateDeployment(f.state, { ...f, prepare: true }),
    validateDeployment(different, { ...f, prepare: true }),
  ])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  assert.match(
    outcomes.find((result) => result.status === 'rejected').reason.message,
    /IDENTITY_MIGRATION_REQUIRED/,
  )
  await validateDeployment(f.state, f)
})

test('v1 receipt conversion checks original fingerprints and refuses unknown history without rewriting the pin', async (t) => {
  const f = fixture(t),
    original = {
      OUTLINE_OIDC_CLIENT_SECRET: 'original client',
      IDENTITY_DELIVERY_KEY: 'original delivery',
    }
  const { digest } = await import('./local-config.mjs')
  const receipt = {
    version: 1,
    websiteTarget: f.state.config.websiteTarget,
    issuer: f.state.config.issuer,
    publicOrigin: f.state.config.publicOrigin,
    clientSecretFingerprint: digest(original.OUTLINE_OIDC_CLIENT_SECRET),
    deliveryFingerprint: digest(original.IDENTITY_DELIVERY_KEY),
  }
  const directory = join(f.state.workspace, '.local/runtime-deployment'),
    path = join(directory, 'identity.json')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path, JSON.stringify(receipt))
  const before = readFileSync(path, 'utf8')
  await assert.rejects(
    convertLegacyBinding(
      f.state,
      { ...original, OUTLINE_OIDC_CLIENT_SECRET: 'changed' },
      { connect: f.connect, verifyOriginal: async () => {} },
    ),
    /MIGRATION_REQUIRED/,
  )
  const unknown = async () => ({
    query: async (sql) => ({
      rows: sql.includes('current_database')
        ? [{ name: 'exre' }]
        : sql.includes('DISTINCT client_id')
          ? [{ client_id: 'unknown-app' }]
          : [],
    }),
    end: async () => {},
  })
  await assert.rejects(
    convertLegacyBinding(f.state, original, { connect: unknown, verifyOriginal: async () => {} }),
    /OLD_IDENTITY_PENDING/,
  )
  assert.equal(readFileSync(path, 'utf8'), before)
  const result = await convertLegacyBinding(f.state, original, {
    connect: f.connect,
    verifyOriginal: async () => {},
  })
  assert.equal(result.changed, true)
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).version, 2)
  assert.equal(readFileSync(`${path}.v1-backup`, 'utf8'), before)
  assert.deepEqual(
    await convertLegacyBinding(f.state, original, {
      connect: f.connect,
      verifyOriginal: async () => {},
    }),
    { changed: false },
  )
})

test('v1 conversion resumes only from an identical preexisting backup after interrupted atomic publication', async (t) => {
  for (const conflict of [false, true]) {
    const f = fixture(t),
      original = { OUTLINE_OIDC_CLIENT_SECRET: 'client', IDENTITY_DELIVERY_KEY: 'delivery' }
    const { digest } = await import('./local-config.mjs')
    const receipt = {
      version: 1,
      websiteTarget: f.state.config.websiteTarget,
      issuer: f.state.config.issuer,
      publicOrigin: f.state.config.publicOrigin,
      clientSecretFingerprint: digest(original.OUTLINE_OIDC_CLIENT_SECRET),
      deliveryFingerprint: digest(original.IDENTITY_DELIVERY_KEY),
    }
    const directory = join(f.state.workspace, '.local/runtime-deployment'),
      path = join(directory, 'identity.json')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path, JSON.stringify(receipt))
    const backup = JSON.stringify(conflict ? { ...receipt, issuer: 'other' } : receipt)
    writeFileSync(`${path}.v1-backup`, backup)
    if (conflict) {
      await assert.rejects(
        convertLegacyBinding(f.state, original, {
          connect: f.connect,
          verifyOriginal: async () => {},
        }),
        /MIGRATION_REQUIRED/,
      )
      assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), receipt)
    } else {
      assert.equal(
        (
          await convertLegacyBinding(f.state, original, {
            connect: f.connect,
            verifyOriginal: async () => {},
          })
        ).changed,
        true,
      )
      assert.equal(JSON.parse(readFileSync(path, 'utf8')).version, 2)
    }
    assert.equal(readFileSync(`${path}.v1-backup`, 'utf8'), backup)
  }
})
