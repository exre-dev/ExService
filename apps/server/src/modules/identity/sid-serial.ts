// The development topology has one Website server. Keep Hydra's protocol
// logout acceptance and outbox sid deletion ordered within that process.
const tails = new Map<string, Promise<void>>()

export async function withSidSerial<T>(sid: string, action: () => Promise<T>): Promise<T> {
  const previous = tails.get(sid) ?? Promise.resolve()
  const result = previous.then(action, action)
  const tail = result.then(
    () => undefined,
    () => undefined,
  )
  tails.set(sid, tail)
  try {
    return await result
  } finally {
    if (tails.get(sid) === tail) tails.delete(sid)
  }
}
