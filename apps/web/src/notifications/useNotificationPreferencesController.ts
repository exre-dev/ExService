import { useCallback, useEffect, useRef, useState } from 'react'
import { proxy, useSnapshot } from 'valtio'
import { instance, ExAxiosError } from '@workspace/sdk'
import { useAuth } from '@web/src/auth/AuthContext'
import { readToken, subscribeSessionChanges } from '@web/src/auth/storage'
import {
  bindNotificationsToken,
  notificationsConfig,
} from '@web/src/notifications/notificationsConfig'
import type {
  NotificationPreferencesDraft,
  PreferenceCanonicalValues,
  PreferenceField,
  SettingsNotificationsSlice,
} from '@workspace/components'

interface SaveRun {
  epoch: number
  owner: number
}

/**
 * 每个设置宿主的局部登记。
 *
 * 失败意图只属于发起它的宿主：跨切分类保留，关闭并卸载后随登记一起清除，不转交另一
 * 宿主。`generation` 是 attach 存活代次，detach 把条目移出登记表，旧代次的命令与重试
 * callback 因此失效。登记项不落 localStorage，不进 AuthContext，也不是第二份规范快照。
 */
interface HostSlot {
  generation: number
  epoch: number
  /** 分类投影：只作发送前资格判断，不触发登记/清理。 */
  active: boolean
  failure: { id: number; field: PreferenceField; value: boolean } | null
}

const hostSlots = proxy<{ entries: HostSlot[] }>({ entries: [] })
let attachment = 0

// Settings page and header Modal can mount separate owners of the same proxy.
// Preferences have their own revision: receipt writes must not invalidate them.
const runtime = {
  epoch: -1,
  readId: 0,
  readOwner: null as symbol | null,
  writeVersion: 0,
  save: null as SaveRun | null,
  /** 409 之后必须先由 module 拥有的读取恢复规范值，才允许再次写入。 */
  needsCanonicalRead: false,
  reconciliation: null as Promise<void> | null,
  failureId: 0,
}

/** 取回仍登记的活 slot：detach 过的代次查不到，旧命令因此失效。 */
function liveSlot(generation: number): HostSlot | null {
  return hostSlots.entries.find((slot) => slot.generation === generation) ?? null
}

/**
 * 全部偏好私有身份状态的唯一同步边界。
 *
 * 它与 `bindNotificationsToken` 配套调用：先由 session change 回调绑定新 token，紧接着
 * 同步 runtime。身份变化时保留仍挂载的 slot（它们的数据已被 `bindNotificationsToken`
 * 清空）并把局部失败意图与 epoch 一并作废。
 */
function syncRuntime() {
  if (runtime.epoch === notificationsConfig.epoch) return
  runtime.epoch = notificationsConfig.epoch
  runtime.readId += 1
  runtime.readOwner = null
  runtime.writeVersion += 1
  runtime.save = null
  runtime.needsCanonicalRead = false
  runtime.reconciliation = null
  for (const slot of hostSlots.entries) {
    slot.epoch = runtime.epoch
    slot.failure = null
  }
}

function canonicalValues(): PreferenceCanonicalValues {
  const snapshot = notificationsConfig.preferences.snapshot
  return snapshot === null ? null : { ...snapshot.optionalCategories }
}

function discardOwnedReads() {
  runtime.readId += 1
  runtime.readOwner = null
  if (notificationsConfig.preferences.status !== 'loading') return
  // 冲突后仍需要规范读取时不能用旧缓存恢复 ready：那会重新放开写入资格。
  const usable = !runtime.needsCanonicalRead && notificationsConfig.preferences.snapshot !== null
  notificationsConfig.preferences.status = usable ? 'ready' : 'error'
  notificationsConfig.preferences.error = usable ? null : '通知设置暂时无法读取'
}

const defaults: NotificationPreferencesDraft = { announcement: true, personal_update: true }

/**
 * 偏好即时保存。
 *
 * 字段意图、规范快照/revision、失败重试、409 恢复与跨宿主共享单写锁都在这里；Form 只
 * 校验与呈现。设置页面与 Header 设置 Modal 各持一个宿主 slot，共享同一份规范快照。
 */
export function useNotificationPreferencesController({ active }: { active: boolean }) {
  const auth = useAuth()
  const snapshot = useSnapshot(notificationsConfig)
  const slots = useSnapshot(hostSlots)
  const authenticated = auth.state.status === 'authenticated'
  const mounted = useRef(true)
  const owner = useRef(Symbol('notification-preferences'))
  const activeRef = useRef(active)
  activeRef.current = active
  // 渲染期读取：命令闭包捕获的是本次渲染的代次，重挂载后的旧代次命令因此失效。
  // 用 state 而不是 ref，是为了保证登记之后一定有一次重渲染，发出带有效代次的 binding。
  const [generation, setGeneration] = useState(0)
  const slot = slots.entries.find((entry) => entry.generation === generation) ?? null

  useEffect(() => {
    const sync = () => {
      bindNotificationsToken(currentToken())
      syncRuntime()
    }
    sync()
    return subscribeSessionChanges(sync)
  }, [])
  useEffect(() => {
    mounted.current = true
    syncRuntime()
    const entry: HostSlot = {
      generation: ++attachment,
      epoch: runtime.epoch,
      active: activeRef.current,
      failure: null,
    }
    setGeneration(entry.generation)
    hostSlots.entries.push(entry)
    return () => {
      mounted.current = false
      const index = hostSlots.entries.findIndex((value) => value.generation === entry.generation)
      if (index >= 0) hostSlots.entries.splice(index, 1)
      // An already-sent PUT belongs to the shared identity until it settles.
      // Exiting its Form cannot cancel the server write or release its HTTP lock.
      if (runtime.readOwner === owner.current && runtime.epoch === notificationsConfig.epoch) {
        discardOwnedReads()
      }
    }
  }, [])
  useEffect(() => {
    const entry = liveSlot(generation)
    if (entry !== null) entry.active = active
  }, [generation, active])

  const sessionInvalid = useCallback(
    (error: unknown) => {
      if (!(error instanceof ExAxiosError) || error.status !== 401) return false
      const token = currentToken()
      if (token !== null) auth.invalidateSession(token)
      bindNotificationsToken(null)
      syncRuntime()
      return true
    },
    [auth.invalidateSession],
  )

  /**
   * 冲突后的规范读取由 module 拥有：发起宿主的卸载不能撤销它，也不能用旧缓存绕过恢复。
   * 同一阶段其他 `load` 加入这个读取，不抢走它的归属。
   */
  const reconcile = useCallback(async (): Promise<void> => {
    const epoch = runtime.epoch,
      requestId = ++runtime.readId,
      version = runtime.writeVersion
    const accepted = () =>
      notificationsConfig.epoch === epoch &&
      runtime.readId === requestId &&
      runtime.writeVersion === version
    notificationsConfig.preferences.status = 'loading'
    notificationsConfig.preferences.error = null
    const handle: { current: Promise<void> | null } = { current: null }
    const task = (async () => {
      try {
        const { data: result } = await instance({
          url: '/api/notification-preferences',
          method: 'GET',
          alert: false,
        })
        if (!accepted()) return
        runtime.needsCanonicalRead = false
        notificationsConfig.preferences.snapshot = result
        notificationsConfig.preferences.status = 'ready'
      } catch (error) {
        if (!accepted() || sessionInvalid(error)) return
        notificationsConfig.preferences.status = 'error'
        notificationsConfig.preferences.error = '通知设置暂时无法读取'
      } finally {
        if (runtime.reconciliation === handle.current) runtime.reconciliation = null
      }
    })()
    handle.current = task
    runtime.reconciliation = task
    await task
  }, [sessionInvalid])

  const load = useCallback(
    async (sharedSettlement = false): Promise<void> => {
      if (!authenticated || currentToken() === null || (!mounted.current && !sharedSettlement))
        return
      syncRuntime()
      if (runtime.reconciliation !== null) {
        await runtime.reconciliation
        return
      }
      const epoch = runtime.epoch,
        requestId = ++runtime.readId,
        version = runtime.writeVersion
      runtime.readOwner = sharedSettlement ? null : owner.current
      const accepted = () =>
        (mounted.current || sharedSettlement) &&
        notificationsConfig.epoch === epoch &&
        runtime.readId === requestId &&
        runtime.writeVersion === version
      notificationsConfig.preferences.status = 'loading'
      notificationsConfig.preferences.error = null
      try {
        const { data: result } = await instance({
          url: '/api/notification-preferences',
          method: 'GET',
          alert: false,
        })
        if (!accepted()) return
        // 一次已接受的读取本身就是规范值：它满足冲突后的必要重读，旧缓存不再被当成可写状态。
        runtime.needsCanonicalRead = false
        notificationsConfig.preferences.snapshot = result
        notificationsConfig.preferences.status = 'ready'
      } catch (error) {
        if (!accepted() || sessionInvalid(error)) return
        notificationsConfig.preferences.status = 'error'
        notificationsConfig.preferences.error = '通知设置暂时无法读取'
      } finally {
        if (runtime.epoch === epoch && runtime.readId === requestId) runtime.readOwner = null
      }
    },
    [authenticated, sessionInvalid],
  )

  /**
   * 发送一次明确的字段意图。
   *
   * `validated[field]` 是本次唯一意图值；另一字段与 revision 在取得锁的同一同步段内从
   * 最新规范快照读取，因此「取得锁时的最新快照」总是胜出，旧的另一字段值不会写入。
   * 预期 HTTP 失败转为共享状态或局部 failure，不抛给 Form 分类。
   */
  const commitField = useCallback(
    async (
      slotGeneration: number,
      field: PreferenceField,
      value: boolean,
    ): Promise<PreferenceCanonicalValues> => {
      syncRuntime()
      const entry = liveSlot(slotGeneration)
      if (entry === null || entry.epoch !== runtime.epoch) return null
      const snapshotValue = notificationsConfig.preferences.snapshot
      // 没有可用规范值（未读取、读取失败、冲突后仍需要重读、宿主 inactive 或未认证）时返回
      // null：Form 不做复位，也不把旧缓存当成可写状态。
      if (
        !authenticated ||
        currentToken() === null ||
        !entry.active ||
        notificationsConfig.preferences.status !== 'ready' ||
        snapshotValue === null ||
        runtime.needsCanonicalRead
      )
        return null
      // 同步竞争只拒绝本次发送：不排队、不建失败意图，把当前规范值交回 Form 复位。
      if (runtime.save !== null) return canonicalValues()
      const run: SaveRun = { epoch: runtime.epoch, owner: slotGeneration }
      runtime.save = run
      runtime.writeVersion += 1
      runtime.readId += 1
      // 取得锁即替代本宿主旧失败，并清掉冲突提示；其他宿主的失败仍保留。
      entry.failure = null
      notificationsConfig.preferences.conflict = false
      notificationsConfig.preferences.saving = true
      const body = {
        expectedRevision: snapshotValue.revision,
        optionalCategories: { ...snapshotValue.optionalCategories, [field]: value },
      }
      const owned = () => notificationsConfig.epoch === run.epoch && runtime.save === run
      try {
        const { data: result } = await instance({
          url: '/api/notification-preferences',
          method: 'PUT',
          alert: false,
          data: body,
        })
        if (!owned()) return null
        runtime.writeVersion += 1
        runtime.readId += 1
        notificationsConfig.preferences.snapshot = result
        notificationsConfig.preferences.status = 'ready'
        return { ...result.optionalCategories }
      } catch (error) {
        if (!owned()) return null
        if (sessionInvalid(error)) return null
        // 会话失效已经递增 epoch：旧身份不能再建立失败意图或覆盖新身份状态。
        if (!owned()) return null
        runtime.writeVersion += 1
        runtime.readId += 1
        if (error instanceof ExAxiosError && error.status === 409) {
          notificationsConfig.preferences.conflict = true
          // 冲突不是可重试的写失败：全部宿主的旧意图立即清除，防止跨冲突重发。
          for (const other of hostSlots.entries) other.failure = null
          runtime.needsCanonicalRead = true
          await reconcile()
          if (!owned()) return null
          // 重读失败时没有可用规范值：保留冲突与读取重试，不把旧缓存当成可写状态。
          return runtime.needsCanonicalRead ? null : canonicalValues()
        }
        notificationsConfig.preferences.status = 'ready'
        const live = liveSlot(slotGeneration)
        if (live !== null && live.epoch === runtime.epoch) {
          live.failure = { id: ++runtime.failureId, field, value }
        }
        return canonicalValues()
      } finally {
        if (runtime.save === run && notificationsConfig.epoch === run.epoch) {
          runtime.save = null
          notificationsConfig.preferences.saving = false
        }
      }
    },
    [authenticated, sessionInvalid, reconcile],
  )

  /** 重试：只有仍是当前失败标识、且校验值等于原目标值时才重发 PUT。 */
  const retrySave = useCallback(
    async (
      slotGeneration: number,
      failureId: number,
      validated: NotificationPreferencesDraft,
    ): Promise<PreferenceCanonicalValues> => {
      syncRuntime()
      const entry = liveSlot(slotGeneration)
      if (entry === null || entry.epoch !== runtime.epoch) return null
      const intent = entry.failure
      if (intent === null || intent.id !== failureId || validated[intent.field] !== intent.value) {
        // 失败标识已被替代：不重发，只把可用规范值交回 Form 复位。
        return canonicalValues()
      }
      return await commitField(slotGeneration, intent.field, intent.value)
    },
    [commitField],
  )

  const canonical = snapshot.preferences.snapshot
  const failure = slot?.failure ?? null
  const slice: SettingsNotificationsSlice = {
    identityEpoch: snapshot.epoch,
    preferences: canonical === null ? null : { ...canonical.optionalCategories },
    status: snapshot.preferences.status,
    saving: snapshot.preferences.saving,
    conflict: snapshot.preferences.conflict,
    failure:
      failure === null
        ? null
        : {
            id: failure.id,
            // 另一字段随规范快照投影更新，原失败字段与目标值固定。
            retryValues: {
              ...(canonical?.optionalCategories ?? defaults),
              [failure.field]: failure.value,
            },
            onRetrySave: (validated) => retrySave(generation, failure.id, validated),
          },
    onRetryRead: () => void load(),
    onSaveField: (field, validated) => commitField(generation, field, validated[field]),
  }
  return { slice, load, snapshot }
}
function currentToken(): string | null {
  try {
    return readToken(window.localStorage)
  } catch {
    return null
  }
}
