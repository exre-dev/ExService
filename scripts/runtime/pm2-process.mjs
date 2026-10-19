import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runOwned, signalScope } from './ownership.mjs'
import { root } from './shared.mjs'
import { hydraSpecification } from './infrastructure.mjs'
import { logWriter } from './logs.mjs'
import { RuntimeError } from './output.mjs'

export function processSpecification(state, service) {
  if (service === 'hydra') return hydraSpecification(state, ['serve', 'all'])
  if (!['server'].includes(service)) throw new RuntimeError('PM2_SERVICE_INVALID')
  return {
    name: service,
    command: state.values.INTEGRATION_NODE_BIN ?? process.execPath,
    args: ['dist/server.js'],
    cwd: join(state.workspace, 'apps/server'),
    environment: state.environments[service],
  }
}

/** The root adapter creates one consumer-specific snapshot; no other service secrets are included. */
export function processRecord(state, service) {
  return {
    version: 1,
    service,
    workspace: state.workspace,
    directory: state.directory,
    specification: processSpecification(state, service),
    logs: {
      maxBytes: Number(state.values.RUNTIME_LOG_MAX_BYTES ?? 10485760),
      retain: Number(state.values.RUNTIME_LOG_RETAIN ?? 5),
    },
  }
}
export function wrapperRecord(service, environment = process.env) {
  let record
  try {
    record = JSON.parse(environment.EXWEBSITE_RUNTIME_PROCESS)
  } catch {
    throw new RuntimeError('PM2_PROCESS_ENV_INVALID')
  }
  if (
    record.version !== 1 ||
    record.service !== service ||
    resolve(record.workspace) !== root ||
    resolve(record.directory) !== join(root, '.local/runtime') ||
    !record.specification?.environment ||
    !Array.isArray(record.specification.args)
  )
    throw new RuntimeError('PM2_PROCESS_ENV_INVALID')
  return record
}
export async function main(service) {
  const record = wrapperRecord(service),
    scope = signalScope()
  const log = logWriter(join(record.directory, 'logs', `${service}.jsonl`), {
    environment: record.specification.environment,
    ...record.logs,
  })
  try {
    await runOwned(record.specification, { signal: scope.signal, onLog: log })
  } catch (error) {
    log(service, error instanceof RuntimeError ? error.message : '应用退出', 'error')
    throw error
  } finally {
    scope.close()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new RuntimeError('PM2_ARGUMENTS_INVALID')
    await main(process.argv[2])
  } catch {
    process.exitCode = 1
  }
}
