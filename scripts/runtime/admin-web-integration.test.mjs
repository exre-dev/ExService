import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { main as frontend } from './frontend.mjs'
import { supervise } from './local-dev.mjs'
import { buildSpecifications, main as build } from './build.mjs'
import { main as admin } from './admin-frontend.mjs'
import { testSpecifications } from './tests.mjs'

const tools = { node: process.execPath }
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
  const options = { workspace, inherited: {}, signal: controller.signal }
  const lock = {
    record: { runId: 'fixture', identity: { pid: process.pid } },
    update() {},
    release() {
      events.push('release')
    },
  }
  const dependencies = {
    acquireLock: () => lock,
    output: {
      title() {},
      log() {},
      status(name, _status, url) {
        events.push('url:' + name + ':' + url)
      },
    },
    async prepare() {
      events.push('prepare')
      writeFileSync(
        join(workspace, '.env.local'),
        'LOCAL_ADMIN_WEB_PORT=invalid\nADMIN_API_PROXY_TARGET=invalid',
      )
    },
    async assertPortFree(port) {
      events.push('port:' + port)
    },
    async httpReady(url) {
      events.push('ready:' + url)
    },
    watchSources() {
      return {
        close() {
          events.push('watch-close')
        },
      }
    },
    supervise(options) {
      return supervise({
        ...options,
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
          events.push('spawn:' + specification.name)
          return child
        },
        async stopChildren(items) {
          items.forEach((child) => {
            events.push('stop:' + child.specification.name)
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
  return { state: { workspace }, options, dependencies, events, children }
}

test('root dev selects both frontends, parses admin configuration once and recycles the group after readiness', async (t) => {
  const f = fixture(t)
  await frontend(f.options, f.dependencies)
  assert.deepEqual(
    f.children.map((child) => child.specification.name),
    ['Web', 'admin-web'],
  )
  assert.equal(
    f.children[1].specification.environment.ADMIN_API_PROXY_TARGET,
    'http://127.0.0.1:8787',
  )
  assert.equal('VITE_API_BASE_URL' in f.children[1].specification.environment, false)
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('port:')),
    ['port:8080', 'port:5273'],
  )
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('ready:')),
    ['ready:http://127.0.0.1:8080/', 'ready:http://127.0.0.1:5273/'],
  )
  assert.ok(f.events.includes('url:管理端:http://127.0.0.1:5273/'))
  assert.ok(
    f.events.indexOf('url:管理端:http://127.0.0.1:5273/') >
      f.events.indexOf('ready:http://127.0.0.1:5273/'),
  )
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('stop:')),
    ['stop:Web', 'stop:admin-web'],
  )
  assert.equal(f.events.at(-1), 'release')
})

test('root dev rejects duplicate frontend ports before acquiring ownership or starting children', async (t) => {
  const f = fixture(t)
  f.options.inherited = { LOCAL_ADMIN_WEB_PORT: '8080' }
  await assert.rejects(
    frontend(f.options, f.dependencies),
    (error) => error.code === 'PORT_CONFLICT',
  )
  assert.equal(f.children.length, 0)
})

test('admin readiness failure stops every selected frontend without reporting ready', async (t) => {
  const f = fixture(t, {
    async httpReady(url) {
      if (String(url).includes(':5273/')) throw new Error('fixture readiness failure')
    },
  })
  await assert.rejects(frontend(f.options, f.dependencies), /fixture readiness failure/)
  assert.deepEqual(
    f.events.filter((event) => event.startsWith('stop:')),
    ['stop:Web', 'stop:admin-web'],
  )
  assert.equal(
    f.events.some((event) => event.startsWith('url:')),
    false,
  )
  assert.equal(f.events.at(-1), 'release')
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
      'SDK declarations',
      '@workspace/web',
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
