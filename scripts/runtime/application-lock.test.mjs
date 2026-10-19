import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { atomicJson, digest, readJson } from './local-config.mjs'
import { acquireApplicationLock } from './application-lock.mjs'

const identity = (pid) => ({
  pid,
  creation: 'original',
  executable: 'node',
  commandDigest: 'original-command',
})
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-app-recovery-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const state = { directory, fingerprint: 'original-target' }
  const run = {
    version: 1,
    mode: 'local',
    fingerprint: state.fingerprint,
    runId: randomUUID(),
    identity: identity(90001),
    state: 'stopping',
    cleanupRequired: true,
    children: ['server', 'web', 'outline'].map((name, index) => ({
      name,
      identity: identity(90002 + index),
    })),
    resources: { started: [], preRunning: [], createdStopped: [], containerProofs: [] },
  }
  const save = () => {
    atomicJson(join(directory, 'applications-lock.json'), run)
    atomicJson(join(directory, 'run.json'), run)
  }
  save()
  const inspect = (pid) => (pid === process.pid ? identity(pid) : null)
  return { state, run, save, inspect, directory }
}

test('interrupted Windows application generation is recovered only after all exact owners are gone', (t) => {
  const f = fixture(t)
  const lock = acquireApplicationLock(f.state, {
    inspect: f.inspect,
    inspectChildren: () => [],
    platform: 'win32',
  })
  const archived = readJson(join(f.directory, 'recovered-applications', `${f.run.runId}.json`))
  assert.deepEqual(archived.lock, f.run)
  assert.deepEqual(archived.run, f.run)
  const completed = readJson(join(f.directory, 'run.json'))
  assert.equal(completed.state, 'stopped')
  assert.equal(completed.cleanupRequired, false)
  assert.deepEqual(completed.children, [])
  assert.notEqual(lock.record.runId, f.run.runId)
  assert.equal(lock.record.cleanupRequired, false)
  lock.release()
  assert.equal(existsSync(join(f.directory, 'applications-lock.json')), false)
})

test('interrupted preparation and rebuild states retain the same exact-child recovery requirements', (t) => {
  for (const state of ['preparing', 'rebuilding', 'rebuild-failed']) {
    const f = fixture(t)
    f.run.state = state
    f.run.children = [{ name: 'SDK build', identity: identity(90002) }]
    f.save()
    assert.throws(
      () =>
        acquireApplicationLock(f.state, {
          inspect: (pid) => (pid === 90002 ? identity(pid) : f.inspect(pid)),
          inspectChildren: () => [],
          platform: 'win32',
        }),
      /MODE_CHILDREN_STILL_ACTIVE/,
    )
    const lock = acquireApplicationLock(f.state, {
      inspect: f.inspect,
      inspectChildren: () => [],
      platform: 'win32',
    })
    assert.deepEqual(
      readJson(join(f.directory, 'recovered-applications', `${f.run.runId}.json`)).run,
      f.run,
    )
    lock.release()
  }
})

test('recovered preflight remains reclaimable if its new owner exits before launching applications', (t) => {
  const f = fixture(t)
  const first = acquireApplicationLock(f.state, {
    inspect: f.inspect,
    inspectChildren: () => [],
    platform: 'win32',
  })
  const replacement = (pid) =>
    pid === process.pid ? { ...identity(pid), creation: 'next-owner' } : null
  const second = acquireApplicationLock(f.state, {
    inspect: replacement,
    inspectChildren: () => [],
    platform: 'win32',
  })
  assert.notEqual(first.record.runId, second.record.runId)
  second.release()
})

test('archive and completed-run write failures preserve a retryable generation without losing original proof', (t) => {
  for (const failure of ['archive', 'completed-run']) {
    const f = fixture(t)
    assert.throws(
      () =>
        acquireApplicationLock(f.state, {
          inspect: f.inspect,
          platform: 'win32',
          inspectChildren: () => [],
          persist: (path, value) => {
            if (
              (failure === 'archive' && path.includes('recovered-applications')) ||
              (failure === 'completed-run' && path === join(f.directory, 'run.json'))
            )
              throw new Error('fixture write failed')
            atomicJson(path, value)
          },
        }),
      /fixture write failed/,
    )
    assert.equal(readJson(join(f.directory, 'run.json')).runId, f.run.runId)
    const nextOwner = (pid) =>
      pid === process.pid ? { ...identity(pid), creation: 'next-owner' } : null
    const retried = acquireApplicationLock(f.state, {
      inspect: nextOwner,
      platform: 'win32',
      inspectChildren: () => [],
    })
    assert.equal(retried.record.cleanupRequired ?? false, false)
    const archived = readJson(join(f.directory, 'recovered-applications', `${f.run.runId}.json`))
    assert.deepEqual(archived.run, f.run)
    retried.release()
  }
})

test('interruption after stopped persistence and concurrent lock release both leave reclaimable ownership', (t) => {
  const stopped = fixture(t)
  Object.assign(stopped.run, { state: 'stopped', children: [] })
  stopped.save()
  const first = acquireApplicationLock(stopped.state, {
    inspect: stopped.inspect,
    inspectChildren: () => [],
    platform: 'win32',
  })
  assert.equal(first.record.cleanupRequired, false)
  first.release()
  const released = fixture(t)
  const inspect = (pid) => {
    if (pid === process.pid)
      rmSync(join(released.directory, 'applications-lock.json'), { force: true })
    return released.inspect(pid)
  }
  const second = acquireApplicationLock(released.state, {
    inspect,
    inspectChildren: () => [],
    platform: 'win32',
  })
  assert.equal(second.record.cleanupRequired, false)
  second.release()
})

test('recovery refuses live owners, children, changed run proofs and dependency resources without replacing records', (t) => {
  for (const scenario of [
    'owner',
    'child',
    'unrecorded-child',
    'unrecorded-preflight-child',
    'run',
    'resources',
    'platform',
  ]) {
    const f = fixture(t)
    if (scenario === 'resources') {
      f.run.resources.started.push({ id: 'dependency' })
      f.save()
    }
    if (scenario === 'unrecorded-preflight-child') {
      Object.assign(f.run, { cleanupRequired: false, state: 'starting', children: [] })
      f.save()
    }
    if (scenario === 'run') atomicJson(join(f.directory, 'run.json'), { ...f.run, children: [] })
    const before = ['applications-lock.json', 'run.json'].map((name) =>
      digest(readFileSync(join(f.directory, name), 'utf8')),
    )
    const inspect = (pid) =>
      pid === process.pid ||
      (scenario === 'owner' && pid === 90001) ||
      (scenario === 'child' && pid === 90002)
        ? identity(pid)
        : null
    assert.throws(() =>
      acquireApplicationLock(f.state, {
        inspect,
        platform: scenario === 'platform' ? 'linux' : 'win32',
        inspectChildren: () => (scenario.startsWith('unrecorded-') ? [90009] : []),
      }),
    )
    assert.deepEqual(
      ['applications-lock.json', 'run.json'].map((name) =>
        digest(readFileSync(join(f.directory, name), 'utf8')),
      ),
      before,
    )
    assert.equal(existsSync(join(f.directory, 'recovered-applications')), false)
  }
})
