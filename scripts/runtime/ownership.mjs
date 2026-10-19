import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { atomicJson, digest, LocalError, readJson } from './local-config.mjs'
import { localRoot } from './shared.mjs'
import { redact as redactRuntime } from './output.mjs'

/** PID is only an address. Creation time, executable and command are the authority. */
export function processIdentity(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new LocalError('PROCESS_IDENTITY_INVALID')
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if ($null -eq $p) { 'null' } else { [pscustomobject]@{ pid=[int]$p.ProcessId; creation=$p.CreationDate.ToUniversalTime().ToString('O'); executable=$p.ExecutablePath; command=$p.CommandLine } | ConvertTo-Json -Compress }`,
      ],
      { encoding: 'utf8', shell: false, windowsHide: true },
    )
    if (result.status !== 0) throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
    let value
    try {
      value = JSON.parse(result.stdout.trim())
    } catch {
      throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
    }
    if (value === null) return null
    if (!value.executable || !value.command || !value.creation)
      throw new LocalError('PROCESS_IDENTITY_AMBIGUOUS')
    return {
      pid: value.pid,
      creation: value.creation,
      executable: value.executable.toLowerCase(),
      commandDigest: digest(value.command),
    }
  }
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const executable = readFileSync(`/proc/${pid}/cmdline`).toString().split('\0')[0]
    return {
      pid,
      creation: stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19],
      executable,
      commandDigest: createHash('sha256')
        .update(readFileSync(`/proc/${pid}/cmdline`))
        .digest('hex'),
    }
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return null
    throw new LocalError('PROCESS_IDENTITY_AMBIGUOUS')
  }
}
export function sameIdentity(left, right) {
  return !!left && !!right && digest(left) === digest(right)
}
export function identityAlive(identity, inspect = processIdentity) {
  if (!identity?.pid || !identity.creation || !identity.commandDigest || !identity.executable)
    throw new LocalError('MODE_OWNER_AMBIGUOUS', 'stop the original supervisor in its own terminal')
  return sameIdentity(identity, inspect(identity.pid))
}
export function acquireLock({
  mode,
  fingerprint,
  directory = localRoot,
  name = 'mode-lock.json',
  runId = randomUUID(),
  inspect = processIdentity,
  externalCheck = () => {},
  recoverCleanup,
}) {
  mkdirSync(directory, { recursive: true })
  const path = join(directory, name),
    gate = `${path}.gate`
  const identity = inspect(process.pid)
  if (!identity) throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
  let gateOwned = false,
    recovery
  try {
    try {
      writeFileSync(gate, JSON.stringify({ identity }), { flag: 'wx', mode: 0o600 })
      gateOwned = true
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const prior = readJson(gate, 'MODE_GATE_INVALID')
      if (identityAlive(prior.identity, inspect)) throw new LocalError('MODE_OPERATION_BUSY')
      // Deleting a stale gate cannot be compare-and-swap on Windows: another
      // contender may have installed a live gate between inspection and unlink.
      throw new LocalError(
        'MODE_GATE_STALE',
        'verify the recorded gate owner is gone, then explicitly remove only this stale .gate file',
      )
    }
    if (existsSync(path)) {
      const prior = readJson(path, 'MODE_LOCK_INVALID')
      const protectedCleanup =
        prior.cleanupRequired ||
        prior.state === 'cleanup-failed' ||
        (prior.mode === 'local' &&
          prior.state !== 'stopped' &&
          (prior.resources?.started?.length > 0 || prior.resources?.createdStopped?.length > 0))
      if (protectedCleanup && !recoverCleanup)
        throw new LocalError(
          'MODE_CLEANUP_REQUIRED',
          'stop the original owner in its terminal; inspect the preserved ownership record',
        )
      if (
        recoverCleanup &&
        (prior.version !== 1 ||
          prior.mode !== mode ||
          prior.fingerprint !== fingerprint ||
          !prior.runId)
      )
        throw new LocalError('MODE_RECOVERY_PROVENANCE_CONFLICT')
      if (prior.persistent && !recoverCleanup) {
        externalCheck(prior)
        throw new LocalError(
          'MODE_ACTIVE',
          'stop the original owner in its terminal; inspect the preserved ownership record',
        )
      }
      if (identityAlive(prior.identity, inspect))
        throw new LocalError(
          'MODE_ACTIVE',
          'stop the original owner in its terminal; inspect the preserved ownership record',
        )
      if (
        Array.isArray(prior.children) &&
        prior.children.some((child) => identityAlive(child.identity, inspect))
      )
        throw new LocalError(
          'MODE_CHILDREN_STILL_ACTIVE',
          'inspect the original run; no stale PIDs were killed',
        )
      if (
        !recoverCleanup &&
        prior.mode === 'local' &&
        prior.state === 'preflight' &&
        !prior.resources &&
        (mode !== prior.mode || fingerprint !== prior.fingerprint)
      )
        throw new LocalError(
          'MODE_CLEANUP_REQUIRED',
          'inspect the preserved application ownership record before retrying',
        )
      if (recoverCleanup) {
        recovery = recoverCleanup(prior)
        // Intent precedes external proof/archive writes: if they fail, ordinary
        // contenders must not reclaim this exited owner's remaining journal.
        atomicJson(path, {
          ...prior,
          ...recovery,
          version: prior.version,
          runId: prior.runId,
          mode: prior.mode,
          fingerprint: prior.fingerprint,
          identity: prior.identity,
          cleanupRequired: true,
        })
      }
      try {
        externalCheck(prior)
      } catch (error) {
        if (recoverCleanup) {
          try {
            atomicJson(path, { ...readJson(path), state: 'cleanup-failed', cleanupRequired: true })
          } catch {}
        }
        throw error
      }
      // Verification and preservation happen while the private gate is held,
      // before replacing the only remaining journal of an exited supervisor.
    } else if (recoverCleanup) {
      recovery = recoverCleanup(undefined)
      writeFileSync(
        path,
        JSON.stringify(
          {
            version: 1,
            runId,
            mode,
            fingerprint,
            identity,
            state: 'stopping',
            cleanupRequired: true,
            ...recovery,
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx', mode: 0o600 },
      )
      try {
        externalCheck(undefined)
      } catch (error) {
        try {
          atomicJson(path, { ...readJson(path), state: 'cleanup-failed', cleanupRequired: true })
        } catch {}
        throw error
      }
    } else externalCheck(undefined)
    const record = {
      version: 1,
      runId,
      mode,
      fingerprint,
      identity,
      state: 'preflight',
      createdAt: new Date().toISOString(),
      ...(recoverCleanup ? { cleanupRequired: true, ...recovery } : {}),
    }
    if (existsSync(path)) atomicJson(path, record)
    else writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    return {
      path,
      record,
      update(extra) {
        if (readJson(path).runId !== runId) throw new LocalError('MODE_OWNERSHIP_CHANGED')
        Object.assign(record, extra)
        atomicJson(path, record)
      },
      release() {
        if (existsSync(path) && readJson(path).runId === runId) rmSync(path)
      },
    }
  } finally {
    if (gateOwned) rmSync(gate, { force: true })
  }
}
export function redact(text, environment = {}) {
  let value = redactRuntime(text, environment)
  for (const [key, secret] of Object.entries(environment)) {
    if (
      /PASSWORD|SECRET|KEY|TOKEN|DATABASE_URL|REDIS_URL/i.test(key) &&
      secret &&
      secret.length >= 8
    )
      value = value.split(secret).join('[REDACTED]')
  }
  return value
    .replace(/(?:postgres(?:ql)?|redis|https?):\/\/[^\s"'<>]+/gi, '[URL]')
    .replace(
      /(?:authorization|token|challenge|secret|password|sql|query)\s*[:=][^\r\n]*/gi,
      '[REDACTED]',
    )
    .replace(/\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE)\b[^\r\n]*/gi, '[SQL]')
}
export function signalScope() {
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  return {
    signal: controller.signal,
    check() {
      if (controller.signal.aborted)
        throw new LocalError('RUN_INTERRUPTED', 'retry the explicit operation')
    },
    close() {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
    },
  }
}
export async function spawnOwned(
  specification,
  { onLog = () => {}, inspect = processIdentity, signal } = {},
) {
  if (signal?.aborted) throw new LocalError('RUN_INTERRUPTED')
  const jobScript = fileURLToPath(new URL('./owned-process.ps1', import.meta.url))
  const payload = Buffer.from(
    JSON.stringify({
      command: specification.command,
      args: specification.args,
      cwd: specification.cwd,
    }),
  ).toString('base64')
  const command = process.platform === 'win32' ? 'powershell.exe' : specification.command
  const args =
    process.platform === 'win32'
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          jobScript,
          '-SpecificationBase64',
          payload,
        ]
      : specification.args
  const child = spawn(command, args, {
    cwd: specification.cwd,
    env: specification.environment,
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: [process.platform === 'win32' ? 'pipe' : 'ignore', 'pipe', 'pipe'],
  })
  child.stdin?.on('error', () => {})
  const exited = new Promise((resolve) => {
    child.once('error', () => resolve({ code: 1, error: true }))
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
  for (const stream of [child.stdout, child.stderr]) {
    let pending = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      pending += chunk
      const lines = pending.split(/\r?\n/)
      pending = lines.pop()
      for (const line of lines)
        onLog(
          specification.name,
          redact(line, specification.environment),
          stream === child.stderr ? 'stderr' : 'stdout',
        )
      if (pending.length > 16384) {
        onLog(specification.name, '[LOG_TRUNCATED]')
        pending = ''
      }
    })
    stream.on('end', () => {
      if (pending)
        onLog(
          specification.name,
          redact(pending, specification.environment),
          stream === child.stderr ? 'stderr' : 'stdout',
        )
    })
  }
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', () => reject(new LocalError('APP_SPAWN_FAILED')))
  })
  let identity
  const abandonFreshSpawn = async () => {
    // This pipe was created by this spawn, not reconstructed from a PID. EOF
    // instructs the helper to terminate and drain its private JobObject.
    if (process.platform === 'win32') child.stdin.end()
    else child.kill('SIGTERM')
    await exited
  }
  try {
    identity = await inspect(child.pid)
  } catch (error) {
    // CIM can observe a just-completed helper while its executable is already unavailable.
    // A completed freshly spawned handle needs no PID authority or termination.
    await Promise.race([exited, delay(100)])
    if (child.exitCode === null && child.signalCode === null) {
      await abandonFreshSpawn()
      throw error
    }
  }
  if (!identity && child.exitCode === null && child.signalCode === null) {
    await Promise.race([exited, delay(100)])
    if (child.exitCode === null && child.signalCode === null) {
      await abandonFreshSpawn()
      throw new LocalError('APP_EXITED_DURING_START')
    }
  }
  const owned = { child, identity, exited, specification }
  const abort = () => {
    void stopOwned([owned]).catch(() => {
      process.exitCode = 1
    })
  }
  if (signal) {
    signal.addEventListener('abort', abort, { once: true })
    exited.then(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  }
  return owned
}
export async function stopOwned(children, { inspect = processIdentity } = {}) {
  const failures = []
  for (const owned of [...children].reverse()) {
    if (!owned.identity && (owned.child.exitCode !== null || owned.child.signalCode !== null))
      continue
    if (!identityAlive(owned.identity, inspect)) continue
    if (process.platform === 'win32') {
      if (!owned.child.stdin) throw new LocalError('OWNED_PROCESS_CAPABILITY_MISSING')
      owned.child.stdin.end()
    } else {
      try {
        process.kill(-owned.identity.pid, 'SIGTERM')
      } catch (error) {
        if (error.code !== 'ESRCH') failures.push(owned)
      }
    }
  }
  await Promise.all(children.map((owned) => Promise.race([owned.exited, delay(5000)])))
  for (const owned of children) {
    if (!owned.identity && (owned.child.exitCode !== null || owned.child.signalCode !== null))
      continue
    if (!identityAlive(owned.identity, inspect)) continue
    if (process.platform !== 'win32') {
      try {
        process.kill(-owned.identity.pid, 'SIGKILL')
      } catch {}
    } else failures.push(owned)
  }
  if (failures.length)
    throw new LocalError(
      'OWNED_PROCESS_CLEANUP_FAILED',
      'stop this run in its original terminal; do not kill stale PIDs',
    )
}
export async function runOwned(specification, options = {}) {
  const child = await spawnOwned(specification, options)
  try {
    const result = await child.exited
    options.onLog?.(
      specification.name,
      `CHILD_EXIT code=${result.code ?? 'signal'}${result.signal ? ` signal=${result.signal}` : ''}`,
    )
    if (result.code !== 0)
      throw new LocalError(options.code ?? 'PREPARATION_CHILD_FAILED', options.next)
    return result
  } finally {
    await stopOwned([child])
  }
}
