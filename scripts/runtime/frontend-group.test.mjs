import assert from 'node:assert/strict'
import test from 'node:test'
import { runFrontendGroup } from './frontend-group.mjs'

const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const specifications = [
  { name: 'web', readinessUrl: 'http://127.0.0.1:8090/' },
  { name: 'admin-web', readinessUrl: 'http://127.0.0.1:5173/' },
]
function fixture(extra = {}) {
  const controller = new AbortController(),
    events = [],
    children = []
  const options = {
    signal: controller.signal,
    async assertFree(port) {
      events.push(`port:${port}`)
    },
    async spawnChild(specification, options) {
      assert.equal(
        options.signal,
        undefined,
        'group owns cleanup; spawn has no independent abort callback',
      )
      const done = deferred()
      const child = {
        specification,
        child: { exitCode: null, signalCode: null },
        exited: done.promise,
        finish(code = 0) {
          this.child.exitCode = code
          done.resolve({ code })
        },
      }
      children.push(child)
      events.push(`spawn:${specification.name}`)
      return child
    },
    async ready(url, { signal }) {
      assert.equal(signal.aborted, false)
      events.push(`ready:${url}`)
    },
    async stopChildren(items) {
      events.push('stop')
      assert.deepEqual(items, children)
      items.forEach((child) => child.finish())
    },
    onReady() {
      events.push('ready')
      controller.abort()
    },
    ...extra,
  }
  return { options, controller, events, children }
}

test('all ports are checked before spawn; readiness precedes success and cleanup is awaited once', async () => {
  const stopped = deferred(),
    f = fixture({
      async stopChildren(items) {
        f.events.push('stop')
        assert.deepEqual(items, f.children)
        await stopped.promise
      },
    })
  let finished = false
  const running = runFrontendGroup(specifications, f.options).then(() => {
    finished = true
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(f.events, [
    'port:8090',
    'port:5173',
    'spawn:web',
    'spawn:admin-web',
    'ready:http://127.0.0.1:8090/',
    'ready:http://127.0.0.1:5173/',
    'ready',
    'stop',
  ])
  assert.equal(finished, false)
  f.controller.abort()
  stopped.resolve()
  await running
  assert.equal(f.events.filter((event) => event === 'stop').length, 1)
})

test('duplicate ports or an occupied port never launch a child', async () => {
  const f = fixture()
  await assert.rejects(
    runFrontendGroup(
      [specifications[0], { ...specifications[1], readinessUrl: specifications[0].readinessUrl }],
      f.options,
    ),
    (error) => error.code === 'PORT_CONFLICT',
  )
  assert.equal(f.children.length, 0)
  const occupied = fixture({
    async assertFree() {
      throw new Error('private system message')
    },
  })
  await assert.rejects(
    runFrontendGroup(specifications, occupied.options),
    (error) =>
      error.code === 'APPLICATION_PORT_OCCUPIED' &&
      error.service === 'web' &&
      error.target.includes('8090') &&
      !error.message.includes('private'),
  )
  assert.equal(occupied.children.length, 0)
})

test('partial spawn failure drains only the acquired handles', async () => {
  const f = fixture(),
    spawn = f.options.spawnChild
  f.options.spawnChild = async (...args) => {
    if (f.children.length) throw new Error('spawn failed')
    return spawn(...args)
  }
  await assert.rejects(runFrontendGroup(specifications, f.options))
  assert.equal(f.children.length, 1)
  assert.equal(f.events.at(-1), 'stop')
  assert.equal(f.events.includes('ready'), false)
})

test('child exit, including zero, interrupts pending readiness and drains the group', async () => {
  for (const code of [0, 1]) {
    let readinessSignal
    const f = fixture({
      ready(_url, { signal }) {
        readinessSignal = signal
        f.children[0].finish(code)
        return new Promise(() => {})
      },
    })
    await assert.rejects(
      runFrontendGroup(specifications, f.options),
      (error) => error.code === 'FRONTEND_EXITED',
    )
    assert.equal(readinessSignal.aborted, true)
    assert.equal(f.events.at(-1), 'stop')
    assert.equal(f.events.includes('ready'), false)
  }
})

test('readiness failure cancels outstanding checks and cleans all children', async () => {
  let readinessSignal
  const f = fixture({
    async ready(_url, { signal }) {
      readinessSignal = signal
      throw new Error('readiness failed')
    },
  })
  await assert.rejects(runFrontendGroup(specifications, f.options))
  assert.equal(readinessSignal.aborted, true)
  assert.equal(f.children.length, 2)
  assert.equal(f.events.at(-1), 'stop')
})

test('cancellation during spawn waits for its handle before cleanup and does not start the next child', async () => {
  const gate = deferred(),
    f = fixture(),
    spawn = f.options.spawnChild
  f.options.spawnChild = async (...args) => {
    f.controller.abort()
    await gate.promise
    return spawn(...args)
  }
  let finished = false
  const running = runFrontendGroup(specifications, f.options).then(() => {
    finished = true
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(finished, false)
  assert.equal(f.events.includes('stop'), false)
  gate.resolve()
  await running
  assert.equal(f.children.length, 1)
  assert.equal(f.events.at(-1), 'stop')
})

test('unexpected exit after ready fails and cleans the other frontend', async () => {
  const f = fixture({
    onReady() {
      f.children[1].finish(0)
    },
  })
  await assert.rejects(
    runFrontendGroup(specifications, f.options),
    (error) => error.code === 'FRONTEND_EXITED',
  )
  assert.equal(f.events.at(-1), 'stop')
})

test('cleanup failure stays a failure even after cancellation', async () => {
  const failure = Object.assign(new Error('cleanup failed'), {
    code: 'OWNED_PROCESS_CLEANUP_FAILED',
  })
  const f = fixture({
    async stopChildren() {
      throw failure
    },
  })
  await assert.rejects(runFrontendGroup(specifications, f.options), (error) => error === failure)
})

test('cancellation interrupts pending readiness and pre-cancelled groups launch nothing', async () => {
  let readinessSignal
  const f = fixture({
    ready(_url, { signal }) {
      readinessSignal = signal
      f.controller.abort()
      return new Promise(() => {})
    },
  })
  await runFrontendGroup(specifications, f.options)
  assert.equal(readinessSignal.aborted, true)
  assert.equal(f.events.at(-1), 'stop')
  const preCancelled = fixture()
  preCancelled.controller.abort()
  await runFrontendGroup(specifications, preCancelled.options)
  assert.deepEqual(preCancelled.events, [])
})

test('an earlier child exit during a later spawn still collects its eventual handle before failing', async () => {
  const gate = deferred(),
    f = fixture(),
    spawn = f.options.spawnChild
  f.options.spawnChild = async (...args) => {
    if (f.children.length) {
      f.children[0].finish()
      await gate.promise
    }
    return spawn(...args)
  }
  let finished = false
  const running = runFrontendGroup(specifications, f.options)
  running.then(
    () => {
      finished = true
    },
    () => {
      finished = true
    },
  )
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(finished, false)
  assert.equal(f.events.includes('stop'), false)
  gate.resolve()
  await assert.rejects(running, (error) => error.code === 'FRONTEND_EXITED')
  assert.equal(f.children.length, 2)
  assert.equal(f.events.at(-1), 'stop')
})
