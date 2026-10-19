import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { root } from './shared.mjs'
import { runOwned } from './ownership.mjs'
import { LocalError } from './local-config.mjs'
import { preparationContext, sdkPreparationSpecifications } from './sdk-preparation.mjs'
import { reporter } from './output.mjs'

/** Build needs no runtime receipt, database, Docker or backend credentials. */
export function buildSpecifications({ workspace = root, inherited = process.env, tools } = {}) {
  const context = preparationContext({ workspace, inherited, tools }),
    { node, corepack } = context.tools
  const os = context.environment
  const publicEnv = { ...os, NODE_ENV: 'production', VITE_API_BASE_URL: '/api' }
  return [
    ...sdkPreparationSpecifications({ workspace, inherited, tools: context.tools }).map((spec) => ({
      ...spec,
      environment: publicEnv,
    })),
    ...['@workspace/web', '@workspace/server'].map((name) => ({
      name,
      command: node,
      cwd: workspace,
      args: [corepack, 'pnpm', '--filter', name, 'build'],
      environment: publicEnv,
    })),
  ]
}
export async function main(options = {}, execute = runOwned) {
  const output = reporter({ verbose: options.verbose })
  output.title('构建 Website（不启动后台服务）')
  for (const spec of buildSpecifications(options)) {
    try {
      await output.stage(spec.name, (onLog) => execute(spec, { onLog }))
    } catch {
      throw new LocalError(
        `RUNTIME_BUILD_FAILED:${spec.name}`,
        'fix this build stage; no infrastructure was changed',
      )
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (
      process.argv.slice(2).some((value) => value !== '--verbose') ||
      process.argv.slice(2).length > 1
    )
      throw new LocalError('RUNTIME_BUILD_ARGUMENTS_INVALID')
    await main({ verbose: process.argv.includes('--verbose') })
  } catch (error) {
    console.error(error instanceof LocalError ? error.message : 'RUNTIME_BUILD_FAILED')
    process.exitCode = 1
  }
}
