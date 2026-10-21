import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import {
  acquireLock,
  identityAlive,
  processIdentity,
  redact,
  sameIdentity,
  spawnOwned,
  stopOwned,
} from './ownership.mjs'
import { assertPortFree, supervise } from './local-dev.mjs'
import { atomicJson, LocalError, readJson } from './local-config.mjs'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
const identity = (pid) => ({
  pid,
  creation: 'creation',
  executable: 'node',
  commandDigest: 'command',
})
test('a stale short gate refuses automatic unlink so a concurrent replacement can never lose its lock', () => {
  const directory = mkdtempSync(join(tmpdir(), 'stale-gate-')),
    path = join(directory, 'mode-lock.json.gate')
  try {
    const content = JSON.stringify({ identity: identity(987654) })
    writeFileSync(path, content)
    assert.throws(
      () =>
        acquireLock({
          mode: 'local',
          fingerprint: 'fixture',
          directory,
          inspect: (pid) => (pid === process.pid ? identity(pid) : null),
        }),
      /MODE_GATE_STALE/,
    )
    assert.equal(readFileSync(path, 'utf8'), content)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('short gates refuse live and ambiguous owners without deleting either record', () => {
  const directory = mkdtempSync(join(tmpdir(), 'live-gate-')),
    path = join(directory, 'mode-lock.json.gate')
  try {
    for (const [owner, expected] of [
      [identity(process.pid), /MODE_OPERATION_BUSY/],
      [{ pid: 1234 }, /MODE_OWNER_AMBIGUOUS/],
    ]) {
      const content = JSON.stringify({ identity: owner })
      writeFileSync(path, content)
      assert.throws(
        () => acquireLock({ mode: 'full', fingerprint: 'fixture', directory, inspect: identity }),
        expected,
      )
      assert.equal(readFileSync(path, 'utf8'), content)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('frontend lock refuses live or unfinished owners and only reclaims a proven stopped run', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'frontend-lock-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const inspect = (pid) => (pid === process.pid ? identity(pid) : null)
  const lock = acquireLock({ mode: 'frontend', fingerprint: 'fixture', directory, inspect })
  assert.throws(
    () => acquireLock({ mode: 'frontend', fingerprint: 'fixture', directory, inspect }),
    /MODE_ACTIVE/,
  )
  const prior = { ...lock.record, identity: identity(987654) }
  for (const state of ['preflight', 'preparing', 'ready', 'cleanup-failed']) {
    atomicJson(lock.path, { ...prior, state })
    assert.throws(
      () => acquireLock({ mode: 'frontend', fingerprint: 'fixture', directory, inspect }),
      /CLEANUP_REQUIRED/,
    )
    assert.equal(readJson(lock.path).runId, prior.runId)
  }
  atomicJson(lock.path, {
    ...prior,
    state: 'stopped',
    cleanupRequired: false,
    children: [{ identity: identity(process.pid) }],
  })
  assert.throws(
    () => acquireLock({ mode: 'frontend', fingerprint: 'fixture', directory, inspect }),
    /CHILDREN_STILL_ACTIVE/,
  )
  atomicJson(lock.path, { ...prior, state: 'stopped', cleanupRequired: false, children: [] })
  const replacement = acquireLock({ mode: 'frontend', fingerprint: 'changed', directory, inspect })
  assert.notEqual(replacement.record.runId, prior.runId)
  replacement.release()
})
test('fresh process identity includes Windows creation/executable/command and refuses a reused PID', () => {
  const actual = processIdentity(process.pid)
  assert.equal(actual.pid, process.pid)
  assert.ok(actual.creation)
  assert.ok(actual.executable)
  assert.match(actual.commandDigest, /^[a-f0-9]{64}$/)
  assert.equal(identityAlive({ ...actual, creation: 'different' }), false)
  assert.equal(sameIdentity(actual, processIdentity(process.pid)), true)
})
test('real fixture child and descendants are cleaned while an independent child survives', async () => {
  const fixture = resolve('tests/dev/fixture-process.mjs'),
    messages = []
  const spec = (action) => ({
    name: 'fixture',
    command: process.execPath,
    args: [fixture, action],
    environment: process.env,
    cwd: resolve('.'),
  })
  const foreign = await spawnOwned(spec('wait'))
  let owned
  try {
    owned = await spawnOwned(spec('descendant'), { onLog: (_, line) => messages.push(line) })
    for (
      let count = 0;
      count < 100 && !messages.some((line) => line.startsWith('DESCENDANT:'));
      count++
    )
      await delay(50)
    const descendant = Number(
      messages.find((line) => line.startsWith('DESCENDANT:'))?.split(':')[1],
    )
    assert.ok(descendant)
    const descendantIdentity = processIdentity(descendant)
    await stopOwned([owned])
    assert.equal(identityAlive(owned.identity), false)
    assert.equal(identityAlive(descendantIdentity), false)
    assert.equal(identityAlive(foreign.identity), true)
  } finally {
    await stopOwned([...(owned ? [owned] : []), foreign])
  }
})

test('control stop during real owned SDK preparation cleans its helper and descendants before releasing the lock', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owned-sdk-prepare-')),
    messages = []
  const lock = acquireLock({ mode: 'local', fingerprint: 'fixture', directory }),
    release = lock.release
  let preparer,
    descendant,
    launched = false
  lock.release = () => {
    assert.equal(identityAlive(preparer), false)
    assert.equal(identityAlive(descendant), false)
    release()
  }
  const running = supervise({
    directory,
    lock,
    mode: 'local',
    fingerprint: 'fixture',
    pollInterval: 25,
    specifications: [{ name: 'server' }],
    readiness: async () => {
      launched = true
    },
    onLog: (_name, line) => messages.push(line),
    prepareGeneration: ({ execute }) =>
      execute({
        name: 'SDK build',
        command: process.execPath,
        cwd: resolve('.'),
        args: [resolve('tests/dev/fixture-process.mjs'), 'descendant'],
        environment: process.env,
      }),
  })
  try {
    for (let count = 0; count < 200; count++) {
      if (
        messages.some((line) => line.startsWith('DESCENDANT:')) &&
        readJson(join(directory, 'run.json')).children.length
      )
        break
      await delay(50)
    }
    const run = readJson(join(directory, 'run.json'))
    assert.equal(run.state, 'preparing')
    assert.equal(run.children.length, 1)
    assert.equal(run.children[0].name, 'SDK build')
    preparer = run.children[0].identity
    const pid = Number(messages.find((line) => line.startsWith('DESCENDANT:'))?.split(':')[1])
    assert.ok(pid)
    descendant = processIdentity(pid)
    atomicJson(join(directory, 'control-request.json'), {
      runId: lock.record.runId,
      action: 'stop',
    })
    await running
    assert.equal(launched, false)
    assert.equal(existsSync(lock.path), false)
    assert.equal(readJson(join(directory, 'run.json')).state, 'stopped')
  } finally {
    atomicJson(join(directory, 'control-request.json'), {
      runId: lock.record.runId,
      action: 'stop',
    })
    await running.catch(() => {})
    release()
    rmSync(directory, { recursive: true, force: true })
  }
})
test('child logs redact original database credentials, identity URLs/tokens/challenges and SQL', () => {
  const environment = {
    DATABASE_URL: 'postgres://user:secret@host/exre',
    AUTH_CODE_HMAC_KEY: 'sensitive-hmac',
    IDENTITY_FLOW_KEY: 'flow-secret',
  }
  const line = redact(
    'postgres://user:secret@host/exre https://identity.test/?challenge=private sensitive-hmac flow-secret SELECT secret FROM users',
    environment,
  )
  assert.doesNotMatch(line, /private|secret|sensitive-hmac|flow-secret|SELECT|identity.test/)
})
test(
  'unexpected root child exit closes its private Windows Job and cleans already-orphaned descendants',
  { skip: process.platform !== 'win32' },
  async () => {
    const messages = []
    const owned = await spawnOwned(
      {
        name: 'unexpected',
        command: process.execPath,
        args: [resolve('tests/dev/fixture-process.mjs'), 'descendant-exit'],
        environment: process.env,
        cwd: resolve('.'),
      },
      { onLog: (_, line) => messages.push(line) },
    )
    try {
      for (
        let count = 0;
        count < 100 && !messages.some((line) => line.startsWith('DESCENDANT:'));
        count++
      )
        await delay(50)
      const pid = Number(messages.find((line) => line.startsWith('DESCENDANT:'))?.split(':')[1])
      assert.ok(Number.isSafeInteger(pid) && pid > 0)
      const result = await owned.exited
      assert.equal(result.code, 7)
      // The Job may drain before the first CIM observation; after helper exit,
      // the reported descendant PID must be absent in either timing.
      assert.equal(processIdentity(pid), null)
    } finally {
      await stopOwned([owned])
    }
  },
)
test('two real independently spawned contenders cannot acquire the same cross-mode mutex', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'mode-race-')),
    messages = [],
    children = []
  try {
    children.push(
      ...(await Promise.all(
        ['local', 'full'].map((mode) =>
          spawnOwned(
            {
              name: mode,
              command: process.execPath,
              args: [resolve('tests/dev/fixture-process.mjs'), 'lock', directory, mode],
              environment: process.env,
              cwd: resolve('.'),
            },
            { onLog: (_name, line) => messages.push(line) },
          ),
        ),
      )),
    )
    assert.deepEqual(
      (await Promise.all(children.map((child) => child.exited))).map((value) => value.code).sort(),
      [0, 2],
    )
    assert.equal(messages.filter((value) => value === 'LOCK_ACQUIRED').length, 1)
    assert.equal(
      messages.some((value) => ['MODE_ACTIVE', 'MODE_OPERATION_BUSY'].includes(value)),
      true,
    )
  } finally {
    await stopOwned(children)
    rmSync(directory, { recursive: true, force: true })
  }
})
test(
  'failed real CIM discovery drains the fresh helper Job before throwing and preserves an independent child',
  { skip: process.platform !== 'win32' },
  async () => {
    const spec = {
      name: 'failed-identity',
      command: process.execPath,
      args: [resolve('tests/dev/fixture-process.mjs'), 'descendant'],
      environment: process.env,
      cwd: resolve('.'),
    }
    const foreign = await spawnOwned({
        ...spec,
        args: [resolve('tests/dev/fixture-process.mjs'), 'wait'],
      }),
      messages = []
    let helper, descendant
    try {
      await assert.rejects(
        spawnOwned(spec, {
          onLog: (_name, line) => messages.push(line),
          inspect: async (pid) => {
            for (
              let count = 0;
              count < 100 && !messages.some((value) => value.startsWith('DESCENDANT:'));
              count++
            )
              await delay(50)
            helper = processIdentity(pid)
            descendant = processIdentity(
              Number(messages.find((value) => value.startsWith('DESCENDANT:'))?.split(':')[1]),
            )
            throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
          },
        }),
        /PROCESS_IDENTITY_UNAVAILABLE/,
      )
      assert.equal(identityAlive(helper), false)
      assert.equal(identityAlive(descendant), false)
      assert.equal(identityAlive(foreign.identity), true)
    } finally {
      await stopOwned([foreign])
    }
  },
)
test(
  'partial supervisor startup keeps its mode lock until a failed-discovery helper, siblings, descendants and port are cleaned',
  { skip: process.platform !== 'win32' },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'partial-cim-')),
      messages = [],
      identities = []
    const portServer = createServer()
    await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve))
    const port = portServer.address().port
    await new Promise((resolve) => portServer.close(resolve))
    const lock = acquireLock({ mode: 'local', fingerprint: 'fixture', directory }),
      release = lock.release
    let starts = 0,
      descendant
    lock.release = () => {
      assert.equal(
        identities.every((identity) => !identityAlive(identity)),
        true,
      )
      assert.equal(identityAlive(descendant), false)
      release()
    }
    try {
      await assert.rejects(
        supervise({
          mode: 'local',
          fingerprint: 'fixture',
          directory,
          controlDirectory: directory,
          lock,
          specifications: [{ name: 'first' }, { name: 'second' }],
          readiness: async () => {},
          onLog() {},
          spawnChild: async (specification) => {
            const number = ++starts,
              spec = {
                ...specification,
                command: process.execPath,
                cwd: resolve('.'),
                environment: process.env,
                args: [
                  resolve('tests/dev/fixture-process.mjs'),
                  number === 1 ? 'wait' : 'descendant-port',
                  String(port),
                ],
              }
            if (number === 1) {
              const owned = await spawnOwned(spec)
              identities.push(owned.identity)
              return owned
            }
            try {
              return await spawnOwned(spec, {
                onLog: (_name, line) => messages.push(line),
                inspect: async (pid) => {
                  for (let count = 0; count < 100 && !messages.includes('PORT_READY'); count++)
                    await delay(50)
                  assert.equal(messages.includes('PORT_READY'), true)
                  identities.push(processIdentity(pid))
                  descendant = processIdentity(
                    Number(
                      messages.find((value) => value.startsWith('DESCENDANT:'))?.split(':')[1],
                    ),
                  )
                  throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
                },
              })
            } catch (error) {
              assert.equal(existsSync(lock.path), true)
              assert.equal(identityAlive(identities.at(-1)), false)
              assert.equal(identityAlive(descendant), false)
              await assertPortFree(port)
              throw error
            }
          },
        }),
        /PROCESS_IDENTITY_UNAVAILABLE/,
      )
      assert.equal(existsSync(lock.path), false)
      await assertPortFree(port)
    } finally {
      release()
      rmSync(directory, { recursive: true, force: true })
    }
  },
)
