import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  adminFrontendArguments,
  readAdminFrontendConfiguration,
  adminFrontendSpecification,
} from './admin-frontend.mjs'

function workspace(t, contents = '') {
  const directory = mkdtempSync(join(tmpdir(), 'admin-frontend-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(join(directory, '.env.local'), contents)
  return directory
}

test('admin configuration uses CLI, process, root file, then defaults', (t) => {
  const directory = workspace(t)
  assert.deepEqual(readAdminFrontendConfiguration({ workspace: directory, inherited: {} }), {
    port: 5173,
    apiProxyTarget: 'http://127.0.0.1:8787',
    node: process.execPath,
  })
  writeFileSync(
    join(directory, '.env.local'),
    'LOCAL_ADMIN_WEB_PORT=5273\nADMIN_API_PROXY_TARGET=https://file.example/\nINTEGRATION_NODE_BIN=file-node',
  )
  assert.deepEqual(readAdminFrontendConfiguration({ workspace: directory, inherited: {} }), {
    port: 5273,
    apiProxyTarget: 'https://file.example',
    node: 'file-node',
  })
  const inherited = {
    LOCAL_ADMIN_WEB_PORT: '5373',
    ADMIN_API_PROXY_TARGET: 'https://process.example/',
    INTEGRATION_NODE_BIN: 'process-node',
  }
  const options = adminFrontendArguments(['--', '--port', '5473'])
  assert.deepEqual(
    readAdminFrontendConfiguration({ workspace: directory, inherited, adminPort: options.port }),
    {
      port: 5473,
      apiProxyTarget: 'https://process.example',
      node: 'process-node',
    },
  )
  assert.equal(readAdminFrontendConfiguration({ workspace: directory, inherited }).port, 5373)
})

test('admin ports reject present invalid values and accept boundaries without exposing values', (t) => {
  const directory = workspace(t)
  for (const port of ['1024', '65535'])
    assert.equal(
      readAdminFrontendConfiguration({
        workspace: directory,
        inherited: { LOCAL_ADMIN_WEB_PORT: port },
      }).port,
      Number(port),
    )
  for (const value of ['', '1023', '65536', '5.2', 'invalid-port', ' 5173 ', null]) {
    assert.throws(
      () =>
        readAdminFrontendConfiguration({
          workspace: directory,
          inherited: { LOCAL_ADMIN_WEB_PORT: value },
        }),
      (error) => error.code === 'PORT_INVALID' && error.keys.includes('LOCAL_ADMIN_WEB_PORT'),
    )
    assert.throws(() =>
      readAdminFrontendConfiguration({ workspace: directory, inherited: {}, adminPort: value }),
    )
  }
  writeFileSync(join(directory, '.env.local'), 'LOCAL_ADMIN_WEB_PORT=')
  assert.throws(() => readAdminFrontendConfiguration({ workspace: directory, inherited: {} }))
  assert.throws(() => adminFrontendArguments(['--host', '0.0.0.0']))
})

test('admin proxy accepts only raw HTTP(S) origins and hides invalid input', (t) => {
  const directory = workspace(t)
  for (const value of [
    '',
    'ftp://example.com',
    'https://user:password@example.com',
    'http://@example.com',
    'http://example.com/api',
    'http://example.com/../',
    'http://example.com/?',
    'http://example.com/#',
    'http://example.com\\path',
    ' http://example.com',
    'http://example.com?x=secret',
  ])
    assert.throws(
      () =>
        readAdminFrontendConfiguration({
          workspace: directory,
          inherited: { ADMIN_API_PROXY_TARGET: value },
        }),
      (error) =>
        error.code === 'ADMIN_API_PROXY_TARGET_INVALID' &&
        error.keys.includes('ADMIN_API_PROXY_TARGET') &&
        (!value || !error.message.includes(value)),
    )
  writeFileSync(join(directory, '.env.local'), 'ADMIN_API_PROXY_TARGET=')
  assert.throws(() => readAdminFrontendConfiguration({ workspace: directory, inherited: {} }))
  assert.equal(
    readAdminFrontendConfiguration({
      workspace: directory,
      inherited: { ADMIN_API_PROXY_TARGET: 'http://[::1]:8787/' },
    }).apiProxyTarget,
    'http://[::1]:8787',
  )
})

test('admin specification isolates public proxy environment and uses its own Vite and selected Node', (t) => {
  const directory = workspace(
    t,
    'DATABASE_PASSWORD=secret\nVITE_API_BASE_URL=https://website.example/api',
  )
  const configuration = {
    port: 5273,
    apiProxyTarget: 'http://127.0.0.1:8787',
    node: process.execPath,
  }
  const inherited = {
    Path: 'tools',
    DATABASE_PASSWORD: 'secret',
    VITE_API_BASE_URL: 'private',
    VITE_OTHER: 'private',
    LOCAL_API_PORT: '8888',
    NODE_OPTIONS: '--inspect',
    ADMIN_API_PROXY_TARGET: 'invalid',
  }
  const spec = adminFrontendSpecification({
    workspace: directory,
    inherited,
    configuration,
    node: 'chosen-node',
  })
  assert.equal(spec.name, 'admin-web')
  assert.equal(spec.command, 'chosen-node')
  assert.equal(spec.cwd, join(directory, 'apps/admin-web'))
  assert.deepEqual(spec.args, [
    join(directory, 'apps/admin-web/node_modules/vite/bin/vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    '5273',
    '--strictPort',
  ])
  assert.equal(spec.environment.NODE_ENV, 'development')
  assert.equal(spec.environment.ADMIN_API_PROXY_TARGET, configuration.apiProxyTarget)
  for (const key of [
    'DATABASE_PASSWORD',
    'VITE_API_BASE_URL',
    'VITE_OTHER',
    'LOCAL_API_PORT',
    'NODE_OPTIONS',
    'Path',
  ])
    assert.equal(key in spec.environment, false)
})
