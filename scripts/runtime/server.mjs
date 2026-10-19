import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { root } from './shared.mjs'
import { LocalError } from './local-config.mjs'
import { readRuntimeConfiguration } from './settings.mjs'
import { prepareSdk } from './sdk-preparation.mjs'
import { runOwned, signalScope } from './ownership.mjs'

export function serverSpecification(
  action,
  args = [],
  { workspace = root, inherited = process.env } = {},
) {
  const entries = {
    dev: 'src/server.ts',
    start: 'dist/server.js',
    'db:migrate': 'src/db/migrate.ts',
    'db:reset': 'src/db/reset.ts',
    'sso:create': 'src/cli/sso-create.ts',
    'sso:inspect': 'src/cli/sso-inspect.ts',
    'auth:disable': 'src/cli/auth-disable.ts',
    'auth:enable': 'src/cli/auth-enable.ts',
    'integration:check': 'src/cli/integration-check.ts',
    'support-feedback': 'src/cli/support-feedback.ts',
  }
  if (!Object.hasOwn(entries, action)) throw new LocalError('RUNTIME_SERVER_ACTION_INVALID')
  // Only the root adapter's explicit service snapshot bypasses configuration loading.
  const environment =
    inherited.RUNTIME_ENV_INJECTED === 'true'
      ? inherited
      : readRuntimeConfiguration({ workspace, inherited }).environments.server
  const compiled = action !== 'dev' && environment.NODE_ENV === 'production'
  const entry = compiled
    ? entries[action].replace(/^src\//, 'dist/').replace(/\.ts$/, '.js')
    : entries[action]
  return {
    command: process.execPath,
    cwd: join(workspace, 'apps/server'),
    environment,
    args: [
      ...(action === 'start' || compiled ? [] : ['--import', 'tsx']),
      ...(action === 'dev' ? ['--watch'] : []),
      entry,
      ...(args[0] === '--' ? args.slice(1) : args),
    ],
  }
}
/** Maintenance stdout/stderr are CLI data, not development log records. */
async function runServerCli(specification, { signal } = {}) {
  signal?.throwIfAborted()
  const child = spawn(specification.command, specification.args, {
    cwd: specification.cwd,
    env: specification.environment,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  })
  const interrupt = () => {
    if (!child.killed) child.kill('SIGTERM')
  }
  signal?.addEventListener('abort', interrupt, { once: true })
  if (signal?.aborted) interrupt()
  try {
    return await new Promise((resolve, reject) => {
      child.once('error', () => reject(new LocalError('APP_SPAWN_FAILED')))
      child.once('close', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0) }))
    })
  } finally {
    signal?.removeEventListener('abort', interrupt)
  }
}

export async function main(
  action = process.argv[2],
  args = process.argv.slice(3),
  { workspace = root, inherited = process.env, execute, prepare = prepareSdk } = {},
) {
  const scope = signalScope(),
    onLog = (name, line) => console.log(`[${name}] ${line}`)
  const executeChild = execute ?? (action === 'dev' ? runOwned : runServerCli)
  try {
    if (action === 'dev')
      await prepare({ workspace, inherited, execute: executeChild, signal: scope.signal, onLog })
    scope.check()
    const result = await executeChild(serverSpecification(action, args, { workspace, inherited }), {
      signal: scope.signal,
      onLog,
    })
    if (action !== 'dev' && result?.code !== undefined) process.exitCode = result.code
  } finally {
    scope.close()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof LocalError ? error.message : 'RUNTIME_SERVER_FAILED')
    process.exitCode = 1
  }
}
