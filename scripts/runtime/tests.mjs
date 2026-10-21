import { watch } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOwned, signalScope } from './ownership.mjs'
import { root } from './shared.mjs'
import { reporter, RuntimeError } from './output.mjs'
import { prepareSdk, preparationContext } from './sdk-preparation.mjs'
import { isGeneratedOutput } from './sdk-watch.mjs'

export function testSpecifications({
  workspace = root,
  inherited = process.env,
  tools,
  full = false,
} = {}) {
  const {
    tools: { node },
    environment,
  } = preparationContext({ workspace, inherited, tools })
  const logic = [
    { file: 'scripts/api/generate.test.mjs', fullOnly: true },
    { file: 'scripts/api/operation-policy.test.mjs' },
    { file: 'tests/browser/browser-suite.test.mjs' },
    { file: 'packages/common/test/entry.test.mjs', fullOnly: true },
    { file: 'scripts/runtime/settings.test.mjs' },
    { file: 'scripts/runtime/frontend.test.mjs' },
    { file: 'scripts/runtime/admin-frontend.test.mjs' },
    { file: 'scripts/runtime/frontend-group.test.mjs' },
    { file: 'scripts/runtime/admin-web-integration.test.mjs' },
    { file: 'scripts/runtime/output.test.mjs' },
    { file: 'scripts/runtime/ownership.test.mjs', fullOnly: true },
    { file: 'scripts/runtime/readiness.test.mjs', fullOnly: true },
    { file: 'scripts/runtime/sdk-preparation.test.mjs' },
    { file: 'scripts/runtime/dev-rebuild.test.mjs' },
    { file: 'scripts/runtime/tests.test.mjs' },
  ]
    .filter(({ fullOnly }) => full || !fullOnly)
    .map(({ file }) => file)
  return [
    // Bound CPU concurrency for transport timing and browser compilation fixtures.
    {
      name: 'Website',
      command: node,
      cwd: workspace,
      args: [
        join(workspace, 'node_modules/vitest/vitest.mjs'),
        'run',
        '--maxWorkers',
        '2',
        '--config',
        full ? 'vitest.config.ts' : 'vitest.quick.config.ts',
      ],
      environment,
    },
    { name: 'runtime', command: node, cwd: workspace, args: ['--test', ...logic], environment },
  ]
}

export async function runTests(options = {}, execute = runOwned, prepare = prepareSdk) {
  const output = reporter({ verbose: options.verbose })
  output.title(
    options.full
      ? '完整测试：Contract / SDK → Website → runtime；包含 HTTP、SDK 浏览器与进程清理夹具'
      : '轻量测试：Contract / SDK → Website → runtime；完整验证使用 pnpm test:full',
  )
  const scope = signalScope()
  const signal = options.signal ? AbortSignal.any([scope.signal, options.signal]) : scope.signal
  try {
    scope.check()
    await output.stage('Contract / SDK', (onLog) =>
      prepare({ ...options, workspace: options.workspace ?? root, execute, onLog, signal }),
    )
    for (const spec of testSpecifications(options)) {
      scope.check()
      signal.throwIfAborted()
      await output.stage(spec.name, (onLog) => execute(spec, { onLog, signal }))
    }
  } finally {
    scope.close()
  }
}

/** Generated files, including publication temporaries, must never queue another pass. */
export function isTestSourceChange(directory, path) {
  if (!path) return false
  const file = `${directory}/${path}`.replaceAll('\\', '/')
  return (
    (!file.startsWith('apps/php-server/') ||
      file === 'apps/php-server/api/generated/openapi.internal.yaml') &&
    !isGeneratedOutput(file) &&
    (!/(?:^|\/)build(?:\/|$)/.test(file) || file.startsWith('apps/web/build/')) &&
    !file.endsWith('.log')
  )
}

/** Changes queue another pass of the selected profile; runs never overlap. */
export async function watchTests(
  options = {},
  execute = runTests,
  { watchDirectory = watch } = {},
) {
  const workspace = options.workspace ?? root,
    scope = signalScope(),
    watchers = []
  const signal = options.signal ? AbortSignal.any([scope.signal, options.signal]) : scope.signal
  let pending = true,
    wake
  const directories = [
    'apps/php-server/api/generated',
    'tests',
    'scripts',
    'apps/web/src',
    'apps/admin-web/src',
    'packages/components/src',
    'packages/sdk',
    'packages/common/src',
    'packages/common/test',
    'apps/web/content',
    'apps/web/build',
    'apps/web/source.config.ts',
  ]
  try {
    for (const directory of directories)
      watchers.push(
        watchDirectory(join(workspace, directory), { recursive: true }, (_, path) => {
          if (isTestSourceChange(directory, path)) {
            pending = true
            wake?.()
          }
        }),
      )
    while (!signal.aborted) {
      if (pending) {
        pending = false
        try {
          await execute({ ...options, signal })
          process.exitCode = 0
        } catch {
          console.error('本轮自动验证失败；监听下一次修改。')
          process.exitCode = 1
        }
      } else
        await new Promise((resolve) => {
          const done = () => {
            signal.removeEventListener('abort', done)
            wake = undefined
            resolve()
          }
          wake = done
          signal.addEventListener('abort', done, { once: true })
          if (signal.aborted || pending) done()
        })
    }
  } finally {
    watchers.forEach((watcher) => watcher.close())
    scope.close()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (
      args.some((value) => !['--watch', '--verbose', '--full'].includes(value)) ||
      new Set(args).size !== args.length
    )
      throw new RuntimeError('TEST_ARGUMENTS_INVALID')
    await (args.includes('--watch') ? watchTests : runTests)({
      verbose: args.includes('--verbose'),
      full: args.includes('--full'),
    })
  } catch {
    console.error('自动验证失败；检查上方分组和用例日志。')
    process.exitCode = 1
  }
}
