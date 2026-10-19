import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { acquireLock, identityAlive, processIdentity } from './ownership.mjs'
import { atomicJson, digest, readJson, LocalError } from './local-config.mjs'

/** A dead Windows helper closes its private kill-on-close JobObject. Recovery
 * proves that whole generation is gone; it never reconstructs PID capabilities. */
function childrenOf(pid) {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${pid}' | Where-Object { $_.ProcessId -ne $PID } | Select-Object -ExpandProperty ProcessId)`,
    ],
    { encoding: 'utf8', windowsHide: true, shell: false, timeout: 10000 },
  )
  if (result.error || result.status !== 0) throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
  try {
    const values = JSON.parse(result.stdout.trim())
    if (!Array.isArray(values)) throw new Error()
    return values
  } catch {
    throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
  }
}
export function acquireApplicationLock(
  state,
  {
    inspect = processIdentity,
    platform = process.platform,
    inspectChildren = childrenOf,
    persist = atomicJson,
  } = {},
) {
  const path = join(state.directory, 'applications-lock.json'),
    runPath = join(state.directory, 'run.json')
  const prior = existsSync(path) ? readJson(path) : undefined
  let recovered
  const recover =
    prior?.cleanupRequired || prior?.state === 'cleanup-failed'
      ? (record) => {
          if (!record) return { cleanupRequired: false }
          const run = readJson(runPath)
          if (
            platform !== 'win32' ||
            record.persistent ||
            !/^[a-f0-9-]{36}$/.test(record.runId) ||
            !Array.isArray(record.children) ||
            ![
              'preparing',
              'rebuilding',
              'rebuild-failed',
              'starting',
              'ready',
              'stopping',
              'stopped',
              'cleanup-failed',
            ].includes(run.state) ||
            ['version', 'mode', 'fingerprint', 'runId', 'identity', 'children', 'resources'].some(
              (key) => digest(record[key]) !== digest(run[key]),
            ) ||
            !record.resources ||
            Object.keys(record.resources).sort().join(',') !==
              'containerProofs,createdStopped,preRunning,started' ||
            Object.values(record.resources).some((value) => !Array.isArray(value) || value.length)
          )
            throw new LocalError(
              'APPLICATION_RECOVERY_PROOF_INVALID',
              'inspect the original application run and its private process identities',
            )
          if (
            identityAlive(record.identity, inspect) ||
            record.children.some((child) => identityAlive(child.identity, inspect)) ||
            inspectChildren(record.identity.pid).length
          )
            throw new LocalError('MODE_CHILDREN_STILL_ACTIVE')
          recovered = { lock: record, run }
          return {
            recovery: { runId: record.runId },
            cleanupRequired: false,
            resources: record.resources,
          }
        }
      : undefined
  const lock = acquireLock({
    mode: 'local',
    fingerprint: state.fingerprint,
    directory: state.directory,
    name: 'applications-lock.json',
    inspect,
    recoverCleanup: recover,
    externalCheck: (record) => {
      if (record && platform === 'win32' && inspectChildren(record.identity.pid).length)
        throw new LocalError('MODE_CHILDREN_STILL_ACTIVE')
      if (recovered)
        persist(
          join(state.directory, 'recovered-applications', `${recovered.run.runId}.json`),
          recovered,
        )
    },
  })
  if (recovered)
    persist(runPath, { ...recovered.run, children: [], state: 'stopped', cleanupRequired: false })
  return lock
}
