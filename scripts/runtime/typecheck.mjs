import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root } from './shared.mjs'
import { prepareSdk, preparationContext } from './sdk-preparation.mjs'
import { runOwned, signalScope } from './ownership.mjs'
import { reporter } from './output.mjs'
import { LocalError } from './local-config.mjs'

export function typecheckSpecifications(options = {}) {
  const { tools, environment } = preparationContext(options),
    workspace = options.workspace ?? root
  return [
    ...['apps/web', 'apps/admin-web', 'packages/components', 'packages/sdk'].map((directory) => ({
      name: directory,
      project: directory + '/tsconfig.json',
    })),
    { name: 'SDK types', project: 'tests/sdk/types/tsconfig.json' },
  ].map(({ name, project }) => ({
    name,
    command: tools.node,
    cwd: workspace,
    args: [join(workspace, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', project],
    environment,
  }))
}
export async function main(options = {}, execute = runOwned, prepare = prepareSdk) {
  const scope = signalScope(),
    output = reporter({ verbose: options.verbose })
  try {
    await output.stage('Contract / SDK', (onLog) =>
      prepare({ ...options, execute, onLog, signal: scope.signal }),
    )
    for (const spec of typecheckSpecifications(options)) {
      scope.check()
      await output.stage(spec.name, (onLog) => execute(spec, { onLog, signal: scope.signal }))
    }
  } finally {
    scope.close()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length > 1 || args.some((value) => value !== '--verbose'))
      throw new LocalError('TYPECHECK_ARGUMENTS_INVALID')
    await main({ verbose: args.includes('--verbose') })
  } catch {
    console.error('类型检查失败；检查上方准备和类型检查日志。')
    process.exitCode = 1
  }
}
