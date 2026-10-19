export class JoinRateLimiter {
  private readonly entries = new Map<string, { startedAt: number; count: number }>()
  constructor(private readonly now: () => number = Date.now) {}
  check(ip: string): number | undefined {
    const now = this.now()
    for (const [key, entry] of this.entries)
      if (now >= entry.startedAt + 60_000) this.entries.delete(key)
    const previous = this.entries.get(ip)
    const entry = previous ?? { startedAt: now, count: 0 }
    this.entries.delete(ip)
    if (!previous && this.entries.size >= 1024)
      this.entries.delete(this.entries.keys().next().value!)
    this.entries.set(ip, entry)
    entry.count += 1
    return entry.count > 60
      ? Math.max(1, Math.ceil((entry.startedAt + 60_000 - now) / 1000))
      : undefined
  }
}
