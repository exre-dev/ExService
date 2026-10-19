// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { selectSessionScope, writeToken } from '@web/src/auth/storage'
import {
  bindNotificationsToken,
  captureNotificationWrite,
  notificationsConfig,
} from '@web/src/notifications/notificationsConfig'
import { ExAxiosError } from '@workspace/sdk'
import type { NotificationPreferencesDraft, PreferenceField } from '@workspace/components'

const get = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
const invalidateSession = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'anonymous' }))
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get, PUT: put }
    return handlers[(config.method ?? 'GET') as keyof typeof handlers](config)
  },
}))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({
    state: { status: authState.status },
    invalidateSession,
    refreshProfile: vi.fn(),
    retrySession: vi.fn(),
    logout: vi.fn(),
  }),
}))

import { useNotificationPreferencesController } from '@web/src/notifications/useNotificationPreferencesController'

interface Stored {
  revision: number
  optionalCategories: NotificationPreferencesDraft
}

const stored = {
  revision: 3,
  optionalCategories: { announcement: true, personal_update: false },
  necessaryCategories: ['service_notice'],
  serverTime: 0,
}
const canonical = stored.optionalCategories

beforeEach(() => {
  writeToken(window.localStorage, 'session-token')
  bindNotificationsToken('session-token')
})

afterEach(() => {
  cleanup()
  get.mockReset()
  put.mockReset()
  invalidateSession.mockClear()
  authState.status = 'authenticated'
  bindNotificationsToken(null)
  window.localStorage.clear()
  selectSessionScope('/api')
})

/** 一个设置宿主；`active` 与 SettingsExperience 的分类投影同源。 */
function host(active = true) {
  return renderHook(() => useNotificationPreferencesController({ active }))
}
async function load(target: ReturnType<typeof host>) {
  await act(async () => {
    await target.result.current.load()
  })
}
/** 一次明确的字段意图；另一字段由 module 在取得锁时按最新规范快照重基。 */
function send(
  target: ReturnType<typeof host>,
  field: PreferenceField,
  values?: NotificationPreferencesDraft,
) {
  return target.result.current.slice.onSaveField(
    field,
    values ?? { ...canonical, [field]: !canonical[field] },
  )
}
function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
const updated = (overrides: Partial<Stored> = {}) => ({ ...stored, ...overrides })

describe('notification preferences controller', () => {
  it('clears preferences and discards a same-token old-root read', async () => {
    selectSessionScope('/scope-a')
    writeToken(window.localStorage, 'session-token')
    const pending = deferred()
    get.mockResolvedValueOnce(stored).mockReturnValueOnce(pending.promise)
    const target = host()
    await load(target)
    expect(notificationsConfig.preferences.snapshot).toEqual(stored)
    let old!: Promise<void>
    act(() => {
      old = target.result.current.load()
    })
    window.localStorage.setItem(
      `exwebsite.auth.token:${encodeURIComponent(new URL('/scope-b', window.location.origin).href)}`,
      'session-token',
    )
    act(() => selectSessionScope('/scope-b'))
    expect(notificationsConfig.preferences.snapshot).toBeNull()
    await act(async () => {
      pending.resolve(stored)
      await old
    })
    expect(notificationsConfig.preferences.snapshot).toBeNull()
    expect(notificationsConfig.preferences.status).toBe('idle')
  })

  it('settles an already-sent PUT into a surviving owner after its original owner exits', async () => {
    get.mockResolvedValue(stored)
    const writer = host(),
      surviving = host()
    await load(writer)
    const pending = deferred()
    put.mockReturnValue(pending.promise)
    let task!: Promise<unknown>
    act(() => {
      task = send(writer, 'announcement').catch(() => null)
    })
    await act(async () => {
      writer.unmount()
    })
    expect(surviving.result.current.slice.saving).toBe(true)
    const ignored = send(surviving, 'announcement', {
      announcement: true,
      personal_update: true,
    }).then(
      () => false,
      () => true,
    )
    await act(async () => {
      await ignored
    })
    expect(put).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(
        updated({
          revision: 4,
          optionalCategories: { announcement: false, personal_update: true },
        }),
      )
      await task
    })
    expect(surviving.result.current.slice).toMatchObject({
      saving: false,
      preferences: { announcement: false, personal_update: true },
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(4)
  })
  it('re-reads a detached PUT conflict for the surviving owner without submitting again', async () => {
    get
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(
        updated({
          revision: 8,
          optionalCategories: { announcement: false, personal_update: false },
        }),
      )
    const writer = host(),
      surviving = host()
    await load(writer)
    const pending = deferred()
    put.mockReturnValue(pending.promise)
    let task!: Promise<unknown>
    act(() => {
      task = send(writer, 'announcement').catch(() => null)
    })
    writer.unmount()
    await act(async () => {
      pending.reject(
        new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
      )
      await task
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(1)
    expect(surviving.result.current.slice).toMatchObject({
      status: 'ready',
      saving: false,
      conflict: true,
      preferences: { announcement: false, personal_update: false },
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(8)
  })
  it('leaves a retryable read error when detached conflict reconciliation fails', async () => {
    get
      .mockResolvedValueOnce(stored)
      .mockRejectedValueOnce(new Error('private reconciliation failure'))
      .mockResolvedValueOnce(updated({ revision: 8 }))
    const writer = host(),
      surviving = host()
    await load(writer)
    const pending = deferred()
    put.mockReturnValue(pending.promise)
    let task!: Promise<unknown>
    act(() => {
      task = send(writer, 'announcement').catch(() => null)
    })
    writer.unmount()
    await act(async () => {
      pending.reject(
        new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
      )
      await task
    })
    expect(surviving.result.current.slice).toMatchObject({ status: 'error', saving: false })
    expect(notificationsConfig.preferences.error).toBe('通知设置暂时无法读取')
    await act(async () => {
      surviving.result.current.slice.onRetryRead()
    })
    expect(surviving.result.current.slice.status).toBe('ready')
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(8)
    expect(put).toHaveBeenCalledTimes(1)
  })
  it.each(['success', 'error'] as const)(
    'restores a surviving ready owner when the latest GET owner unmounts before %s',
    async (outcome) => {
      get.mockResolvedValue(stored)
      const surviving = host()
      await load(surviving)
      const temporary = host(),
        pending = deferred<Stored>()
      get.mockReturnValueOnce(pending.promise)
      let task!: Promise<void>
      await act(async () => {
        task = temporary.result.current.load()
      })
      expect(surviving.result.current.slice.status).toBe('loading')
      await act(async () => {
        temporary.unmount()
      })
      expect(surviving.result.current.slice.status).toBe('ready')
      await act(async () => {
        if (outcome === 'success') pending.resolve(updated({ revision: 99 }))
        else pending.reject(new Error('closed modal error'))
        await task
      })
      expect(surviving.result.current.slice).toMatchObject({
        status: 'ready',
        preferences: canonical,
      })
      expect(notificationsConfig.preferences.snapshot?.revision).toBe(3)
    },
  )
  it('keeps a surviving reader and shared PUT acceptance alive after the save owner unmounts', async () => {
    get.mockResolvedValue(stored)
    const writer = host(),
      reader = host()
    await load(writer)
    const write = deferred<Stored>(),
      read = deferred<Stored>()
    put.mockReturnValue(write.promise)
    get.mockReturnValueOnce(read.promise)
    let save!: Promise<unknown>, loadTask!: Promise<void>
    act(() => {
      save = send(writer, 'announcement').catch(() => null)
      loadTask = reader.result.current.load()
    })
    await act(async () => {
      writer.unmount()
    })
    expect(reader.result.current.slice).toMatchObject({ status: 'loading', saving: true })
    await act(async () => {
      write.resolve(updated({ revision: 99 }))
      read.resolve(updated({ revision: 88 }))
      await save
      await loadTask
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(99)
    expect(reader.result.current.slice.status).toBe('ready')
  })
  it.each([400, 500])(
    'keeps confirmed values and projects a local failure for HTTP %s',
    async (status) => {
      get.mockResolvedValue(stored)
      put.mockRejectedValue(
        new ExAxiosError('http', 'HTTP_ERROR', 'secret SQL credentials', { status }),
      )
      const hook = host()
      await load(hook)
      let settled: unknown
      await act(async () => {
        settled = await send(hook, 'announcement')
      })
      expect(settled).toEqual(canonical)
      expect(hook.result.current.slice.status).toBe('ready')
      expect(hook.result.current.slice.saving).toBe(false)
      // 失败意图固定原字段目标值，另一字段沿用当前规范值；服务器原文不进入投影。
      expect(hook.result.current.slice.failure?.retryValues).toEqual({
        announcement: false,
        personal_update: false,
      })
      expect(JSON.stringify(hook.result.current.slice.failure)).not.toContain('secret')
    },
  )
  it('clears identity and releases saving when PUT reports SESSION_INVALID', async () => {
    get.mockResolvedValue(stored)
    put.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', 'private session details', { status: 401 }),
    )
    const hook = host()
    await load(hook)
    let settled: unknown
    await act(async () => {
      settled = await send(hook, 'announcement')
    })
    expect(invalidateSession).toHaveBeenCalledWith('session-token')
    expect(settled).toBeNull()
    expect(hook.result.current.slice).toMatchObject({
      preferences: null,
      status: 'idle',
      saving: false,
    })
    // 旧身份不能留下可重试的失败意图。
    expect(hook.result.current.slice.failure).toBeNull()
  })
  it('discards a latest GET completion after its owner unmounts', async () => {
    const pending = deferred<Stored>()
    get.mockReturnValue(pending.promise)
    const hook = host()
    let task!: Promise<void>
    act(() => {
      task = hook.result.current.load()
    })
    hook.unmount()
    await act(async () => {
      pending.resolve(stored)
      await task
    })
    expect(notificationsConfig.preferences.snapshot).toBeNull()
  })
  it('accepts only the latest GET and remains independent from receipt write generations', async () => {
    const first = deferred<Stored>(),
      second = deferred<Stored>()
    get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const hook = host()
    let old!: Promise<void>, latest!: Promise<void>
    act(() => {
      old = hook.result.current.load()
      latest = hook.result.current.load()
    })
    act(() => {
      captureNotificationWrite()
    })
    await act(async () => {
      second.resolve(updated({ revision: 8 }))
      await latest
    })
    await act(async () => {
      first.resolve(stored)
      await old
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(8)
  })
  it('guards duplicate saves synchronously and returns the canonical server values', async () => {
    get.mockResolvedValue(stored)
    const pending = deferred<Stored>()
    put.mockReturnValue(pending.promise)
    const hook = host()
    await load(hook)
    let first!: Promise<unknown>
    act(() => {
      first = send(hook, 'announcement')
    })
    const duplicate = send(hook, 'personal_update', { announcement: true, personal_update: true })
    expect(put).toHaveBeenCalledTimes(1)
    let canonicalResult: unknown
    await act(async () => {
      pending.resolve(updated({ revision: 4 }))
      canonicalResult = await first
    })
    expect(await act(async () => await duplicate)).toEqual(canonical)
    expect(canonicalResult).toEqual(canonical)
  })
  it.each([
    ['token', 'success'],
    ['token', 'error'],
    ['scope', 'success'],
    ['scope', 'error'],
  ] as const)(
    'isolates an old %s save returning %s from a new pending save',
    async (change, outcome) => {
      get.mockResolvedValue(stored)
      const old = deferred<Stored>(),
        next = deferred<Stored>()
      put.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
      const hook = host()
      await load(hook)
      let first!: Promise<unknown>
      act(() => {
        first = send(hook, 'announcement').catch(() => null)
      })
      await act(async () => {
        if (change === 'token') {
          writeToken(window.localStorage, 'other-token')
          bindNotificationsToken('other-token')
        } else {
          window.localStorage.setItem(
            `exwebsite.auth.token:${encodeURIComponent(new URL('/scope-b', window.location.origin).href)}`,
            'session-token',
          )
          selectSessionScope('/scope-b')
        }
        await hook.result.current.load()
      })
      let second!: Promise<unknown>
      act(() => {
        second = send(hook, 'personal_update')
      })
      await act(async () => {
        if (outcome === 'success') old.resolve(updated({ revision: 99 }))
        else old.reject(new ExAxiosError('http', 'SESSION_INVALID', 'expired', { status: 401 }))
        await first
      })
      expect(hook.result.current.slice.saving).toBe(true)
      expect(invalidateSession).not.toHaveBeenCalled()
      expect(notificationsConfig.preferences.snapshot?.revision).toBe(3)
      await act(async () => {
        next.resolve(updated({ revision: 4 }))
        await second
      })
      expect(hook.result.current.slice.saving).toBe(false)
      expect(notificationsConfig.preferences.snapshot?.revision).toBe(4)
    },
  )
  it('does not save for an anonymous user even if a previous snapshot is present', async () => {
    authState.status = 'anonymous'
    notificationsConfig.preferences.snapshot =
      stored as typeof notificationsConfig.preferences.snapshot
    put.mockResolvedValue(stored)
    const hook = host()
    // 没有身份就没有可用规范值：不写入，也不交回可复位的值。
    expect(await act(async () => await send(hook, 'announcement'))).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })
  it('shares the save lock and invalidates another mounted owner’s older GET', async () => {
    get.mockResolvedValue(stored)
    const firstOwner = host(),
      secondOwner = host()
    await load(firstOwner)
    const oldRead = deferred<Stored>(),
      write = deferred<Stored>()
    get.mockReturnValueOnce(oldRead.promise)
    put.mockReturnValue(write.promise)
    let read!: Promise<void>, save!: Promise<unknown>, duplicate!: Promise<unknown>
    // 新字段事件在其他普通 GET 尚 loading 时不保存，因此先取得共享写锁，再发起那个会被淘汰的 GET。
    act(() => {
      save = send(secondOwner, 'announcement')
      const duplicateAttempt = send(firstOwner, 'personal_update', {
        announcement: true,
        personal_update: true,
      })
      duplicate = duplicateAttempt
      read = firstOwner.result.current.load()
    })
    expect(put).toHaveBeenCalledTimes(1)
    await act(async () => {
      write.resolve(
        updated({
          revision: 4,
          optionalCategories: { announcement: false, personal_update: true },
        }),
      )
      await save
    })
    // 被共享锁拒绝的第二次发送不排队，只交回取得锁之前的规范值。
    expect(await act(async () => await duplicate)).toEqual(canonical)
    await act(async () => {
      oldRead.resolve(stored)
      await read
    })
    expect(firstOwner.result.current.slice.preferences).toEqual({
      announcement: false,
      personal_update: true,
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(4)
  })
  it('discards a GET begun during PUT when it returns after canonical save success', async () => {
    get.mockResolvedValue(stored)
    const hook = host()
    await load(hook)
    const write = deferred<Stored>(),
      oldRead = deferred<Stored>()
    put.mockReturnValue(write.promise)
    get.mockReturnValueOnce(oldRead.promise)
    let save!: Promise<unknown>, read!: Promise<void>
    act(() => {
      save = send(hook, 'announcement')
      read = hook.result.current.load()
    })
    await act(async () => {
      write.resolve(updated({ revision: 8 }))
      await save
    })
    await act(async () => {
      oldRead.resolve(stored)
      await read
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(8)
  })
  it('settles shared canonical values after owner unmount with alert:false and no success feedback', async () => {
    get.mockResolvedValue(stored)
    const pending = deferred<Stored>()
    put.mockReturnValue(pending.promise)
    const hook = host()
    await load(hook)
    let task!: Promise<unknown>
    act(() => {
      task = send(hook, 'announcement').catch(() => null)
    })
    hook.unmount()
    await act(async () => {
      pending.resolve(updated({ revision: 99 }))
      await task
    })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(99)
    // 静默保存的主证据：请求本身不带 alert，模块里也没有成功文案字段。
    expect(put.mock.calls[0]?.[0]).toMatchObject({ alert: false })
    expect('message' in notificationsConfig.preferences).toBe(false)
  })

  it('reports the effective defaults and keeps the necessary categories out of the PUT body', async () => {
    get.mockResolvedValue(stored)
    put.mockResolvedValue(
      updated({ revision: 4, optionalCategories: { announcement: false, personal_update: false } }),
    )
    const hook = host()
    await load(hook)
    expect(get).toHaveBeenCalledWith({
      url: '/notification-preferences',
      method: 'GET',
      alert: false,
    })
    expect(hook.result.current.slice.preferences).toEqual({
      announcement: true,
      personal_update: false,
    })
    await act(async () => {
      await send(hook, 'announcement', { announcement: false, personal_update: false })
    })
    // 必要类别只留在规范缓存，PUT 精确只有 expectedRevision 与两个可选字段。
    expect(put).toHaveBeenCalledWith({
      url: '/notification-preferences',
      method: 'PUT',
      alert: false,
      data: {
        expectedRevision: 3,
        optionalCategories: { announcement: false, personal_update: false },
      },
    })
    expect(notificationsConfig.preferences.snapshot?.necessaryCategories).toEqual([
      'service_notice',
    ])
    expect(hook.result.current.slice.failure).toBeNull()
    hook.unmount()
  })

  it('re-reads canonical server values on a 409 instead of retaining a draft or overwriting', async () => {
    get
      .mockResolvedValueOnce(stored)
      .mockResolvedValueOnce(
        updated({
          revision: 8,
          optionalCategories: { announcement: false, personal_update: false },
        }),
      )
    put.mockRejectedValue(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', '设置已被其他设备修改', { status: 409 }),
    )
    const hook = host()
    await load(hook)
    let settled: unknown
    await act(async () => {
      settled = await send(hook, 'announcement')
    })
    expect(hook.result.current.slice.conflict).toBe(true)
    expect(hook.result.current.slice.preferences).toEqual({
      announcement: false,
      personal_update: false,
    })
    expect(settled).toEqual({ announcement: false, personal_update: false })
    expect(notificationsConfig.preferences.snapshot?.revision).toBe(8)
    // 冲突不是可重试的写失败：不建立局部失败，也不重复提交 PUT。
    expect(hook.result.current.slice.failure).toBeNull()
    expect(put).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    hook.unmount()
  })

  it.each(['announcement', 'personal_update'] as const)(
    'rebases the failed %s intent against the latest canonical snapshot when the retry takes the lock',
    async (field) => {
      const other: PreferenceField = field === 'announcement' ? 'personal_update' : 'announcement'
      get.mockResolvedValue(stored)
      const writer = host(),
        updater = host()
      await load(writer)
      // A 的字段意图失败，module 留下原字段/目标值。
      put.mockRejectedValueOnce(new Error('private save failure'))
      await act(async () => {
        await send(writer, field, { ...canonical, [field]: !canonical[field] })
      })
      const failure = writer.result.current.slice.failure
      expect(failure?.retryValues[field]).toBe(!canonical[field])
      // B 更新另一字段，规范快照与 revision 一起前进。
      const nextCanonical = { announcement: false, personal_update: true }
      put.mockResolvedValueOnce(updated({ revision: 4, optionalCategories: nextCanonical }))
      await act(async () => {
        await send(updater, other, nextCanonical)
      })
      // 故意传入过时的另一字段：取得锁时的最新规范快照必须胜出。
      const pending = deferred<Stored>()
      put.mockReturnValue(pending.promise)
      let task!: Promise<unknown>
      act(() => {
        task = failure!.onRetrySave({ ...canonical, [field]: failure!.retryValues[field] })
      })
      expect(put).toHaveBeenLastCalledWith({
        url: '/notification-preferences',
        method: 'PUT',
        alert: false,
        data: {
          expectedRevision: 4,
          optionalCategories: { ...nextCanonical, [field]: !canonical[field] },
        },
      })
      await act(async () => {
        pending.resolve(updated({ revision: 5, optionalCategories: nextCanonical }))
        await task
      })
    },
  )

  it('re-bases a retry that is still validating when the canonical snapshot moves again', async () => {
    get.mockResolvedValue(stored)
    const writer = host(),
      updater = host()
    await load(writer)
    put.mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(writer, 'announcement', { announcement: false, personal_update: false })
    })
    const failure = writer.result.current.slice.failure!
    // 校验期间另一宿主更新规范快照：旧 callback 仍只固定原字段，另一字段取最新值。
    const nextCanonical = { announcement: true, personal_update: true }
    put.mockResolvedValueOnce(updated({ revision: 7, optionalCategories: nextCanonical }))
    await act(async () => {
      await send(updater, 'personal_update', nextCanonical)
    })
    const pending = deferred<Stored>()
    put.mockReturnValue(pending.promise)
    let task!: Promise<unknown>
    act(() => {
      task = failure.onRetrySave({ announcement: false, personal_update: false })
    })
    expect(put).toHaveBeenLastCalledWith({
      url: '/notification-preferences',
      method: 'PUT',
      alert: false,
      data: {
        expectedRevision: 7,
        optionalCategories: { announcement: false, personal_update: true },
      },
    })
    await act(async () => {
      pending.resolve(updated({ revision: 8, optionalCategories: nextCanonical }))
      await task
    })
  })

  it('refuses a stale retry callback once its failure id has been superseded', async () => {
    get.mockResolvedValue(stored)
    const hook = host()
    await load(hook)
    put.mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(hook, 'announcement', { announcement: false, personal_update: false })
    })
    const stale = hook.result.current.slice.failure!
    // 一次新的有效字段事件取得锁，替代旧失败意图。
    put.mockResolvedValueOnce(updated({ revision: 4 }))
    await act(async () => {
      await send(hook, 'personal_update', { announcement: true, personal_update: true })
    })
    expect(hook.result.current.slice.failure).toBeNull()
    const settled = await act(
      async () => await stale.onRetrySave({ announcement: false, personal_update: false }),
    )
    expect(put).toHaveBeenCalledTimes(2)
    expect(settled).toEqual(canonical)
  })

  it('refuses a retry whose validated value no longer matches the original target', async () => {
    get.mockResolvedValue(stored)
    const hook = host()
    await load(hook)
    put.mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(hook, 'announcement', { announcement: false, personal_update: false })
    })
    const failure = hook.result.current.slice.failure!
    const settled = await act(
      async () => await failure.onRetrySave({ announcement: true, personal_update: false }),
    )
    expect(put).toHaveBeenCalledTimes(1)
    expect(settled).toEqual(canonical)
  })

  it('keeps the failure id stable while another host moves the canonical snapshot', async () => {
    get.mockResolvedValue(stored)
    const writer = host(),
      updater = host()
    await load(writer)
    put.mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(writer, 'announcement', { announcement: false, personal_update: false })
    })
    const before = writer.result.current.slice.failure!
    put.mockResolvedValueOnce(
      updated({ revision: 4, optionalCategories: { announcement: true, personal_update: true } }),
    )
    await act(async () => {
      await send(updater, 'personal_update', { announcement: true, personal_update: true })
    })
    const after = writer.result.current.slice.failure!
    // 同一失败事件：id 不变，retryValues 的另一字段随规范值走，原目标值固定。
    expect(after.id).toBe(before.id)
    expect(after.retryValues).toEqual({ announcement: false, personal_update: true })
    // B 从未拿到 A 的失败入口。
    expect(updater.result.current.slice.failure).toBeNull()
  })

  it('keeps each host failure in its own slot and clears only the one that saved', async () => {
    get.mockResolvedValue(stored)
    const first = host(),
      second = host()
    await load(first)
    put.mockRejectedValue(new Error('private save failure'))
    await act(async () => {
      await send(first, 'announcement', { announcement: false, personal_update: false })
    })
    await act(async () => {
      await send(second, 'personal_update', { announcement: true, personal_update: true })
    })
    expect(first.result.current.slice.failure?.retryValues.announcement).toBe(false)
    expect(second.result.current.slice.failure?.retryValues.personal_update).toBe(true)
    put.mockResolvedValueOnce(updated({ revision: 4 }))
    await act(async () => {
      await send(first, 'announcement', { announcement: false, personal_update: false })
    })
    expect(first.result.current.slice.failure).toBeNull()
    expect(second.result.current.slice.failure).not.toBeNull()
  })

  it('clears every host failure on a 409 so no stale intent is replayed across the conflict', async () => {
    get.mockResolvedValue(stored).mockResolvedValueOnce(updated({ revision: 9 }))
    const first = host(),
      second = host()
    await load(first)
    put
      .mockRejectedValueOnce(new Error('private save failure'))
      .mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(first, 'announcement', { announcement: false, personal_update: false })
    })
    await act(async () => {
      await send(second, 'personal_update', { announcement: true, personal_update: true })
    })
    put.mockRejectedValue(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', '设置已被其他设备修改', { status: 409 }),
    )
    await act(async () => {
      await send(first, 'announcement', { announcement: false, personal_update: false })
    })
    expect(first.result.current.slice.conflict).toBe(true)
    expect(first.result.current.slice.failure).toBeNull()
    expect(second.result.current.slice.failure).toBeNull()
  })

  it('refuses writes and hands back no canonical values while a canonical re-read is still required', async () => {
    get
      .mockResolvedValueOnce(stored)
      .mockRejectedValueOnce(new Error('private reconciliation failure'))
    const hook = host()
    await load(hook)
    put.mockRejectedValue(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
    )
    await act(async () => {
      await send(hook, 'announcement')
    })
    expect(hook.result.current.slice.status).toBe('error')
    // 重读失败时旧缓存不能当成可写状态：不发出 PUT，也不返回可用规范值。
    const settled = await act(async () => await send(hook, 'announcement'))
    expect(put).toHaveBeenCalledTimes(1)
    expect(settled).toBeNull()
    expect(hook.result.current.slice.conflict).toBe(true)
  })

  it('keeps the read-error gate instead of restoring cached ready when a host unmounts', async () => {
    get
      .mockResolvedValueOnce(stored)
      .mockRejectedValueOnce(new Error('private reconciliation failure'))
    const writer = host(),
      surviving = host()
    await load(writer)
    put.mockRejectedValue(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
    )
    await act(async () => {
      await send(writer, 'announcement')
    })
    expect(surviving.result.current.slice.status).toBe('error')
    const temporary = host(),
      pending = deferred<Stored>()
    get.mockReturnValueOnce(pending.promise)
    let read!: Promise<void>
    await act(async () => {
      read = temporary.result.current.load()
    })
    await act(async () => {
      temporary.unmount()
    })
    // 普通读宿主卸载不能把「仍需要规范读取」恢复成 ready。
    expect(surviving.result.current.slice.status).toBe('error')
    await act(async () => {
      pending.resolve(stored)
      await read
    })
    expect(surviving.result.current.slice.status).toBe('error')
  })

  it('clears the conflict on the next valid field event but not on a read retry', async () => {
    get.mockResolvedValue(stored)
    const hook = host()
    await load(hook)
    put.mockRejectedValueOnce(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
    )
    await act(async () => {
      await send(hook, 'announcement')
    })
    expect(hook.result.current.slice.conflict).toBe(true)
    // 读重试只 GET，不把「用户未重新调整」解释成写批准。
    await act(async () => {
      hook.result.current.slice.onRetryRead()
    })
    expect(get).toHaveBeenCalledTimes(3)
    expect(put).toHaveBeenCalledTimes(1)
    expect(hook.result.current.slice.conflict).toBe(true)
    // 有效字段事件取得锁的那一刻清掉冲突提示。
    const pending = deferred<Stored>()
    put.mockReturnValue(pending.promise)
    let task!: Promise<unknown>
    act(() => {
      task = send(hook, 'announcement', { announcement: false, personal_update: false })
    })
    expect(notificationsConfig.preferences.conflict).toBe(false)
    await act(async () => {
      pending.resolve(updated({ revision: 5 }))
      await task
    })
    expect(hook.result.current.slice.conflict).toBe(false)
  })

  it('refuses to send from an inactive host without clearing the shared conflict', async () => {
    get.mockResolvedValue(stored)
    const hook = host()
    await load(hook)
    put.mockRejectedValueOnce(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
    )
    await act(async () => {
      await send(hook, 'announcement')
    })
    const inactive = host(false)
    expect(await act(async () => await send(inactive, 'announcement'))).toBeNull()
    expect(put).toHaveBeenCalledTimes(1)
    // 分类切走既不卸载 slot 也不清失败，被拒绝的发送也不能清掉共享冲突。
    expect(notificationsConfig.preferences.conflict).toBe(true)
    expect(inactive.result.current.slice.conflict).toBe(true)
  })

  it('drops the local failure when its host unmounts and leaves another host’s failure alone', async () => {
    get.mockResolvedValue(stored)
    const writer = host(),
      other = host()
    await load(writer)
    put.mockRejectedValue(new Error('private save failure'))
    await act(async () => {
      await send(writer, 'announcement', { announcement: false, personal_update: false })
    })
    await act(async () => {
      await send(other, 'personal_update', { announcement: true, personal_update: true })
    })
    await act(async () => {
      writer.unmount()
    })
    const reopened = host()
    expect(reopened.result.current.slice.failure).toBeNull()
    expect(other.result.current.slice.failure).not.toBeNull()
    // 规范快照仍共享，重新打开不需要重新读取即可写入。
    expect(reopened.result.current.slice.preferences).toEqual(canonical)
  })

  it('refuses a command whose host slot was detached', async () => {
    get.mockResolvedValue(stored)
    const hook = host()
    await load(hook)
    const stale = hook.result.current.slice
    await act(async () => {
      hook.unmount()
    })
    put.mockResolvedValue(updated({ revision: 4 }))
    expect(
      await act(
        async () =>
          await stale.onSaveField('announcement', { announcement: false, personal_update: false }),
      ),
    ).toBeNull()
    expect(put).not.toHaveBeenCalled()
  })

  it('issues a usable binding after a StrictMode setup-cleanup-setup re-attach', async () => {
    get.mockResolvedValue(stored)
    const hook = renderHook(() => useNotificationPreferencesController({ active: true }), {
      wrapper: StrictMode,
    })
    await load(hook)
    put.mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(hook, 'announcement', { announcement: false, personal_update: false })
    })
    // 重新登记后的 binding 必须能建立失败并继续写入。
    expect(hook.result.current.slice.failure).not.toBeNull()
    put.mockResolvedValueOnce(updated({ revision: 4 }))
    await act(async () => {
      await send(hook, 'announcement', { announcement: false, personal_update: false })
    })
    expect(put).toHaveBeenCalledTimes(2)
    expect(hook.result.current.slice.failure).toBeNull()
  })

  it('starts a new identity without the previous failure, conflict or canonical read gate', async () => {
    get
      .mockResolvedValueOnce(stored)
      .mockRejectedValueOnce(new Error('private reconciliation failure'))
    const previous = host()
    await load(previous)
    put.mockRejectedValueOnce(new Error('private save failure'))
    await act(async () => {
      await send(previous, 'announcement', { announcement: false, personal_update: false })
    })
    put.mockRejectedValueOnce(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', 'private conflict', { status: 409 }),
    )
    await act(async () => {
      await send(previous, 'announcement', { announcement: true, personal_update: true })
    })
    expect(previous.result.current.slice.conflict).toBe(true)
    // 逐用例隔离沿用既有 cleanup/bind(null)/clear，不使用私有 reset。
    await act(async () => {
      cleanup()
      bindNotificationsToken(null)
      window.localStorage.clear()
    })
    writeToken(window.localStorage, 'next-token')
    bindNotificationsToken('next-token')
    const next = host()
    expect(next.result.current.slice).toMatchObject({
      conflict: false,
      failure: null,
      preferences: null,
    })
    get.mockResolvedValue(updated({ revision: 2 }))
    await load(next)
    expect(next.result.current.slice.status).toBe('ready')
    put.mockClear()
    put.mockResolvedValue(
      updated({ revision: 3, optionalCategories: { announcement: false, personal_update: false } }),
    )
    await act(async () => {
      await send(next, 'announcement', { announcement: false, personal_update: false })
    })
    expect(put).toHaveBeenCalledTimes(1)
    expect(next.result.current.slice.preferences).toEqual({
      announcement: false,
      personal_update: false,
    })
  })

  it('keeps the failure inside its own slice without touching the profile store', async () => {
    get.mockRejectedValue(
      new ExAxiosError('http', 'HTTP_ERROR', '通知设置暂时无法读取', { status: 500 }),
    )
    const hook = host()
    await load(hook)
    expect(hook.result.current.slice.status).toBe('error')
    expect(notificationsConfig.preferences.error).toBe('通知设置暂时无法读取')
    hook.unmount()
  })

  it('clears the private snapshot and hands back the session on SESSION_INVALID', async () => {
    get.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', '会话已失效', { status: 401 }),
    )
    const hook = host()
    await load(hook)
    expect(invalidateSession).toHaveBeenCalledWith('session-token')
    expect(notificationsConfig.preferences.snapshot).toBeNull()
    expect(notificationsConfig.preferences.status).toBe('idle')
    hook.unmount()
  })

  it('drops a late response after the account changes', async () => {
    let release!: (value: unknown) => void
    get.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const hook = host()
    let pending!: Promise<void>
    act(() => {
      pending = hook.result.current.load()
    })
    writeToken(window.localStorage, 'other-token')
    await act(async () => {
      bindNotificationsToken('other-token')
    })
    await act(async () => {
      release(stored)
      await pending
    })
    expect(notificationsConfig.preferences.snapshot).toBeNull()
    expect(notificationsConfig.preferences.status).toBe('idle')
    hook.unmount()
  })

  it('advances the identity epoch handed to the form when the account changes', async () => {
    // 表单靠这个代次丢弃上一个身份的草稿；控制器必须真的把它接出来。
    get.mockResolvedValue(stored)
    const hook = host()
    const first = hook.result.current.slice.identityEpoch
    await load(hook)
    expect(hook.result.current.slice.identityEpoch).toBe(first)

    writeToken(window.localStorage, 'other-token')
    await act(async () => {
      bindNotificationsToken('other-token')
    })
    expect(hook.result.current.slice.identityEpoch).toBeGreaterThan(first)
    // 同一 token 重复绑定不应抖动，否则每次都会清一次草稿。
    await act(async () => {
      bindNotificationsToken('other-token')
    })
    expect(hook.result.current.slice.identityEpoch).toBe(first + 1)
    hook.unmount()
  })

  it('does not read anything for an anonymous visitor', async () => {
    authState.status = 'anonymous'
    const hook = host()
    await load(hook)
    expect(get).not.toHaveBeenCalled()
    hook.unmount()
  })
})
