import { describe, expect, it } from 'vitest'
import { SUMMARY_POLLING, createSummaryScheduler } from '@web/src/notifications/summaryPolling'

/** 可控时钟：不依赖真实时间，也不需要 fake timers。 */
function clock() {
  let current = 1_800_000_000_000
  return {
    now: () => current,
    advance(ms: number) {
      current += ms
    },
  }
}

describe('summary polling scheduler', () => {
  it('polls at the base interval while nothing fails', () => {
    const scheduler = createSummaryScheduler(clock())
    expect(scheduler.nextDelay()).toBe(SUMMARY_POLLING.baseInterval)
    scheduler.recordSuccess()
    expect(scheduler.nextDelay()).toBe(SUMMARY_POLLING.baseInterval)
  })

  it('backs off exponentially while failures continue and caps at the maximum', () => {
    const scheduler = createSummaryScheduler(clock())
    const delays: number[] = []
    for (let failure = 1; failure <= 8; failure += 1) {
      scheduler.recordFailure()
      delays.push(scheduler.nextDelay())
    }
    const { baseInterval, factor, maxInterval } = SUMMARY_POLLING
    expect(delays.slice(0, 3)).toEqual([
      baseInterval * factor,
      baseInterval * factor ** 2,
      baseInterval * factor ** 3,
    ])
    // 单调不减，且不会越过上限。
    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]!).toBeGreaterThanOrEqual(delays[index - 1]!)
    }
    expect(delays.at(-1)).toBe(maxInterval)
    expect(Math.max(...delays)).toBeLessThanOrEqual(maxInterval)
  })

  it('resets the backoff as soon as one attempt succeeds', () => {
    const scheduler = createSummaryScheduler(clock())
    scheduler.recordFailure()
    scheduler.recordFailure()
    scheduler.recordFailure()
    expect(scheduler.nextDelay()).toBe(SUMMARY_POLLING.baseInterval * 2 ** 3)
    // 设计 9.3：退避只针对「正在失败」的那段时间，成功后立刻回到基准。
    scheduler.recordSuccess()
    expect(scheduler.failures).toBe(0)
    expect(scheduler.nextDelay()).toBe(SUMMARY_POLLING.baseInterval)
  })

  it('lets one focus refresh through and throttles the ones that follow', () => {
    const time = clock()
    const scheduler = createSummaryScheduler(time)
    expect(scheduler.allowRefresh()).toBe(true)
    // 密集 focus：累计推进（10 + 100 + 1000ms）仍远在 10s 窗口内，一条都不放行。
    for (const elapsed of [10, 100, 1_000]) {
      time.advance(elapsed)
      expect(scheduler.allowRefresh()).toBe(false)
    }
    expect(scheduler.allowRefresh()).toBe(false)
    // 出了窗口才再放行一次。
    time.advance(SUMMARY_POLLING.refreshThrottle)
    expect(scheduler.allowRefresh()).toBe(true)
  })

  it('allows the first refresh immediately after a reset', () => {
    const scheduler = createSummaryScheduler(clock())
    expect(scheduler.allowRefresh()).toBe(true)
    expect(scheduler.allowRefresh()).toBe(false)
    // 退出/换号：节流窗口与退避一起清掉，下次登录不该继承上一次的窗口。
    scheduler.reset()
    expect(scheduler.allowRefresh()).toBe(true)
  })

  it('keeps the throttle window independent of the backoff state', () => {
    const time = clock()
    const scheduler = createSummaryScheduler(time)
    scheduler.recordFailure()
    scheduler.recordFailure()
    expect(scheduler.allowRefresh()).toBe(true)
    time.advance(SUMMARY_POLLING.refreshThrottle)
    expect(scheduler.allowRefresh()).toBe(true)
    // 刷新放行与否不该改动退避计数。
    expect(scheduler.failures).toBe(2)
  })
})
