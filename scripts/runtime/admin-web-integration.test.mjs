import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runDevelopment } from './applications.mjs'
import { supervise } from './local-dev.mjs'
import { buildSpecifications, main as build } from './build.mjs'
import { main as admin } from './admin-frontend.mjs'
import { testSpecifications } from './tests.mjs'

const tools = { node: process.execPath, corepack: 'fixture-corepack' }
function fixture(t, extra = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'admin-web-integration-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  writeFileSync(
    join(workspace, '.env.local'),
    'LOCAL_ADMIN_WEB_PORT=5273\nADMIN_API_PROXY_TARGET=http://127.0.0.1:8787',
  )
  const events = [],
    children = [],
    controller = new AbortController()
  const state = {
    workspace,
    directory: workspace,
    profile: 'local',
    fingerprint: 'fixture',
    values: {},
    environments: {
      server: { RUNTIME_ENV_INJECTED: 'true' },
      web: { SystemRoot: 'system-directory', VITE_API_BASE_URL: '/api' },
    },
    config: {
      publicOrigin: 'http://127.0.0.1:8080',
      ports: {
        public: 8080,
        web: 8081,
        api: 8082,
        postgres: 5432,
        hydraPublic: 4444,
        hydraAdmin: 4445,
      },
    },
    internal: { website: 'http://127.0.0.1:8082' },
  }
  const lock = {
    record: { runId: 'fixture', identity: { pid: process.pid } },
    update() {},
    release() {
      events.push('release')
    },
  }
  const options = {
    tools,
    inherited: {},
    acquireLock: () => lock,
    output: {
      heading() {},
      note() {},
      success() {
        events.push('success')
      },
      status(name, _status, url) {
        events.push(`url:${name}:${url}`)
      },
      log() {},
    },
    async prepare() {
      events.push('prepare')
      writeFileSync(
        join(workspace, '.env.local'),
        'LOCAL_ADMIN_WEB_PORT=invalid\nADMIN_API_PROXY_TARGET=invalid',
      )
    },
    async verify() {
      events.push('preflight')
    },
    async assertFree(port) {
      events.push(`port:${port}`)
    },
    async ready(url) {
      events.push(`ready:${url}`)
    },
    watchSources() {
      return {
        close() {
          events.push('watch-close')
        },
      }
    },
    superviseApplications(options) {
      return supervise({
        ...options,
        signal: controller.signal,
        pollInterval: 5,
        async spawnChild(specification) {
          let finish
          const child = {
            specification,
            identity: { pid: children.length + 1 },
            child: { exitCode: null, signalCode: null },
            exited: new Promise((resolve) => {
              finish = resolve
            }),
            finish() {
              this.child.exitCode = 0
              finish({ code: 0 })
            },
          }
          children.push(child)
          events.push(`spawn:${specification.name}`)
          return child
        },
        async stopChildren(items) {
          items.forEach((child) => {
            events.push(`stop:${child.specification.name}`)
            child.finish()
          })
        },
        onReady() {
          options.onReady()
          controller.abort()
        },
      })
    },
    ...extra,
  }
  return { state, options, events, children }
}

test('full dev selects admin, parses configuration once, checks its port and page, then recycles the whole group', async (t) => {
  const f = fixture(t)
  await runDevelopment(f.state, f.options)
  assert.deepEqual(
    f.children.map((child) => child.specification.name),
    ['server', 'web', 'admin-web'],
  )
  assert.equal(f.children[2].specification.command, tools.node)
  assert.equal(
    f.children[2].specification.environment.ADMIN_API_PROXY_TARGET,
    'http://127.0.0.1:8787',
  )
  assert.equal(f.children[2].specification.environment.SystemRoot, 'system-directory')
  assert.equal('VITE_API_BASE_URL' in f.children[2].specification.environment, false)
  assert.ok(f.events.includes('port:5273'))
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('ready:')),
    [
      'ready:http://127.0.0.1:8082/api/health',
      'ready:http://127.0.0.1:8080/',
      'ready:http://127.0.0.1:8080/api/health',
      'ready:http://127.0.0.1:5273/',
    ],
  )
  assert.ok(f.events.includes('url:管理端:http://127.0.0.1:5273/'))
  assert.ok(f.events.indexOf('success') > f.events.indexOf('ready:http://127.0.0.1:5273/'))
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('stop:')),
    ['stop:server', 'stop:web', 'stop:admin-web'],
  )
  assert.equal(f.events.at(-1), 'release')
})

test('full dev rejects admin collisions against every existing runtime port before starting children', async (t) => {
  for (const port of [8080, 8081, 8082, 5432, 4444, 4445]) {
    const f = fixture(t, { inherited: { LOCAL_ADMIN_WEB_PORT: String(port) } })
    await assert.rejects(
      runDevelopment(f.state, f.options),
      (error) => error.code === 'PORT_CONFLICT' && error.keys.includes('LOCAL_ADMIN_WEB_PORT'),
    )
    assert.equal(f.children.length, 0)
    assert.equal(f.events.at(-1), 'release')
  }
})

test('admin readiness failure from actual full dev wiring stops every selected child', async (t) => {
  const f = fixture(t, {
    async ready(url) {
      if (String(url).includes(':5273/')) throw new Error('fixture readiness failure')
    },
  })
  await assert.rejects(runDevelopment(f.state, f.options), /fixture readiness failure/)
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('stop:')),
    ['stop:server', 'stop:web', 'stop:admin-web'],
  )
  assert.equal(f.events.includes('success'), false)
})

test('server-only dev never parses invalid admin settings or adds its readiness and port', async (t) => {
  const f = fixture(t, {
    service: 'server',
    inherited: { LOCAL_ADMIN_WEB_PORT: '', ADMIN_API_PROXY_TARGET: 'invalid' },
  })
  await runDevelopment(f.state, f.options)
  assert.deepEqual(
    f.children.map((child) => child.specification.name),
    ['server'],
  )
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('ready:')),
    ['ready:http://127.0.0.1:8082/api/health'],
  )
  assert.equal(f.events.includes('port:5273'), false)
})

test('standalone admin selects just its page without backend or SDK preparation', async (t) => {
  const f = fixture(t)
  let called = false
  await admin(
    { workspace: f.state.workspace, inherited: {}, port: 5373 },
    async (specifications) => {
      called = true
      assert.deepEqual(
        specifications.map((spec) => spec.name),
        ['admin-web'],
      )
      assert.equal(specifications[0].readinessUrl, 'http://127.0.0.1:5373/')
    },
  )
  assert.equal(called, true)
})

test('build preserves Contract SDK Website ordering and gives admin only tools plus production mode', async (t) => {
  const f = fixture(t)
  const options = {
    workspace: f.state.workspace,
    tools,
    inherited: {
      Path: 'tools',
      DATABASE_PASSWORD: 'secret',
      VITE_API_BASE_URL: 'https://website.example/api',
      ADMIN_API_PROXY_TARGET: 'invalid',
      NODE_OPTIONS: '--inspect',
    },
  }
  const specs = buildSpecifications(options)
  assert.deepEqual(
    specs.map((spec) => spec.name),
    [
      'API Contract',
      '@workspace/sdk',
      '@workspace/web',
      '@workspace/server',
      '@workspace/admin-web',
    ],
  )
  const spec = specs.at(-1)
  assert.equal(spec.environment.NODE_ENV, 'production')
  for (const key of [
    'DATABASE_PASSWORD',
    'VITE_API_BASE_URL',
    'ADMIN_API_PROXY_TARGET',
    'NODE_OPTIONS',
  ])
    assert.equal(key in spec.environment, false)
  const executed = []
  await build(options, async (spec) => executed.push(spec.name))
  assert.deepEqual(
    executed,
    specs.map((spec) => spec.name),
  )
  const runtime = testSpecifications({ ...options, full: false })[1]
  for (const file of ['admin-frontend', 'frontend-group', 'admin-web-integration'])
    assert.ok(runtime.args.includes(`scripts/runtime/${file}.test.mjs`))
})
