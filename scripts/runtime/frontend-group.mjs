import { assertPortFree, httpReady } from './local-dev.mjs'
import { spawnOwned, stopOwned } from './ownership.mjs'
import { RuntimeError } from './output.mjs'

/** Ephemeral frontend children share one lifetime and one cleanup authority. */
export async function runFrontendGroup(
  specifications,
  {
    signal,
    onLog = () => {},
    onReady = () => {},
    spawnChild = spawnOwned,
    stopChildren = stopOwned,
    assertFree = assertPortFree,
    ready = httpReady,
  } = {},
) {
  const children = [],
    lifetime = new AbortController()
  let failure,
    stopping = false,
    interrupted
  const fail = (error) => {
    failure ??= error
    lifetime.abort(failure)
  }
  const cancel = () => lifetime.abort(signal.reason)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  // This rejection always has a race consumer, even while an in-flight spawn drains.
  const cancelled = new Promise((_, reject) => {
    interrupted = () => reject(lifetime.signal.reason)
    lifetime.signal.addEventListener('abort', interrupted, { once: true })
    if (lifetime.signal.aborted) interrupted()
  })
  cancelled.catch(() => {})
  const check = () => {
    if (failure) throw failure
    lifetime.signal.throwIfAborted()
  }
  try {
    check()
    const ports = specifications.map((spec) => Number(new URL(spec.readinessUrl).port))
    if (new Set(ports).size !== ports.length)
      throw new RuntimeError('PORT_CONFLICT', {
        service: 'Website / admin-web',
        keys: ['--port', '--admin-port', 'LOCAL_ADMIN_WEB_PORT'],
        target: ports.join(', '),
      })
    for (const [index, port] of ports.entries()) {
      check()
      try {
        await assertFree(port)
      } catch {
        throw new RuntimeError('APPLICATION_PORT_OCCUPIED', {
          service: specifications[index].name,
          target: `127.0.0.1:${port}`,
          reason: '前端监听端口被占用',
          next: '在端口所属终端停止原进程，或为此前端设置其他端口',
        })
      }
    }
    for (const spec of specifications) {
      check()
      // Do not race spawn with abort: its eventual handle must enter this registry.
      const child = await spawnChild(spec, { onLog })
      children.push(child)
      child.exited.then(
        () => {
          if (!stopping && !signal?.aborted)
            fail(
              new RuntimeError('FRONTEND_EXITED', {
                service: spec.name,
                target: spec.readinessUrl,
                reason: '前端进程意外退出',
                next: '检查此前端的启动日志和依赖后重新启动整组前端',
              }),
            )
        },
        () => fail(new RuntimeError('FRONTEND_EXITED', { service: spec.name })),
      )
      check()
    }
    for (const spec of specifications) {
      check()
      await Promise.race([
        ready(spec.readinessUrl, { children, signal: lifetime.signal }),
        cancelled,
      ])
    }
    check()
    onReady()
    await cancelled
  } catch (error) {
    if (failure || !signal?.aborted) throw failure ?? error
  } finally {
    stopping = true
    lifetime.abort()
    try {
      if (children.length) await stopChildren(children)
    } finally {
      signal?.removeEventListener('abort', cancel)
      lifetime.signal.removeEventListener('abort', interrupted)
    }
  }
}
