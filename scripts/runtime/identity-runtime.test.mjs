import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRuntimeConfiguration } from './settings.mjs'
import { serializeEnvironment } from './convert.mjs'
import { redact } from './output.mjs'
import { verifyApplications } from './applications.mjs'
import { verifyNativeClient } from './native.mjs'

test('Website/Hydra-only settings start with an empty allowlist and ignore retired keys', (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'identity-runtime-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  const values = {
    RUNTIME_PROFILE: 'local',
    AUTH_CODE_HMAC_KEY: 'a'.repeat(64),
    HYDRA_SYSTEM_SECRET: 'b'.repeat(64),
    IDENTITY_BOOTSTRAP_KEY: 'c'.repeat(64),
    IDENTITY_FLOW_KEY: 'd'.repeat(64),
    OUTLINE_DATABASE_URL: 'ignored legacy resource',
    OUTLINE_SECRET_KEY: 'ignored',
  }
  for (const [prefix, name] of [
    ['DATABASE', 'exre'],
    ['HYDRA_DATABASE', 'hydra'],
  ])
    Object.assign(
      values,
      Object.fromEntries(
        Object.entries({
          HOST: '127.0.0.1',
          NAME: name,
          USER: name,
          PASSWORD: 'unchanged ordinary password',
        }).map(([k, v]) => [`${prefix}_${k}`, v]),
      ),
    )
  writeFileSync(join(workspace, '.env.local'), serializeEnvironment(values))
  const state = readRuntimeConfiguration({ workspace, inherited: {} })
  assert.deepEqual(state.clients, {})
  assert.equal(state.environments.server.IDENTITY_ENABLED, 'true')
  assert.equal(state.environments.server.IDENTITY_MODE, 'local')
  assert.equal(state.environments.server.IDENTITY_CLIENTS_JSON, '[]')
  for (const env of Object.values(state.environments))
    assert.equal(
      Object.keys(env).some(
        (k) => k.startsWith('OUTLINE_') || k.startsWith('WEBSITE_INTEGRATION_'),
      ),
      false,
    )
  assert.equal('IDENTITY_CLIENTS_JSON' in state.environments.web, false)
  assert.equal('outline' in state.environments, false)
  assert.equal('redis' in state.config.ports, false)
})
test('redaction treats entire identity JSON settings as secrets', () => {
  const values = {
    IDENTITY_CLIENTS_JSON: '[{"clientId":"ordinary","clientSecret":"visible-value"}]',
    IDENTITY_OUTBOX_TARGETS_JSON: '{"ordinary":{"key":"another-visible-value"}}',
  }
  const line = redact(JSON.stringify(values), values)
  assert.equal(line.includes('visible-value'), false)
})

for (const entry of ['local', 'native']) {
  for (const failure of ['admin', 'public', 'issuer', 'issuer-trailing-slash', 'none']) {
    test(`${entry} empty clients require admin readiness and exact public issuer: ${failure}`, async () => {
      const state = {
        workspace: 'fixture',
        profile: entry === 'local' ? 'local' : 'deployment',
        clients: {},
        environments: { server: {} },
        internal: { hydra: 'http://127.0.0.1:4445/' },
        config: { issuer: 'https://issuer.example/' },
      }
      const calls = []
      const ready = async (url, { expected } = {}) => {
        const path = new URL(url).pathname
        calls.push(path)
        if (
          (failure === 'admin' && path === '/health/ready') ||
          (failure === 'public' && path === '/.well-known/openid-configuration')
        )
          throw Error('unreachable')
        if (expected) {
          const issuer =
            failure === 'issuer'
              ? 'https://other.example/'
              : failure === 'issuer-trailing-slash'
                ? 'https://issuer.example'
                : state.config.issuer
          if (!(await expected(Response.json({ issuer })))) throw Error('issuer mismatch')
        }
      }
      const verifyClient = async () => {
        throw Error('empty allowlist must not register or probe clients')
      }
      const check = () =>
        entry === 'local'
          ? verifyApplications(state, {
              tools: { node: process.execPath },
              execute: async () => {},
              verifySchemas: async () => {},
              verifyClient,
              ready,
            })
          : verifyNativeClient(state, { verifyClient, ready })
      if (failure === 'none') await check()
      else await assert.rejects(check)
      assert.deepEqual(
        calls,
        failure === 'admin'
          ? ['/health/ready']
          : ['/health/ready', '/.well-known/openid-configuration'],
      )
    })
  }
}

test('explicit client provisioning is separate from read-only startup and empty clients need no calls', async () => {
  const { provisionIdentityClients } = await import('./infrastructure.mjs')
  const workspace = mkdtempSync(join(tmpdir(), 'clients-explicit-'))
  try {
    const state = {
      directory: join(workspace, '.local/runtime'),
      fingerprint: 'fixture',
      profile: 'local',
      clients: {},
      internal: { hydra: 'http://127.0.0.1:4445/' },
      config: { issuer: 'http://127.0.0.1:4444/' },
    }
    const calls = []
    assert.deepEqual(
      await provisionIdentityClients(state, { ensureClient: async (value) => calls.push(value) }),
      { clients: [] },
    )
    assert.deepEqual(calls, [])
    const client = { clientId: 'sample-app' }
    state.clients = { 'sample-app': client }
    assert.deepEqual(
      await provisionIdentityClients(state, { ensureClient: async (value) => calls.push(value) }),
      { clients: ['sample-app'] },
    )
    assert.deepEqual(calls, [
      { mode: 'local', adminUrl: state.internal.hydra, publicUrl: state.config.issuer, client },
    ])
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
