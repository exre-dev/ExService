import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, delimiter } from 'node:path'
import { tmpdir } from 'node:os'
import { environmentFile, operatingEnvironment, withNodePath, publicSettings } from './settings.mjs'
import { buildSpecifications } from './build.mjs'

function workspace(t) {
  const path = mkdtempSync(join(tmpdir(), 'frontend-settings-'))
  t.after(() => rmSync(path, { recursive: true, force: true }))
  return path
}
test('tool environment strips PHP secrets, arbitrary VITE values and executable injection', () => {
  const value = operatingEnvironment({
    PATH: 'fixture',
    SYSTEMROOT: 'system',
    PHP_DATABASE_PASSWORD: 'db-secret',
    REDIS_PASSWORD: 'redis-secret',
    JWT_SECRET: 'jwt-secret',
    NODE_OPTIONS: '--require evil',
    VITE_SECRET: 'secret',
    PM2_HOME: 'old-daemon',
  })
  assert.deepEqual(value, { PATH: 'fixture', SYSTEMROOT: 'system' })
  const normalized = withNodePath({ Path: 'fixture' }, process.execPath)
  assert.deepEqual(normalized, { PATH: dirname(process.execPath) + delimiter + 'fixture' })
})
test('environment parsing accepts a missing root file and fails closed on unreadable input', (t) => {
  const root = workspace(t)
  assert.deepEqual(environmentFile(join(root, '.env.local')), {})
  writeFileSync(join(root, '.env.local'), 'VITE_API_BASE_URL=https://site.test/deploy\n')
  assert.equal(
    environmentFile(join(root, '.env.local')).VITE_API_BASE_URL,
    'https://site.test/deploy',
  )
  mkdirSync(join(root, 'directory'))
  assert.throws(() => environmentFile(join(root, 'directory')), { code: 'ENV_INVALID' })
})
test('build prepares SDK then Web using only the public root and tool environment', (t) => {
  const root = workspace(t)
  writeFileSync(
    join(root, '.env.local'),
    'VITE_API_BASE_URL=https://file.test/prefix\nPHP_SERVER_ORIGIN=http://127.0.0.1:8787\nJWT_SECRET=file-secret',
  )
  const tools = { node: process.execPath }
  const specs = buildSpecifications({
    workspace: root,
    tools,
    inherited: { VITE_API_BASE_URL: 'https://process.test/site', JWT_SECRET: 'process-secret' },
  })
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
  for (const spec of specs) {
    assert.equal(
      spec.environment.VITE_API_BASE_URL,
      spec.name === '@workspace/admin-web' ? undefined : 'https://process.test/site',
    )
    assert.equal(spec.environment.JWT_SECRET, undefined)
    assert.equal(spec.environment.PHP_SERVER_ORIGIN, undefined)
  }
})
test('service root keeps a remote deployment prefix and refuses legacy relative prefixes', () => {
  assert.equal(publicSettings().VITE_API_BASE_URL, '/')
  assert.equal(
    publicSettings({ VITE_API_BASE_URL: 'https://api.test/deploy' }).VITE_API_BASE_URL,
    'https://api.test/deploy',
  )
  for (const value of [
    '/api',
    '/deployment',
    '//api.test',
    'https://api.test?',
    'https://api.test#',
    'https://user@api.test',
    'https://api.test\\evil',
  ])
    assert.throws(() => publicSettings({ VITE_API_BASE_URL: value }), {
      code: 'FRONTEND_API_BASE_URL_INVALID',
    })
})
