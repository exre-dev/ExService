import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { root } from './shared.mjs'
import { prepareSdk, sdkPreparationSpecifications } from './sdk-preparation.mjs'
import { typecheckSpecifications, main as typecheck } from './typecheck.mjs'
import { runTests, watchTests, isTestSourceChange, testSpecifications } from './tests.mjs'
import { isSdkSourceChange, watchSdkSources } from './sdk-watch.mjs'

const tools = { node: process.execPath }
const options = {
  workspace: root,
  tools,
  inherited: { DATABASE_URL: 'secret', AUTH_CODE_HMAC_KEY: 'secret', NODE_OPTIONS: '--inspect' },
}

test('SDK preparation serially generates Contract then builds only SDK with a restricted environment', async () => {
  const specs = sdkPreparationSpecifications(options),
    calls = [],
    controller = new AbortController()
  assert.deepEqual(
    specs.map((spec) => spec.name),
    ['API Contract', '@workspace/sdk', 'SDK declarations'],
  )
  assert.deepEqual(specs[0].args, [join(root, 'scripts/api/generate.mjs'), 'generate'])
  assert.deepEqual(specs[1].args, [
    join(root, 'packages/sdk/node_modules/vite/bin/vite.js'),
    'build',
  ])
  assert.deepEqual(specs[2].args, [
    join(root, 'packages/sdk/node_modules/rollup/dist/bin/rollup'),
    '-c',
    'rollup.config.dts.mjs',
  ])
  assert.ok(
    specs.every(
      (spec) =>
        !spec.environment.DATABASE_URL &&
        !spec.environment.AUTH_CODE_HMAC_KEY &&
        !spec.environment.NODE_OPTIONS,
    ),
  )
  await prepareSdk({
    ...options,
    signal: controller.signal,
    execute: async (spec, received) => {
      assert.equal(received.signal, controller.signal)
      calls.push(spec.name)
    },
  })
  assert.deepEqual(calls, ['API Contract', '@workspace/sdk', 'SDK declarations'])
})

test('preparation failure or cancellation prevents SDK consumers and later stages', async () => {
  for (const stage of ['API Contract', '@workspace/sdk', 'SDK declarations']) {
    const calls = []
    await assert.rejects(
      prepareSdk({
        ...options,
        execute: async (spec) => {
          calls.push(spec.name)
          if (spec.name === stage) throw new Error(stage)
        },
      }),
      new RegExp(stage),
    )
    assert.equal(calls.at(-1), stage)
    let consumed = false
    await assert.rejects(
      typecheck(
        options,
        async () => {
          consumed = true
        },
        async () => {
          throw new Error('prepare failed')
        },
      ),
      /prepare failed/,
    )
    assert.equal(consumed, false)
  }
  const controller = new AbortController(),
    calls = []
  await assert.rejects(
    prepareSdk({
      ...options,
      signal: controller.signal,
      execute: async (spec) => {
        calls.push(spec.name)
        controller.abort()
      },
    }),
  )
  assert.deepEqual(calls, ['API Contract'])
})

test('typecheck and each test pass prepare SDK before consumers without building applications', async () => {
  const calls = []
  await typecheck(
    options,
    async (spec) => calls.push(spec.name),
    async (received) => {
      assert.equal(received.workspace, root)
      calls.push('prepare')
    },
  )
  assert.deepEqual(calls, ['prepare', ...typecheckSpecifications(options).map((spec) => spec.name)])
  assert.deepEqual(
    typecheckSpecifications(options).map((spec) => spec.args),
    [
      ...['apps/web', 'packages/components', 'packages/sdk'].map((directory) => [
        join(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '-p',
        directory + '/tsconfig.json',
      ]),
      [
        join(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit',
        '-p',
        'tests/sdk/types/tsconfig.json',
      ],
    ],
  )
  calls.length = 0
  for (let pass = 0; pass < 2; pass++)
    await runTests(
      options,
      async (spec) => calls.push(spec.name),
      async () => calls.push('prepare'),
    )
  assert.deepEqual(calls, ['prepare', 'Website', 'runtime', 'prepare', 'Website', 'runtime'])
  assert.ok(
    testSpecifications(options)[1].args.includes('scripts/runtime/sdk-preparation.test.mjs'),
  )
  assert.ok(testSpecifications(options)[1].args.includes('scripts/runtime/dev-rebuild.test.mjs'))
})

test('SDK and test watchers reject generated directory creation, outputs, temporaries and logs', () => {
  for (const [directory, path] of [
    ['packages/sdk', 'src/generated'],
    ['packages/sdk', 'src/generated/schema.d.ts.random.tmp'],
    ['packages/sdk', 'dist'],
    ['packages/sdk', 'dist/node.js'],
    ['packages/sdk', 'node_modules'],
    ['packages/sdk', '.dts-temp/index.d.ts'],
    ['packages/sdk', 'build/tmp'],
    ['packages/sdk', 'src/index.ts.random.tmp'],
    ['packages/sdk', 'build.log'],
  ]) {
    assert.equal(isSdkSourceChange(directory, path), false, `${directory}/${path}`)
    assert.equal(isTestSourceChange(directory, path), false, `${directory}/${path}`)
  }
  for (const [directory, path] of [
    ['apps/php-server/api/generated', 'openapi.internal.yaml'],
    ['packages/sdk', 'src\\http\\core.ts'],
    ['packages/sdk', 'package.json'],
    ['packages/sdk', 'tsconfig.build.json'],
    ['packages/sdk', 'vite.config.ts'],
    ['packages/sdk', 'rollup.config.dts.mjs'],
  ])
    assert.equal(isSdkSourceChange(directory, path), true, `${directory}/${path}`)
  assert.equal(isSdkSourceChange('apps/web/src', 'main.tsx'), false)
})

test('SDK watcher forwards source events and closes every watcher after a partial setup failure', () => {
  const watches = [],
    changed = [],
    closed = []
  const watchDirectory = (directory, _options, callback) => {
    const watcher = {
      on() {},
      close() {
        closed.push(directory)
      },
    }
    watches.push({ directory, callback })
    return watcher
  }
  const watcher = watchSdkSources(root, () => changed.push('source'), { watchDirectory })
  watches[0].callback('rename', 'openapi.internal.yaml')
  watches[1].callback('rename', 'dist')
  watches[1].callback('change', 'src/index.ts')
  assert.deepEqual(changed, ['source', 'source'])
  watcher.close()
  assert.equal(closed.length, 2)
  let call = 0
  assert.throws(
    () =>
      watchSdkSources(root, () => {}, {
        watchDirectory: (...args) => {
          if (++call === 2) throw new Error('watch failed')
          return watchDirectory(...args)
        },
      }),
    /watch failed/,
  )
  assert.equal(closed.length, 3)
})

test('SDK watcher attempts every close even when one watcher fails to close', () => {
  let calls = 0,
    closes = 0
  const watcher = watchSdkSources(root, () => {}, {
    watchDirectory() {
      const current = ++calls
      return {
        on() {},
        close() {
          closes++
          if (current === 1) throw new Error('close failed')
        },
      }
    },
  })
  assert.throws(() => watcher.close())
  assert.equal(closes, 2)
})

test('test watch coalesces changes, waits after failure and ignores its own preparation outputs', async () => {
  const controller = new AbortController(),
    watches = new Map(),
    closed = [],
    previousExit = process.exitCode
  let calls = 0,
    finish
  const running = watchTests(
    { workspace: root, signal: controller.signal },
    async () => {
      calls++
      if (calls === 1)
        await new Promise((resolve) => {
          finish = resolve
        })
      else if (calls === 2) throw new Error('fixture failure')
    },
    {
      watchDirectory(directory, _options, callback) {
        watches.set(directory, callback)
        return {
          on() {},
          close() {
            closed.push(directory)
          },
        }
      },
    },
  )
  try {
    while (!finish) await delay(5)
    watches.get(join(root, 'apps/php-server/api/generated'))('rename', 'openapi.internal.yaml')
    watches.get(join(root, 'packages/sdk'))('change', 'src/generated/schema.d.ts')
    watches.get(join(root, 'packages/sdk'))('change', 'src/index.ts')
    watches.get(join(root, 'packages/sdk'))('change', 'package.json')
    finish()
    for (let i = 0; calls < 2 && i < 100; i++) await delay(5)
    await delay(25)
    assert.equal(calls, 2)
    watches.get(join(root, 'packages/sdk'))('change', 'dist/index.d.ts')
    await delay(25)
    assert.equal(calls, 2)
    watches.get(join(root, 'packages/sdk'))('change', 'src/index.ts')
    for (let i = 0; calls < 3 && i < 100; i++) await delay(5)
    assert.equal(calls, 3)
  } finally {
    controller.abort()
    await running
    process.exitCode = previousExit
  }
  assert.equal(closed.length, watches.size)
})
