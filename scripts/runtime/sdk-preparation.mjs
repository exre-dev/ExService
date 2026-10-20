import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './shared.mjs'
import { LocalError } from './local-config.mjs'
import { operatingEnvironment, environmentFile, withNodePath } from './settings.mjs'
import { runOwned } from './ownership.mjs'

/** Select tools from the root file; never forward backend credentials. */
export function preparationContext({ workspace = root, inherited = process.env, tools } = {}) {
  const configured = environmentFile(join(workspace, '.env.local'))
  tools ??= {
    node: inherited.INTEGRATION_NODE_BIN ?? configured.INTEGRATION_NODE_BIN ?? process.execPath,
  }
  if (!existsSync(tools.node)) throw new LocalError('RUNTIME_BUILD_TOOLS_MISSING')
  return { tools, environment: withNodePath(operatingEnvironment(inherited), tools.node) }
}
export function sdkPreparationSpecifications(options = {}) {
  const workspace = options.workspace ?? root,
    { tools, environment } = preparationContext(options)
  return [
    {
      name: 'API Contract',
      cwd: workspace,
      args: [join(workspace, 'scripts/api/generate.mjs'), 'generate'],
    },
    {
      name: '@workspace/sdk',
      cwd: join(workspace, 'packages/sdk'),
      args: [join(workspace, 'packages/sdk/node_modules/vite/bin/vite.js'), 'build'],
    },
    {
      name: 'SDK declarations',
      cwd: join(workspace, 'packages/sdk'),
      args: [
        join(workspace, 'packages/sdk/node_modules/rollup/dist/bin/rollup'),
        '-c',
        'rollup.config.dts.mjs',
      ],
    },
  ].map((spec) => ({ ...spec, command: tools.node, environment }))
}
/** Consumers begin only after generation, bundle and declarations finish successfully. */
export async function prepareSdk({ execute = runOwned, onLog, signal, ...options } = {}) {
  for (const specification of sdkPreparationSpecifications(options)) {
    signal?.throwIfAborted()
    await execute(specification, { onLog, signal })
  }
  signal?.throwIfAborted()
}
