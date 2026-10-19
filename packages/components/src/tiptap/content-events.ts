/** Observer failures belong to the host's global error channel, never content issues. */
export function invokeContentObserver(callback: () => void): void {
  try {
    callback()
  } catch (error) {
    if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
    else
      queueMicrotask(() => {
        throw error
      })
  }
}

/** Enqueue a whole operation before delivery so reentrant operations cannot interleave it. */
export class ContentNotifications {
  private pending: { callbacks?: (() => void)[] }[] = []
  private delivering = false

  send(callbacks: (() => void)[]): void {
    this.reserve()(callbacks)
  }

  /** Reserve ordering before dispatch, which can synchronously invoke native Editor listeners. */
  reserve(): (callbacks: (() => void)[]) => void {
    const batch: { callbacks?: (() => void)[] } = {}
    this.pending.push(batch)
    return (callbacks) => {
      batch.callbacks = callbacks
      this.deliver()
    }
  }

  private deliver(): void {
    if (this.delivering) return
    this.delivering = true
    try {
      while (this.pending[0]?.callbacks) {
        const batch = this.pending.shift()!
        for (const callback of batch.callbacks!) invokeContentObserver(callback)
      }
    } finally {
      this.delivering = false
    }
  }
}
