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

/**
 * `processIdentity` 的契约：存活进程返回完整身份，进程不存在返回 `null`（CIM 故障才抛错）。
 *
 * 因此"取不到身份"就是"进程已经消失"，必须如实判定为已清理，而不是交给
 * `identityAlive` 抛 `MODE_OWNER_AMBIGUOUS`——那是个与被测语义无关的错误码，会把
 * 上层断言引到错误的失败形态上（例如等 `PROCESS_IDENTITY_UNAVAILABLE` 却拿到它）。
 * 判定力不减：进程若真的还在，`processIdentity` 会返回真身份，这里就会如实报"活着"。
 */
function identityGone(identity) {
  return identity === null || identity === undefined ? true : !identityAlive(identity)
}

/**
 * 等到某个身份真的消失。
 *
 * Job 关闭后代进程、以及后代打印自己的 PID，都由操作系统异步完成。一次性快照在负载下
 * 会把"还没死"误判成"没被清理"，因此这里在固定上界内等待，超时仍然失败——
 * 判定力不变（Job 真的漏掉后代时用例照旧红），只是不再要求清理是瞬时的。
 */
async function waitUntilDead(identity, timeoutMs = 10_000) {
  if (identity === null || identity === undefined) return true
  // 上界按墙钟计算：每次 identityAlive 都要起一次 powershell（1–2.3 秒），
  // 按次数计会让失败路径跑满上百次查询、几分钟才收敛。
  const until = Date.now() + timeoutMs
  for (;;) {
    if (!identityAlive(identity)) return true
    if (Date.now() >= until) return false
    await delay(100)
  }
}

/** 按墙钟上界等待 fixture 子进程打印某行；负载下启动与 stdout 刷新都可能变慢。 */
async function waitForMessage(messages, prefix, timeoutMs = 15_000) {
  const until = Date.now() + timeoutMs
  for (;;) {
    const line = messages.find((value) => value.startsWith(prefix))
    if (line !== undefined) return line
    if (Date.now() >= until) return undefined
    await delay(50)
  }
}

/** 等到 fixture 后代把自己的 PID 打出来。 */
async function waitForDescendant(messages) {
  const line = await waitForMessage(messages, 'DESCENDANT:')
  return line === undefined ? undefined : Number(line.split(':')[1])
}
test('empty preflight recovery preserves normalized evidence before a failed external proof and never changes the old owner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zero-recovery-')),
    path = join(directory, 'mode-lock.json')
  const prior = {
    version: 1,
    mode: 'local',
    fingerprint: 'fixture',
    runId: '11111111-1111-4111-8111-111111111111',
    identity: identity(987654),
    state: 'preflight',
  }
  const inspect = (pid) => (pid === process.pid ? identity(pid) : null)
  try {
    writeFileSync(path, JSON.stringify(prior))
    for (const [mode, fingerprint] of [
      ['dev', 'fixture'],
      ['full', 'fixture'],
      ['local', 'different'],
    ])
      assert.throws(
        () => acquireLock({ mode, fingerprint, directory, inspect }),
        /CLEANUP_REQUIRED/,
      )
    assert.equal(JSON.parse(readFileSync(path)).runId, prior.runId)
    const resources = { started: [], preRunning: [], createdStopped: [], containerProofs: [] }
    assert.throws(
      () =>
        acquireLock({
          mode: 'local',
          fingerprint: 'fixture',
          directory,
          inspect,
          recoverCleanup: () => ({ recovery: { ...prior, resources }, resources }),
          externalCheck: () => {
            throw new LocalError('FIXTURE_UNKNOWN_TARGET')
          },
        }),
      /UNKNOWN_TARGET/,
    )
    const retained = JSON.parse(readFileSync(path))
    assert.deepEqual(retained.identity, prior.identity)
    assert.equal(retained.runId, prior.runId)
    assert.deepEqual(retained.resources, resources)
    assert.equal(retained.cleanupRequired, true)
    assert.throws(
      () => acquireLock({ mode: 'local', fingerprint: 'fixture', directory, inspect }),
      /CLEANUP_REQUIRED/,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('explicit persistent recovery still rejects a live owner and validates the dead owner inside the gate', () => {
  const directory = mkdtempSync(join(tmpdir(), 'persistent-recovery-')),
    path = join(directory, 'mode-lock.json')
  const prior = {
    version: 1,
    mode: 'full',
    fingerprint: 'fixture',
    runId: '11111111-1111-4111-8111-111111111111',
    identity: identity(987654),
    persistent: true,
  }
  try {
    writeFileSync(path, JSON.stringify(prior))
    assert.throws(
      () =>
        acquireLock({
          mode: 'full',
          fingerprint: 'fixture',
          directory,
          inspect: identity,
          recoverCleanup: () => ({}),
        }),
      /MODE_ACTIVE/,
    )
    let verified = false
    const lock = acquireLock({
      mode: 'full',
      fingerprint: 'fixture',
      directory,
      inspect: (pid) => (pid === process.pid ? identity(pid) : null),
      recoverCleanup: () => ({ recovery: prior }),
      externalCheck: (record) => {
        assert.equal(existsSync(`${path}.gate`), true)
        assert.deepEqual(record.identity, prior.identity)
        verified = true
      },
    })
    assert.equal(verified, true)
    lock.release()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
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
test('mode mutex refuses same/cross live modes and reclaims only proven stale identity without killing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mode-lock-'))
  const inspect = (pid) => identity(pid)
  try {
    const lock = acquireLock({ mode: 'local', fingerprint: 'target', directory: dir, inspect })
    for (const mode of ['local', 'dev', 'full'])
      assert.throws(
        () => acquireLock({ mode, fingerprint: 'other', directory: dir, inspect }),
        /MODE_ACTIVE/,
      )
    const original = JSON.parse(readFileSync(lock.path, 'utf8'))
    writeFileSync(
      lock.path,
      JSON.stringify({ ...original, identity: { ...original.identity, creation: 'old' } }),
    )
    assert.throws(
      () => acquireLock({ mode: 'dev', fingerprint: 'second', directory: dir, inspect }),
      /CLEANUP_REQUIRED/,
    )
    let checked = false
    const replacement = acquireLock({
      mode: 'local',
      fingerprint: 'target',
      directory: dir,
      inspect,
      externalCheck: (prior) => {
        assert.equal(prior.identity.creation, 'old')
        checked = true
      },
    })
    assert.equal(checked, true)
    assert.equal(replacement.record.mode, 'local')
    replacement.release()
    writeFileSync(
      join(dir, 'mode-lock.json'),
      JSON.stringify({ mode: 'full', identity: { pid: 1 } }),
    )
    assert.throws(
      () => acquireLock({ mode: 'local', fingerprint: 'target', directory: dir, inspect }),
      /AMBIGUOUS/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
test('persisted full mode occupancy is independent of exited up-command PID', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mode-full-'))
  try {
    writeFileSync(
      join(dir, 'mode-lock.json'),
      JSON.stringify({ mode: 'full', persistent: true, identity: identity(987654) }),
    )
    let checked = false
    assert.throws(
      () =>
        acquireLock({
          mode: 'local',
          fingerprint: 'target',
          directory: dir,
          inspect: (pid) => (pid === process.pid ? identity(pid) : null),
          externalCheck: () => {
            checked = true
          },
        }),
      /MODE_ACTIVE/,
    )
    assert.equal(checked, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
test('cleanup intent rejects all ordinary callers after owner exit; exact recovery validates inside the gate before replacement', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cleanup-lock-')),
    path = join(directory, 'mode-lock.json')
  const prior = {
    version: 1,
    mode: 'local',
    fingerprint: 'target',
    runId: 'original-run',
    identity: identity(987654),
    state: 'cleanup-failed',
    cleanupRequired: true,
    resources: {
      started: [{ id: 'owned', service: 'hydra' }],
      preRunning: [],
      containerProofs: [{ id: 'owned', digest: 'original' }],
    },
  }
  const inspect = (pid) => (pid === process.pid ? identity(pid) : null)
  try {
    writeFileSync(path, JSON.stringify(prior))
    for (const mode of ['local', 'dev', 'full'])
      assert.throws(
        () => acquireLock({ mode, fingerprint: 'target', directory, inspect }),
        /CLEANUP_REQUIRED/,
      )
    assert.throws(
      () =>
        acquireLock({
          mode: 'full',
          fingerprint: 'target',
          directory,
          inspect,
          recoverCleanup: () => ({}),
        }),
      /PROVENANCE_CONFLICT/,
    )
    assert.throws(
      () =>
        acquireLock({
          mode: 'local',
          fingerprint: 'target',
          directory,
          inspect,
          recoverCleanup: (value) => ({ recovery: value, resources: value.resources }),
          externalCheck: (value) => {
            assert.equal(existsSync(`${path}.gate`), true)
            assert.equal(readFileSync(path, 'utf8').includes('original-run'), true)
            assert.deepEqual(value.resources, prior.resources)
            throw new Error('proof conflict')
          },
        }),
      /proof conflict/,
    )
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).cleanupRequired, true)
    const lock = acquireLock({
      mode: 'local',
      fingerprint: 'target',
      directory,
      inspect,
      recoverCleanup: (value) => ({ recovery: value, resources: value.resources }),
      externalCheck: () => {
        assert.equal(existsSync(`${path}.gate`), true)
        assert.equal(JSON.parse(readFileSync(path, 'utf8')).runId, prior.runId)
      },
    })
    assert.equal(lock.record.cleanupRequired, true)
    assert.deepEqual(lock.record.resources, prior.resources)
    lock.release()
    // Even failure of the initial intent write cannot make an outstanding
    // local resource journal eligible for an ordinary stale-lock reclaim.
    writeFileSync(path, JSON.stringify({ ...prior, state: 'ready', cleanupRequired: false }))
    assert.throws(
      () => acquireLock({ mode: 'dev', fingerprint: 'target', directory, inspect }),
      /CLEANUP_REQUIRED/,
    )
    for (const resources of [
      { started: [], preRunning: [], containerProofs: [] },
      prior.resources,
    ]) {
      writeFileSync(
        path,
        JSON.stringify({
          ...prior,
          state: 'stopped',
          stoppedAt: new Date().toISOString(),
          cleanupRequired: false,
          resources,
        }),
      )
      let checked = false
      const next = acquireLock({
        mode: 'dev',
        fingerprint: 'next',
        directory,
        inspect,
        externalCheck: (value) => {
          assert.deepEqual(value.resources, resources)
          assert.ok(value.stoppedAt)
          checked = true
        },
      })
      assert.equal(checked, true)
      next.release()
    }
    for (const owner of [identity(process.pid), { pid: 1234 }]) {
      writeFileSync(path, JSON.stringify({ ...prior, identity: owner }))
      assert.throws(
        () =>
          acquireLock({
            mode: 'local',
            fingerprint: 'target',
            directory,
            inspect,
            recoverCleanup: () => ({}),
          }),
        /MODE_ACTIVE|AMBIGUOUS/,
      )
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
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
    const descendant = await waitForDescendant(messages)
    assert.ok(descendant)
    const descendantIdentity = processIdentity(descendant)
    await stopOwned([owned])
    assert.equal(await waitUntilDead(owned.identity), true)
    assert.equal(await waitUntilDead(descendantIdentity), true)
    // 独立子进程必须仍然存活：清理只作用于被停止的那个 Job。
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
        // 后代身份必须在 root 自退之前取到：`spawnOwned` 自身先花掉数秒做一次进程身份查询，
        // 之后再查一次后代身份，两者相加会吃掉默认的 5 秒定时器。放大定时器而不是放宽断言。
        environment: { ...process.env, EXWEBSITE_FIXTURE_EXIT_MS: '20000' },
        cwd: resolve('.'),
      },
      { onLog: (_, line) => messages.push(line) },
    )
    try {
      const pid = await waitForDescendant(messages)
      assert.ok(Number.isSafeInteger(pid) && pid > 0)
      const descendant = processIdentity(pid)
      const result = await owned.exited
      assert.equal(result.code, 7)
      // 后代身份是在它还活着时取到的，因此这里断言的是"清理掉了它"，而不只是"pid 不见了"。
      assert.equal(await waitUntilDead(descendant), true)
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
            const descendantPid = await waitForDescendant(messages)
            helper = processIdentity(pid)
            descendant = processIdentity(descendantPid)
            throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
          },
        }),
        /PROCESS_IDENTITY_UNAVAILABLE/,
      )
      // 失败的 helper 被 drain：它自己、它已经带出来的后代都消失，独立子进程保留。
      assert.equal(await waitUntilDead(helper), true)
      assert.equal(await waitUntilDead(descendant), true)
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
      // 身份可能取不到（进程已被 drain），这时必须判为已清理，而不是让 identityAlive(null)
      // 抛出与本用例无关的错误码。
      assert.equal(
        identities.every((identity) => identityGone(identity)),
        true,
      )
      assert.equal(identityGone(descendant), true)
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
                  assert.notEqual(await waitForMessage(messages, 'PORT_READY'), undefined)
                  const descendantPid = await waitForDescendant(messages)
                  assert.ok(Number.isSafeInteger(descendantPid) && descendantPid > 0)
                  // descendant 存的是身份而不是 pid：identityGone 要按身份判定，传 pid 会走到
                  // identityAlive 的"身份不完整"分支，抛出与本用例无关的错误码。
                  descendant = processIdentity(descendantPid)
                  identities.push(processIdentity(pid))
                  throw new LocalError('PROCESS_IDENTITY_UNAVAILABLE')
                },
              })
            } catch (error) {
              assert.equal(existsSync(lock.path), true)
              assert.equal(identityGone(identities.at(-1)), true)
              assert.equal(identityGone(descendant), true)
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
