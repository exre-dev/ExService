import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { frontendArguments, frontendSpecification, main } from './frontend.mjs'

function workspace(t, contents) {
  const directory = mkdtempSync(join(tmpdir(), 'website-frontend-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  if (contents !== undefined) writeFileSync(join(directory, '.env.local'), contents)
  return directory
}

test('frontend preview starts without runtime credentials and uses the local API fallback', (t) => {
  const spec = frontendSpecification({ workspace: workspace(t), inherited: {} })
  assert.equal(spec.cwd.endsWith(join('apps', 'web')), true)
  assert.deepEqual(spec.args.slice(1), ['--host', '127.0.0.1', '--port', '8090', '--strictPort'])
  assert.equal(spec.environment.VITE_API_BASE_URL, '/api')
  assert.equal(spec.environment.INTEGRATION_SERVER_PORT, '8082')
})

test('frontend preview reads the root API address without passing secrets or other VITE variables', (t) => {
  const directory = workspace(
    t,
    [
      'VITE_API_BASE_URL=https://service.example/api',
      'LOCAL_API_PORT=8182',
      'DATABASE_PASSWORD=private-database',
      'VITE_UNRELATED_SECRET=private-value',
      'IDENTITY_FLOW_KEY=private-identity',
    ].join('\n'),
  )
  const spec = frontendSpecification({ workspace: directory, inherited: {} })
  assert.equal(spec.environment.VITE_API_BASE_URL, 'https://service.example/api')
  assert.equal(spec.environment.INTEGRATION_SERVER_PORT, '8182')
  for (const key of ['DATABASE_PASSWORD', 'VITE_UNRELATED_SECRET', 'IDENTITY_FLOW_KEY'])
    assert.equal(key in spec.environment, false)
})

test('process overrides win without inheriting the full runtime gateway or backend secrets', (t) => {
  const directory = workspace(t, 'VITE_API_BASE_URL=https://file.example/api\nLOCAL_API_PORT=8182')
  const spec = frontendSpecification({
    workspace: directory,
    inherited: {
      VITE_API_BASE_URL: 'https://process.example/api',
      LOCAL_API_PORT: '8282',
      WEBSITE_DEV_ENTRY_PORT: '8080',
      SERVER_PUBLIC_WEB_BASE_URL: 'https://canonical.example',
      VITE_UNRELATED_SECRET: 'private-value',
    },
  })
  assert.equal(spec.environment.VITE_API_BASE_URL, 'https://process.example/api')
  assert.equal(spec.environment.INTEGRATION_SERVER_PORT, '8282')
  for (const key of [
    'WEBSITE_DEV_ENTRY_PORT',
    'SERVER_PUBLIC_WEB_BASE_URL',
    'VITE_UNRELATED_SECRET',
  ])
    assert.equal(key in spec.environment, false)
  assert.equal(
    frontendSpecification({
      workspace: directory,
      inherited: { VITE_API_BASE_URL: '' },
    }).environment.VITE_API_BASE_URL,
    '/api',
  )
})

test('preview port overrides are validated and cannot enable a public listener', (t) => {
  const directory = workspace(t)
  const options = frontendArguments(['--', '--port', '8190'])
  const spec = frontendSpecification({ workspace: directory, inherited: {}, ...options })
  assert.deepEqual(spec.args.slice(1), ['--host', '127.0.0.1', '--port', '8190', '--strictPort'])
  for (const args of [
    ['--host', '0.0.0.0'],
    ['--port', '0'],
    ['--port', '65536'],
    ['--port', 'abc'],
  ])
    assert.throws(() => frontendArguments(args))
})

test('preview rejects invalid API addresses without including their values in diagnostics', (t) => {
  for (const value of [
    'ftp://service.example/api',
    'https://user:private@service.example/api',
    'invalid',
  ]) {
    assert.throws(
      () =>
        frontendSpecification({
          workspace: workspace(t),
          inherited: { VITE_API_BASE_URL: value },
        }),
      (error) => error.code === 'FRONTEND_API_BASE_URL_INVALID' && !error.message.includes(value),
    )
  }
})

test('dual frontend entry keeps --port on Website and gives admin its own override and environment', async (t) => {
  const lines = []
  t.mock.method(console, 'log', (line) => lines.push(line))
  const directory = workspace(
    t,
    'LOCAL_ADMIN_WEB_PORT=5273\nADMIN_API_PROXY_TARGET=http://127.0.0.1:8787\nVITE_API_BASE_URL=https://website.example/api',
  )
  const options = frontendArguments(['--port', '8190', '--admin-port', '5373'])
  assert.deepEqual(options, { port: 8190, adminPort: 5373 })
  await main({ ...options, workspace: directory, inherited: {} }, async (specs, controls) => {
    assert.equal(specs.length, 2)
    assert.equal(specs[0].readinessUrl, 'http://127.0.0.1:8190/')
    assert.equal(specs[1].readinessUrl, 'http://127.0.0.1:5373/')
    assert.equal(specs[0].environment.VITE_API_BASE_URL, 'https://website.example/api')
    assert.equal(specs[1].environment.ADMIN_API_PROXY_TARGET, 'http://127.0.0.1:8787')
    assert.equal('VITE_API_BASE_URL' in specs[1].environment, false)
    assert.equal('ADMIN_API_PROXY_TARGET' in specs[0].environment, false)
    assert.equal(controls.signal.aborted, false)
    assert.equal(typeof controls.onReady, 'function')
    assert.equal(
      lines.some((line) => line.includes('可访问')),
      false,
    )
    controls.onReady()
    assert.equal(lines.filter((line) => line.includes('可访问')).length, 2)
  })
})
