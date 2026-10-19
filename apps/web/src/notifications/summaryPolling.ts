/**
 * 未读计数的轮询调度。
 *
 * 设计 9.3 要求轮询是**尽力而为**的补充，不是实时承诺，因此这里只做三件事：
 *
 * - **失败指数退避**：连续失败把间隔按倍数拉长到上限。服务端已经在报错时，
 *   固定 60 秒一次只会持续加压，而且用户每次切回页面都要等一轮才看得到恢复。
 * - **成功立即复位**：一次成功就把间隔拉回基准 —— 退避针对的是「正在失败」的
 *   那一段时间，成功后不该继续按退避节奏走。
 * - **聚焦/可见性节流**：密集 focus（反复切换窗口、连续点击）不能变成请求风暴；
 *   窗口内只放行一次，其余交给轮询。
 *
 * 时钟由调用方注入，便于用可控时钟覆盖「持续失败 / 成功恢复 / 密集聚焦」这些路径。
 */

export const SUMMARY_POLLING = {
  /** 正常情况下的轮询间隔。 */
  baseInterval: 60_000,
  /** 退避上限：再怎么失败也不超过 10 分钟一轮。 */
  maxInterval: 10 * 60_000,
  factor: 2,
  /** 聚焦/可见性刷新的最小间隔。 */
  refreshThrottle: 10_000,
}

export interface PollingClock {
  now(): number
}

export function createSummaryScheduler(clock: PollingClock = { now: () => Date.now() }) {
  let consecutiveFailures = 0
  let lastRefreshAt: number | null = null

  return {
    /** 下一次轮询的间隔：成功时是基准，失败后指数拉长到上限为止。 */
    nextDelay(): number {
      if (consecutiveFailures === 0) return SUMMARY_POLLING.baseInterval
      const delay = SUMMARY_POLLING.baseInterval * SUMMARY_POLLING.factor ** consecutiveFailures
      return Math.min(delay, SUMMARY_POLLING.maxInterval)
    },
    recordSuccess(): void {
      consecutiveFailures = 0
    },
    recordFailure(): void {
      consecutiveFailures += 1
    },
    /** 连续失败次数：测试与诊断用。 */
    get failures(): number {
      return consecutiveFailures
    },
    /**
     * 聚焦/可见性刷新是否放行（放行即记下时刻）。
     *
     * 返回 false 表示仍在节流窗口内 —— 此时不是「什么都不做」：轮询还在跑，
     * 用户最多等一轮就能看到最新值。
     */
    allowRefresh(): boolean {
      const now = clock.now()
      if (lastRefreshAt !== null && now - lastRefreshAt < SUMMARY_POLLING.refreshThrottle)
        return false
      lastRefreshAt = now
      return true
    },
    /** 退出/换号：清掉退避与节流窗口，下次登录从基准间隔重新开始。 */
    reset(): void {
      consecutiveFailures = 0
      lastRefreshAt = null
    },
  }
}

export type SummaryScheduler = ReturnType<typeof createSummaryScheduler>
