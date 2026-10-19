import type { FastifyInstance, FastifyListenOptions } from 'fastify'

export const APPLICATION_CLEANUP_FAILED = '[server] 启动或关闭时资源清理失败。'
interface ApplicationStartOptions {
  createApp: () => FastifyInstance
  database: { close(): Promise<void> }
  listen: FastifyListenOptions
  startProjection: () => () => void
  startOutbox?: () => () => void
  /** Refuse new support advances and await current claims before database close. */
  drainSupport?: () => Promise<void>
  /** Boot fencing after readiness and before listening. */
  recoverSupport?: () => Promise<void>
  reportCleanupFailure?: (message: string) => void
}

/** Ownership transfers on invocation, including when createApp throws synchronously. */
export async function startApplication(options: ApplicationStartOptions): Promise<FastifyInstance> {
  let app: FastifyInstance | undefined
  const stops: (() => void)[] = []
  let cleanupPromise: Promise<void> | undefined
  const report = () => {
    // Logging callbacks cannot replace the startup error or interrupt cleanup.
    try {
      options.reportCleanupFailure?.(APPLICATION_CLEANUP_FAILED)
    } catch {
      /* fixed diagnostic only */
    }
  }
  const cleanup = () => {
    // Schedule after assignment, so a reentrant stop sees the same promise.
    cleanupPromise ??= Promise.resolve().then(async () => {
      for (const stop of stops.reverse()) {
        try {
          stop()
        } catch {
          report()
        }
      }
      try {
        await options.drainSupport?.()
      } catch {
        report()
      }
      try {
        await options.database.close()
      } catch {
        report()
      }
    })
    return cleanupPromise
  }
  try {
    app = options.createApp()
    app.addHook('onClose', cleanup)
    await app.ready()
    await options.recoverSupport?.()
    await app.listen(options.listen)
    stops.push(options.startProjection())
    if (options.startOutbox) stops.push(options.startOutbox())
    return app
  } catch (error) {
    try {
      await app?.close()
    } catch {
      report()
    } finally {
      await cleanup()
    }
    throw error
  }
}
