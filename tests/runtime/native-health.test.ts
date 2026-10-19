import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { deploymentBinding } from '../../scripts/runtime/deployment.mjs'
import { HydraClientCheckError } from '../../scripts/runtime/hydra-client.mjs'
import { verifyNativeHealth } from '../../scripts/runtime/native.mjs'

const probes = vi.hoisted(() => ({
  ready: vi.fn(async (_url: URL, _options: { timeout: number }) => {}),
  execute: vi.fn(async (_spec: { name: string; args: string[] }) => {}),
  client: vi.fn(async (_options: Record<string, unknown>) => {}),
  databases: [] as string[],
}))

vi.mock('../../scripts/runtime/local-dev.mjs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  httpReady: probes.ready,
}))
vi.mock('../../scripts/runtime/ownership.mjs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runOwned: probes.execute,
}))
vi.mock('../../scripts/runtime/local-config.mjs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  toolchain: () => ({ node: process.execPath }),
}))
vi.mock('../../scripts/runtime/hydra-client.mjs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  verifyHydraClient: probes.client,
}))
vi.mock('pg', () => ({
  default: {
    Client: class {
      name: string
      constructor({ connectionString }: { connectionString: string }) {
        this.name = new URL(connectionString).pathname.slice(1)
      }
      async connect() {
        probes.databases.push(this.name)
      }
      async query(sql: string) {
        return { rows: sql.includes('current_database') ? [{ name: this.name }] : [] }
      }
      async end() {}
    },
  },
}))

const workspaces: string[] = []
afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true })
  vi.clearAllMocks()
  probes.databases.length = 0
})

function nativeState(withClient = true) {
  const workspace = mkdtempSync(join(tmpdir(), 'exwebsite-native-health-'))
  workspaces.push(workspace)
  const client = {
    clientId: 'native-app',
    name: 'Native app',
    clientSecret: 'existing-secret',
    redirectUri: 'https://app.example/callback',
    postLogoutRedirectUri: 'https://app.example/logout',
    scopes: ['openid'],
  }
  const state = {
    workspace,
    profile: 'deployment',
    config: {
      websiteTarget: {
        host: '127.0.0.1',
        port: 1,
        user: 'test',
        database: 'exre',
        verifiedDatabase: 'exre',
      },
      publicOrigin: 'https://site.example',
      issuer: 'https://issuer.example/',
    },
    internal: { website: 'http://127.0.0.1:8082/', hydra: 'http://127.0.0.1:4445/' },
    values: {},
    secrets: { IDENTITY_FLOW_KEY: 'a'.repeat(64), IDENTITY_BOOTSTRAP_KEY: 'b'.repeat(64) },
    databases: { DATABASE: 'postgres://test:test@127.0.0.1:1/exre' },
    environments: { server: {} },
    clients: withClient ? { 'native-app': client } : {},
    cleanupTargets: {},
  }
  const directory = join(workspace, '.local/runtime-deployment')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'identity.json'), JSON.stringify(deploymentBinding(state)))
  return state
}

test('native health verifies Website, Hydra, configured clients and the retained Website readiness CLI', async () => {
  const state = nativeState()
  await verifyNativeHealth(state)
  expect(probes.ready.mock.calls.map(([url]) => String(url))).toEqual([
    'http://127.0.0.1:8082/api/health',
    'http://127.0.0.1:4445/health/ready',
    'https://issuer.example/.well-known/openid-configuration',
  ])
  expect(probes.databases).toEqual(['exre'])
  expect(probes.client).toHaveBeenCalledTimes(1)
  for (const [options] of probes.client.mock.calls)
    expect(options).toEqual({
      mode: 'deployment',
      adminUrl: state.internal.hydra,
      publicUrl: state.config.issuer,
      client: state.clients['native-app'],
    })
  expect(probes.execute.mock.calls.map(([spec]) => ({ name: spec.name, args: spec.args }))).toEqual(
    [
      {
        name: 'server',
        args: [join(state.workspace, 'scripts/runtime/server.mjs'), 'integration:check'],
      },
    ],
  )
})

test('native health accepts zero configured clients while still checking Website and Hydra readiness', async () => {
  const state = nativeState(false)
  await verifyNativeHealth(state)
  expect(probes.client).not.toHaveBeenCalled()
  expect(probes.ready.mock.calls.map(([url]) => String(url))).toEqual([
    'http://127.0.0.1:8082/api/health',
    'http://127.0.0.1:4445/health/ready',
    'https://issuer.example/.well-known/openid-configuration',
  ])
  expect(probes.databases).toEqual(['exre'])
  expect(probes.execute).toHaveBeenCalledTimes(1)
})

test('native health rejects a missing explicitly configured client before the Website check CLI', async () => {
  const state = nativeState()
  probes.client.mockRejectedValueOnce(new HydraClientCheckError('CLIENT_MISSING'))
  await expect(verifyNativeHealth(state)).rejects.toMatchObject({ code: 'HYDRA_CLIENT_MISSING' })
  expect(probes.execute).not.toHaveBeenCalled()
})
