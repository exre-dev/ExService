import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import test from 'node:test'
import { root } from './shared.mjs'
import { runTests, testSpecifications, watchTests } from './tests.mjs'

const tools = { node: process.execPath }

function selectedFiles(website) {
  // Exercise Vitest's real discovery using its installed Node CLI.
  const args = website.args
    .slice(1)
    .flatMap((argument) => (argument === 'run' ? ['list', '--filesOnly', '--json'] : [argument]))
  const listing = spawnSync(
    process.execPath,
    [join(root, 'node_modules/vitest/vitest.mjs'), ...args],
    {
      cwd: website.cwd,
      env: website.environment,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    },
  )
  assert.equal(listing.status, 0, listing.stderr)
  return new Set(
    JSON.parse(listing.stdout).map(({ file }) => relative(root, file).replaceAll('\\', '/')),
  )
}

test('default verification leaves HTTP, browser, package-build and process-ownership fixtures to full verification', () => {
  const [website, runtime] = testSpecifications({ tools })
  const files = selectedFiles(website)
  for (const file of [
    'apps/web/src/auth/AuthFlow.test.tsx',
    'apps/web/src/api/client.integration.test.ts',
    'packages/components/src/ErrorPanel.test.tsx',
    'packages/common/src/feedback-content/index.test.ts',
    'tests/sdk/request.test.ts',
  ])
    assert.ok(files.has(file), `missing lightweight coverage: ${file}`)
  for (const file of [
    'tests/sdk/public-package.test.ts',
    'apps/web/src/content/compiler.integration.test.ts',
    'apps/web/src/api/client.scope.test.tsx',
    'apps/web/src/routes/DevelopmentEntry.test.ts',
  ])
    assert.ok(!files.has(file), `slow fixture selected by default: ${file}`)
  for (const file of [
    'scripts/runtime/ownership.test.mjs',
    'scripts/api/generate.test.mjs',
    'packages/common/test/entry.test.mjs',
  ])
    assert.ok(!runtime.args.includes(file), `slow script selected by default: ${file}`)
  assert.ok(runtime.args.includes('scripts/runtime/tests.test.mjs'))
})

test('full verification discovers transport, Chromium, development proxy and surviving runtime fixtures', () => {
  const [website, runtime] = testSpecifications({ full: true, tools })
  const files = selectedFiles(website)
  for (const file of [
    'tests/sdk/public-package.test.ts',
    'tests/sdk/http-core.test.ts',
    'tests/dev/proxy-boundary.test.ts',
  ])
    assert.ok(files.has(file), `full verification lost ${file}`)
  for (const file of [
    'scripts/api/generate.test.mjs',
    'tests/browser/browser-suite.test.mjs',
    'packages/common/test/entry.test.mjs',
    'scripts/runtime/settings.test.mjs',
    'scripts/runtime/frontend.test.mjs',
    'scripts/runtime/output.test.mjs',
    'scripts/runtime/ownership.test.mjs',
    'scripts/runtime/readiness.test.mjs',
    'scripts/runtime/sdk-preparation.test.mjs',
    'scripts/runtime/dev-rebuild.test.mjs',
  ])
    assert.ok(runtime.args.includes(file), `full verification lost ${file}`)
})

test('watch keeps the selected profile and prepares SDK before either verification profile', async () => {
  for (const full of [false, true]) {
    const controller = new AbortController(),
      calls = []
    await watchTests(
      { full, tools, signal: controller.signal },
      async (options) => {
        assert.equal(options.full, full)
        await runTests(
          options,
          async (spec) => calls.push(spec.name),
          async () => calls.push('prepare'),
        )
        controller.abort()
      },
      { watchDirectory: () => ({ close() {} }) },
    )
    assert.deepEqual(calls, ['prepare', 'Website', 'runtime'])
  }
})

test('admin source changes queue the next verification pass and release every watcher on cancellation', async () => {
  const controller = new AbortController()
  const callbacks = new Map()
  const closed = []
  let runs = 0
  await watchTests(
    { signal: controller.signal },
    async () => {
      runs++
      if (runs === 1) {
        const changed = callbacks.get('apps/admin-web/src')
        if (changed) changed('change', 'api/client.ts')
        else controller.abort()
      } else controller.abort()
    },
    {
      watchDirectory(directory, _options, changed) {
        const name = relative(root, directory).replaceAll('\\', '/')
        callbacks.set(name, changed)
        return { close: () => closed.push(name) }
      },
    },
  )
  assert.equal(runs, 2)
  assert.equal(closed.length, callbacks.size)
  assert.ok(closed.includes('apps/admin-web/src'))
})
