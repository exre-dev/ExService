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
  assert.deepEqual(spec.args.slice(1), ['--host', '127.0.0.1', '--port', '8080', '--strictPort'])
  assert.equal(spec.environment.VITE_API_BASE_URL, '/')
  assert.equal(spec.environment.PHP_SERVER_ORIGIN, 'http://127.0.0.1:8787')
})

test('frontend preview reads the root API address without passing secrets or other VITE variables', (t) => {
  const directory = workspace(
    t,
    [
      'VITE_API_BASE_URL=https://service.example/deploy',
      'PHP_SERVER_ORIGIN=http://127.0.0.1:8887',
      'DATABASE_PASSWORD=private-database',
      'VITE_UNRELATED_SECRET=private-value',
      'IDENTITY_FLOW_KEY=private-identity',
    ].join('\n'),
  )
  const spec = frontendSpecification({ workspace: directory, inherited: {} })
  assert.equal(spec.environment.VITE_API_BASE_URL, 'https://service.example/deploy')
  assert.equal(spec.environment.PHP_SERVER_ORIGIN, 'http://127.0.0.1:8887')
  for (const key of ['DATABASE_PASSWORD', 'VITE_UNRELATED_SECRET', 'IDENTITY_FLOW_KEY'])
    assert.equal(key in spec.environment, false)
})

test('process overrides win without inheriting the full runtime gateway or backend secrets', (t) => {
  const directory = workspace(
    t,
    'VITE_API_BASE_URL=https://file.example/deploy\nPHP_SERVER_ORIGIN=http://127.0.0.1:8887',
  )
  const spec = frontendSpecification({
    workspace: directory,
    inherited: {
      VITE_API_BASE_URL: 'https://process.example/deploy',
      PHP_SERVER_ORIGIN: 'http://127.0.0.1:8987',
      WEBSITE_DEV_ENTRY_PORT: '8080',
      SERVER_PUBLIC_WEB_BASE_URL: 'https://canonical.example',
      VITE_UNRELATED_SECRET: 'private-value',
    },
  })
  assert.equal(spec.environment.VITE_API_BASE_URL, 'https://process.example/deploy')
  assert.equal(spec.environment.PHP_SERVER_ORIGIN, 'http://127.0.0.1:8987')
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
    '/',
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
  await main(
    { ...options, workspace: directory, inherited: {} },
    {
      acquireLock: () => ({}),
      supervise: async (controls) => {
        const specs = controls.specifications
        assert.equal(specs.length, 2)
        assert.equal(specs[0].args.at(-2), '8190')
        assert.equal(specs[1].args.at(-2), '5373')
        assert.equal(specs[0].environment.VITE_API_BASE_URL, 'https://website.example/api')
        assert.equal(specs[1].environment.ADMIN_API_PROXY_TARGET, 'http://127.0.0.1:8787')
        assert.equal('VITE_API_BASE_URL' in specs[1].environment, false)
        assert.equal('ADMIN_API_PROXY_TARGET' in specs[0].environment, false)
        assert.equal(
          lines.some((line) => line.includes('可访问')),
          false,
        )
        controls.onReady()
        assert.equal(lines.filter((line) => line.includes('可访问')).length, 2)
      },
    },
  )
})

test('legacy API prefix and non-origin PHP targets fail closed', (t) => {
  const directory = workspace(t)
  assert.throws(() =>
    frontendSpecification({ workspace: directory, inherited: { VITE_API_BASE_URL: '/api' } }),
  )
  for (const value of [
    'https://user:secret@php.test',
    'http://php.test/path',
    'http://php.test?x=1',
    'http://php.test#x',
    'http://php.test?',
    'http://php.test#',
    'ftp://php.test',
    'http://php.test/../',
  ])
    assert.throws(
      () =>
        frontendSpecification({ workspace: directory, inherited: { PHP_SERVER_ORIGIN: value } }),
      value,
    )
})
