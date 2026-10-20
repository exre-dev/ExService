import { createServer } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { RuntimeError } from './output.mjs'
import { atomicJson, LocalError, readJson } from './local-config.mjs'
import { spawnOwned, stopOwned } from './ownership.mjs'

export async function assertPortFree(port) {
  const server = createServer()
  try {
    await new Promise((resolve, reject) => {
      server.once('error', () =>
        reject(
          new LocalError('APPLICATION_PORT_OCCUPIED', 'stop the port owner in its own terminal'),
        ),
      )
      server.listen(port, '127.0.0.1', resolve)
    })
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve))
  }
}
function explicitHostResponse(url, headers, signal) {
  const target = new URL(url)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
    return Promise.reject(new Error('Invalid readiness URL'))
  return new Promise((resolve, reject) => {
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(
      target,
      {
        headers: Object.fromEntries(new Headers(headers)),
        signal,
      },
      (incoming) => {
        incoming.once('error', reject)
        try {
          const responseHeaders = new Headers()
          for (const [name, values] of Object.entries(incoming.headers))
            for (const value of Array.isArray(values) ? values : [values]) {
              if (value !== undefined) responseHeaders.append(name, value)
            }
          const noBody = [204, 205, 304].includes(incoming.statusCode)
          const response = new Response(noBody ? null : Readable.toWeb(incoming), {
            status: incoming.statusCode,
            statusText: incoming.statusMessage,
            headers: responseHeaders,
          })
          Object.defineProperty(response, 'url', { value: target.href })
          if (noBody) incoming.resume()
          resolve(response)
        } catch (error) {
          incoming.destroy()
          reject(error)
        }
      },
    )
    request.once('error', reject)
    request.end()
  })
}
export async function httpReady(
  url,
  { children = [], expected, timeout = 120000, headers, signal } = {},
) {
  const deadline = Date.now() + timeout
  const childExited = () =>
    children.some((owned) => owned.child.exitCode !== null || owned.child.signalCode !== null)
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    if (childExited()) throw new LocalError('APP_EXITED_DURING_START')
    const attemptDeadline = Math.min(deadline, Date.now() + 1000),
      controller = new AbortController()
    const requestDeadline = setTimeout(
      () => controller.abort(),
      Math.max(0, attemptDeadline - Date.now()),
    )
    const childPoll = setInterval(() => {
      if (childExited()) controller.abort()
    }, 50)
    const interrupted = () => controller.abort(signal.reason)
    signal?.addEventListener('abort', interrupted, { once: true })
    if (signal?.aborted) interrupted()
    let response
    try {
      const aborted = new Promise((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
          once: true,
        }),
      )
      const ready = await Promise.race([
        aborted,
        (async () => {
          response = new Headers(headers).has('host')
            ? await explicitHostResponse(url, headers, controller.signal)
            : await fetch(url, { headers, redirect: 'manual', signal: controller.signal })
          return response.ok && (!expected || (await expected(response)))
        })(),
      ])
      signal?.throwIfAborted()
      if (childExited()) throw new LocalError('APP_EXITED_DURING_START')
      if (ready && Date.now() < attemptDeadline) return
    } catch {
      signal?.throwIfAborted()
      if (childExited()) throw new LocalError('APP_EXITED_DURING_START')
    } finally {
      clearTimeout(requestDeadline)
      clearInterval(childPoll)
      controller.abort()
      signal?.removeEventListener('abort', interrupted)
      response?.body?.cancel().catch(() => {})
    }
    await delay(Math.min(250, Math.max(0, deadline - Date.now())), undefined, { signal })
  }
  if (childExited()) throw new LocalError('APP_EXITED_DURING_START')
  const target = new URL(url)
  throw new RuntimeError('APPLICATION_NOT_READY', {
    service: '应用',
    phase: 'HTTP 健康检查',
    target: `${target.origin}${target.pathname}`,
  })
}
/** Owns application children and retains ownership until cleanup completes. */
export async function supervise({
  mode,
  fingerprint,
  directory,
  specifications: specs,
  lock,
  readiness,
  onLog = (name, line) => console.log(`[${name}] ${line}`),
  banner,
  onReady = () => console.log(banner),
  prepareGeneration = async () => {},
  preflight = async () => {},
  watchSources,
  signal,
  spawnChild = spawnOwned,
  stopChildren = stopOwned,
  pollInterval = 250,
  controlDirectory = directory,
}) {
  let children = [],
    preparers = [],
    stopping = false,
    generation = 0,
    state = 'preparing',
    failure,
    cleanupFailure
  let pending = true,
    initialized = false,
    wake,
    watcher,
    readinessController,
    preparationFailure = false
  const lifetime = new AbortController()
  const runPath = join(directory, 'run.json'),
    requestPath = join(controlDirectory, 'control-request.json')
  const persist = () => {
    const value = {
      version: 1,
      mode,
      runId: lock.record.runId,
      fingerprint,
      identity: lock.record.identity,
      state,
      generation,
      cleanupRequired: state !== 'stopped',
      children: [...children, ...preparers].map((child) => ({
        name: child.specification.name,
        identity: child.identity,
      })),
    }
    atomicJson(runPath, value)
    lock.update(value)
  }
  const stopSignal = () => {
    stopping = true
    lifetime.abort(new LocalError('RUN_INTERRUPTED'))
    wake?.()
  }
  const fail = (error) => {
    failure = error
    lifetime.abort(error)
    readinessController?.abort(error)
    wake?.()
  }
  const sourceChanged = () => {
    pending = true
    if (state === 'starting' || state === 'ready') {
      generation++
      readinessController?.abort(new LocalError('GENERATION_SUPERSEDED'))
    }
    wake?.()
  }
  const check = () => {
    if (failure) throw failure
    lifetime.signal.throwIfAborted()
  }
  const interruptible = async (operation, operationSignal) => {
    operationSignal.throwIfAborted()
    let abort
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => {
          abort = () => reject(operationSignal.reason)
          operationSignal.addEventListener('abort', abort, { once: true })
          if (operationSignal.aborted) abort()
        }),
      ])
    } finally {
      operationSignal.removeEventListener('abort', abort)
    }
  }
  // Preparation children use the same persisted capability registry as applications.
  // Even a zero exit must drain its private process group/job before proof removal.
  const execute = async (specification, options = {}) => {
    check()
    const child = await spawnChild(specification, { onLog: options.onLog ?? onLog })
    preparers.push(child)
    persist()
    const childSignal = options.signal
      ? AbortSignal.any([lifetime.signal, options.signal])
      : lifetime.signal
    try {
      const result = await interruptible(() => child.exited, childSignal)
      onLog(specification.name, `CHILD_EXIT code=${result.code ?? 'signal'}`)
      if (result.code !== 0)
        throw new LocalError(options.code ?? 'PREPARATION_CHILD_FAILED', options.next)
      return result
    } finally {
      try {
        await stopChildren([child])
      } catch (error) {
        cleanupFailure = error
        throw error
      }
      preparers = preparers.filter((item) => item !== child)
      persist()
    }
  }
  process.on('SIGINT', stopSignal)
  process.on('SIGTERM', stopSignal)
  signal?.addEventListener('abort', stopSignal, { once: true })
  if (signal?.aborted) stopSignal()
  const control = setInterval(() => {
    try {
      if (existsSync(requestPath)) {
        const request = readJson(requestPath, 'CONTROL_REQUEST_INVALID')
        if (request.runId === lock.record.runId && request.action === 'stop') stopSignal()
      }
    } catch (error) {
      fail(error)
      lifetime.abort(error)
    }
  }, pollInterval)
  const launch = async () => {
    check()
    const current = generation
    readinessController = new AbortController()
    const readySignal = AbortSignal.any([lifetime.signal, readinessController.signal])
    state = 'starting'
    persist()
    for (const spec of specs) {
      check()
      readySignal.throwIfAborted()
      const child = await spawnChild(spec, { onLog })
      children.push(child)
      child.exited.then((result) => {
        if (current === generation && !stopping)
          fail(new LocalError(`APP_${spec.name.toUpperCase()}_EXITED_${result.code ?? 'SIGNAL'}`))
      })
      persist()
    }
    await interruptible(
      () => readiness(children, { signal: readySignal, generation: current }),
      readySignal,
    )
    check()
    if (pending || current !== generation) return
    state = 'ready'
    persist()
    initialized = true
    onReady()
  }
  try {
    persist()
    watcher = watchSources?.(sourceChanged, fail)
    while (!stopping) {
      check()
      if (pending) {
        generation++
        readinessController?.abort(new LocalError('GENERATION_SUPERSEDED'))
        state = initialized ? 'rebuilding' : 'preparing'
        persist()
        if (children.length) await stopChildren(children)
        children = []
        persist()
        try {
          do {
            pending = false
            preparationFailure = true
            await prepareGeneration({ execute, signal: lifetime.signal, generation })
            preparationFailure = false
            check()
            if (!initialized) await preflight({ signal: lifetime.signal, execute })
          } while (pending && !stopping)
          check()
          await launch()
        } catch (error) {
          if (stopping) break
          if (failure || cleanupFailure) throw cleanupFailure ?? failure
          if (pending && error.code === 'GENERATION_SUPERSEDED') continue
          if (!initialized || !preparationFailure) throw error
          state = 'rebuild-failed'
          persist()
          onLog('SDK', 'SDK_PREPARATION_FAILED; 修正源文件后重试')
        }
      } else
        await new Promise((resolve) => {
          wake = () => {
            wake = undefined
            resolve()
          }
          if (pending || stopping || failure) wake()
        })
    }
    if (failure) throw failure
  } catch (error) {
    if (!stopping || failure || cleanupFailure) throw cleanupFailure ?? failure ?? error
  } finally {
    generation++
    stopping = true
    lifetime.abort(new LocalError('RUN_INTERRUPTED'))
    state = 'stopping'
    let watcherFailure
    try {
      watcher?.close()
    } catch (error) {
      watcherFailure = error
    }
    try {
      let persistenceFailure
      try {
        persist()
      } catch (error) {
        persistenceFailure = error
      }
      await stopChildren([...children, ...preparers])
      if (cleanupFailure || watcherFailure || persistenceFailure)
        throw cleanupFailure ?? watcherFailure ?? persistenceFailure
      children = []
      preparers = []
      state = 'stopped'
      persist()
      lock.release()
    } catch (error) {
      state = 'cleanup-failed'
      try {
        persist()
      } catch {
        try {
          lock.update({ state, cleanupRequired: true })
        } catch {}
      }
      throw error
    } finally {
      clearInterval(control)
      process.off('SIGINT', stopSignal)
      process.off('SIGTERM', stopSignal)
      signal?.removeEventListener('abort', stopSignal)
    }
  }
}
