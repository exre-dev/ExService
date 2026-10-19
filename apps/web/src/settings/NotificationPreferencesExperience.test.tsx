// @vitest-environment jsdom
// 真实 seam 联动：SettingsExperience + SettingsPanel + NotificationPreferencesForm +
// controller + Valtio 全部使用生产实现，只 mock Client/auth/theme 与 DOM 环境。
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExMessage } from '@exre/exui'
import { writeToken } from '@web/src/auth/storage'
import {
  bindNotificationsToken,
  captureNotificationWrite,
} from '@web/src/notifications/notificationsConfig'
import { bindSettingsToken } from '@web/src/settings/settingsConfig'
import { ExAxiosError } from '@workspace/sdk'

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
vi.mock('@exre/exui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@exre/exui')>()),
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}))

import { SettingsExperience, SettingsModal } from '@web/src/settings/SettingsExperience'

const profile = {
  id: '8e5b2093-dcce-422c-af4d-e4b58ba66ab5',
  email: 'person@example.com',
  nickname: 'Person',
  qq: '123456789',
  fivemId: null,
  avatarUrl: null,
}
const stored = {
  revision: 3,
  optionalCategories: { announcement: true, personal_update: false },
  necessaryCategories: ['service_notice'],
  serverTime: 0,
}
type Stored = typeof stored

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  writeToken(window.localStorage, 'current-token')
  bindNotificationsToken('current-token')
})

afterEach(() => {
  cleanup()
  get.mockReset()
  put.mockReset()
  invalidateSession.mockClear()
  authState.status = 'authenticated'
  bindSettingsToken(null)
  bindNotificationsToken(null)
  window.localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function respond(overrides: { failPreferences?: boolean } = {}) {
  get.mockImplementation(({ url: path }: { url: string }) => {
    if (path === '/notification-preferences') {
      return overrides.failPreferences
        ? Promise.reject(new Error('通知设置暂时无法读取'))
        : Promise.resolve(stored)
    }
    return Promise.resolve(profile)
  })
}
/** 按顺序列出后续偏好读取；`'reject'` 表示一次读取失败，用尽后回落到 `stored`。 */
function respondSequence(responses: Array<Stored | 'reject'>) {
  let index = 0
  get.mockImplementation(({ url: path }: { url: string }) => {
    if (path !== '/notification-preferences') return Promise.resolve(profile)
    const next = responses[index]
    index += 1
    if (next === undefined) return Promise.resolve(stored)
    return next === 'reject'
      ? Promise.reject(new Error('通知设置暂时无法读取'))
      : Promise.resolve(next)
  })
}
function deferred<T = Stored>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
/** 两个非 Modal 宿主：真实 Dialog 会屏蔽背景页面，跨宿主场景不能用 Modal 驱动。 */
async function twoHosts() {
  const pageA = render(<SettingsExperience initialCategory="notifications" />)
  const pageB = render(<SettingsExperience initialCategory="notifications" />)
  const a = within(pageA.container),
    b = within(pageB.container)
  await waitFor(() => expect(a.getByRole('switch', { name: '社区动态' })).toBeTruthy())
  await waitFor(() => expect(b.getByRole('switch', { name: '社区动态' })).toBeTruthy())
  return { pageA, pageB, a, b }
}
const checkedIn = (scope: ReturnType<typeof within>, name: string) =>
  scope.getByRole('switch', { name }).getAttribute('aria-checked')

describe('notification preferences real seam', () => {
  it('retries only the failed field against the latest canonical other value', async () => {
    respond()
    const { a, b } = await twoHosts()
    put.mockRejectedValueOnce(new Error('private save failure'))
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    await waitFor(() =>
      expect(a.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。'),
    )
    expect(checkedIn(a, '社区动态')).toBe('true')

    // B 更新个人提醒：规范快照与 revision 一起前进，全宿主采用新值。
    put.mockResolvedValueOnce({
      ...stored,
      revision: 4,
      optionalCategories: { announcement: true, personal_update: true },
    })
    await userEvent.click(b.getByRole('switch', { name: '个人提醒' }))
    await waitFor(() => expect(checkedIn(a, '个人提醒')).toBe('true'))

    // A 重试只重发公告意图，另一字段与 revision 取取得锁时的最新规范快照。
    put.mockResolvedValueOnce({
      ...stored,
      revision: 5,
      optionalCategories: { announcement: false, personal_update: true },
    })
    await userEvent.click(a.getByRole('button', { name: '重试保存' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(3))
    expect(put).toHaveBeenLastCalledWith({
      url: '/notification-preferences',
      method: 'PUT',
      alert: false,
      data: {
        expectedRevision: 4,
        optionalCategories: { announcement: false, personal_update: true },
      },
    })
    await waitFor(() => expect(checkedIn(a, '社区动态')).toBe('false'))
    expect(a.queryByRole('alert')).toBeNull()
    expect(a.queryByText(/已保存/)).toBeNull()
  })

  it('collapses rapid toggles into one PUT and keeps both switches disabled meanwhile', async () => {
    respond()
    const { a } = await twoHosts()
    const pending = deferred()
    put.mockReturnValue(pending.promise)
    act(() => {
      fireEvent.click(a.getByRole('switch', { name: '社区动态' }))
      fireEvent.click(a.getByRole('switch', { name: '个人提醒' }))
    })
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(a.getByRole('switch', { name: '社区动态' })).toHaveProperty('disabled', true)
    expect(a.getByRole('switch', { name: '个人提醒' })).toHaveProperty('disabled', true)
    expect(a.getByRole('status').textContent).toBe('保存中…')
    await act(async () => {
      pending.resolve({ ...stored, revision: 4 })
    })
    expect(a.queryByRole('status')).toBeNull()
  })

  it('keeps the failure intent across the other categories and offers it again on return', async () => {
    respond()
    const { a } = await twoHosts()
    put.mockRejectedValueOnce(new Error('private save failure'))
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(a.getByRole('button', { name: '重试保存' })).toBeTruthy())

    for (const category of ['通用', '个人资料', '账号']) {
      await userEvent.click(a.getByRole('button', { name: category }))
      // 三个非通知分类都没有通知表单内容，也不自动写入。
      expect(a.queryByRole('switch', { name: '社区动态' })).toBeNull()
      expect(a.queryByRole('button', { name: '重试保存' })).toBeNull()
      expect(put).toHaveBeenCalledTimes(1)
    }
    await userEvent.click(a.getByRole('button', { name: '通知' }))
    // 失败意图跨切分类保留，返回通知时仍可重试。
    expect(a.getByRole('button', { name: '重试保存' })).toBeTruthy()
    expect(a.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
  })

  it('drops the closed host retry intent without taking another host’s failure', async () => {
    respond()
    const { pageA, a, b } = await twoHosts()
    put.mockRejectedValue(new Error('private save failure'))
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    await userEvent.click(b.getByRole('switch', { name: '个人提醒' }))
    await waitFor(() => expect(a.getByRole('button', { name: '重试保存' })).toBeTruthy())
    await waitFor(() => expect(b.getByRole('button', { name: '重试保存' })).toBeTruthy())

    await act(async () => {
      pageA.unmount()
    })
    const reopened = within(
      render(<SettingsExperience initialCategory="notifications" />).container,
    )
    await waitFor(() => expect(reopened.getByRole('switch', { name: '社区动态' })).toBeTruthy())
    expect(reopened.queryByRole('button', { name: '重试保存' })).toBeNull()
    // 规范快照仍共享，B 的局部失败不被清掉。
    expect(checkedIn(reopened, '个人提醒')).toBe('false')
    expect(b.getByRole('button', { name: '重试保存' })).toBeTruthy()
  })

  it.each(['success', 'failure'] as const)(
    'settles an in-flight PUT after its host closes (%s)',
    async (outcome) => {
      respond()
      const { pageA, a, b } = await twoHosts()
      const pending = deferred()
      put.mockReturnValue(pending.promise)
      await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
      await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
      // 共享锁：B 在 A 的在途写入返回前不能发第二个人 PUT。
      await userEvent.click(b.getByRole('switch', { name: '个人提醒' }))
      expect(put).toHaveBeenCalledTimes(1)
      await act(async () => {
        pageA.unmount()
      })
      if (outcome === 'success') {
        await act(async () => {
          pending.resolve({
            ...stored,
            revision: 4,
            optionalCategories: { announcement: false, personal_update: true },
          })
        })
        await waitFor(() => expect(checkedIn(b, '社区动态')).toBe('false'))
        expect(b.queryByRole('button', { name: '重试保存' })).toBeNull()
      } else {
        await act(async () => {
          pending.reject(new Error('private save failure'))
        })
        // 原 slot 已销毁：失败不落地给 B，规范值保持已确认状态。
        await waitFor(() =>
          expect(
            b.getAllByRole('switch').every((element) => !(element as HTMLButtonElement).disabled),
          ).toBe(true),
        )
        expect(b.queryByRole('button', { name: '重试保存' })).toBeNull()
        expect(checkedIn(b, '社区动态')).toBe('true')
      }
    },
  )

  it('re-reads after a detached 409 and asks the reopened host for a new adjustment', async () => {
    respond()
    const { pageA, b } = await twoHosts()
    // 两次宿主读取已完成，接下来那次就是冲突后的规范重读。
    respondSequence([
      {
        ...stored,
        revision: 8,
        optionalCategories: { announcement: false, personal_update: true },
      },
    ])
    const pending = deferred()
    put.mockReturnValue(pending.promise)
    await userEvent.click(within(pageA.container).getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    await act(async () => {
      pageA.unmount()
      pending.reject(
        new ExAxiosError('http', 'PREFERENCES_CONFLICT', '设置已被其他设备修改', { status: 409 }),
      )
    })
    // 一次 PUT、一次有效规范 GET：B 显示新值与冲突，没有保存重试入口。
    await waitFor(() => expect(checkedIn(b, '社区动态')).toBe('false'))
    expect(put).toHaveBeenCalledTimes(1)
    expect(b.getByText('设置已由其他设备更新，请重新调整。')).toBeTruthy()
    expect(b.queryByRole('button', { name: '重试保存' })).toBeNull()
    // 只有用户重新调整才产生下一次 PUT。
    put.mockResolvedValue({
      ...stored,
      revision: 9,
      optionalCategories: { announcement: false, personal_update: false },
    })
    await userEvent.click(b.getByRole('switch', { name: '个人提醒' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
    expect(put).toHaveBeenLastCalledWith({
      url: '/notification-preferences',
      method: 'PUT',
      alert: false,
      data: {
        expectedRevision: 8,
        optionalCategories: { announcement: false, personal_update: false },
      },
    })
    expect(b.queryByText('设置已由其他设备更新，请重新调整。')).toBeNull()
    expect(b.queryByText(/已保存/)).toBeNull()
  })

  it('keeps the conflict read gate until an explicit read retry succeeds', async () => {
    respond()
    const { a, b } = await twoHosts()
    // 两次宿主读取已完成：接下来是冲突重读（失败）、另一宿主的读取（失败）与显式读取重试（成功）。
    respondSequence([
      'reject',
      'reject',
      {
        ...stored,
        revision: 8,
        optionalCategories: { announcement: false, personal_update: true },
      },
    ])
    put.mockRejectedValue(
      new ExAxiosError('http', 'PREFERENCES_CONFLICT', '设置已被其他设备修改', { status: 409 }),
    )
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    // 重读失败：旧缓存开关不可写，只提供读取重试。
    await waitFor(() => expect(a.getByRole('button', { name: '重试通知设置' })).toBeTruthy())
    expect(a.queryByRole('switch', { name: '社区动态' })).toBeNull()
    // 冲突恢复期间另一宿主进入通知分区也不能用缓存绕过恢复、不自动写入。
    const late = within(render(<SettingsExperience initialCategory="notifications" />).container)
    await waitFor(() => expect(late.getByRole('button', { name: '重试通知设置' })).toBeTruthy())
    expect(put).toHaveBeenCalledTimes(1)

    await userEvent.click(a.getByRole('button', { name: '重试通知设置' }))
    await waitFor(() => expect(a.getByRole('switch', { name: '社区动态' })).toBeTruthy())
    expect(checkedIn(a, '社区动态')).toBe('false')
    expect(a.getByText('设置已由其他设备更新，请重新调整。')).toBeTruthy()
    // 读重试只 GET：没有恢复旧意图，也没有自动 PUT。
    expect(put).toHaveBeenCalledTimes(1)
    expect(a.queryByRole('button', { name: '重试保存' })).toBeNull()
    expect(checkedIn(b, '社区动态')).toBe('false')
  })

  it('shares the pending save with the settings modal and settles it after the modal closes', async () => {
    respond()
    const page = render(<SettingsExperience initialCategory="notifications" />)
    const pageScope = within(page.container)
    await waitFor(() => expect(pageScope.getByRole('switch', { name: '社区动态' })).toBeTruthy())
    const pending = deferred()
    put.mockReturnValue(pending.promise)
    await userEvent.click(pageScope.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))

    // Modal 内容在 portal：必须从 document.body 里唯一的设置 dialog 取根。
    let requestClose: () => void = () => undefined
    const ModalHost = () => {
      const [open, setOpen] = useState(true)
      requestClose = () => setOpen(false)
      return open ? (
        <SettingsModal initialCategory="notifications" onClose={() => setOpen(false)} />
      ) : null
    }
    render(<ModalHost />)
    // portal 内容：每次轮询都重新取唯一设置 dialog，不沿用可能失效的元素引用。
    const dialogScope = () => within(screen.getByRole('dialog', { name: '设置' }))
    await waitFor(() =>
      expect(dialogScope().getByRole('switch', { name: '社区动态' })).toBeTruthy(),
    )
    const dialog = dialogScope()
    // 共享 pending：Modal 里的开关也被禁用，不产生第二个 PUT。
    expect((dialog.getByRole('switch', { name: '社区动态' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await userEvent.click(dialog.getByRole('switch', { name: '个人提醒' }))
    expect(put).toHaveBeenCalledTimes(1)

    // 关闭后重新查询页面入口：dialog 的 portal 节点已经移除。
    await act(async () => {
      requestClose()
    })
    await act(async () => {
      pending.resolve({
        ...stored,
        revision: 4,
        optionalCategories: { announcement: false, personal_update: true },
      })
    })
    await waitFor(() =>
      expect(pageScope.getByRole('switch', { name: '社区动态' }).getAttribute('aria-checked')).toBe(
        'false',
      ),
    )
    expect(pageScope.queryByRole('status')).toBeNull()
    expect(pageScope.queryByText(/已保存/)).toBeNull()
  })

  it('keeps the same root error across an equivalent failure and a new id after another failure', async () => {
    respond()
    const { a, b } = await twoHosts()
    put.mockRejectedValueOnce(new Error('private save failure'))
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    await waitFor(() =>
      expect(a.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。'),
    )
    // 另一宿主更新规范值：同一失败事件的 id 不变，错误不因 retryValues 变化被清掉。
    put.mockResolvedValueOnce({
      ...stored,
      revision: 4,
      optionalCategories: { announcement: true, personal_update: true },
    })
    await userEvent.click(b.getByRole('switch', { name: '个人提醒' }))
    await waitFor(() => expect(checkedIn(a, '个人提醒')).toBe('true'))
    expect(a.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
    expect(a.queryByRole('status')).toBeNull()
    // 重试再次失败产生新 id，错误仍然可见，且不自动写入。
    put.mockRejectedValueOnce(new Error('private save failure again'))
    await userEvent.click(a.getByRole('button', { name: '重试保存' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(3))
    await waitFor(() =>
      expect(a.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。'),
    )
    expect(a.queryByRole('status')).toBeNull()
  })

  it('starts a new identity without the previous failure and keeps late old results out', async () => {
    respond()
    const { pageA, a } = await twoHosts()
    put.mockRejectedValueOnce(new Error('private save failure'))
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(a.getByRole('button', { name: '重试保存' })).toBeTruthy())
    const oldPutCount = put.mock.calls.length
    // 逐用例隔离沿用既有 cleanup/bind(null)/clear，不使用私有 reset。
    await act(async () => {
      pageA.unmount()
      cleanup()
      bindNotificationsToken(null)
      window.localStorage.clear()
    })

    writeToken(window.localStorage, 'next-token')
    bindNotificationsToken('next-token')
    get.mockResolvedValue({ ...stored, revision: 1 })
    const next = within(render(<SettingsExperience initialCategory="notifications" />).container)
    await waitFor(() => expect(next.getByRole('switch', { name: '社区动态' })).toBeTruthy())
    // 新身份没有旧失败、旧冲突，也没有迟到旧结果。
    expect(next.queryByRole('button', { name: '重试保存' })).toBeNull()
    expect(next.queryByRole('alert')).toBeNull()
    expect(checkedIn(next, '个人提醒')).toBe('false')
    put.mockResolvedValue({
      ...stored,
      revision: 2,
      optionalCategories: { announcement: false, personal_update: false },
    })
    await userEvent.click(next.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(oldPutCount + 1))
    await waitFor(() => expect(checkedIn(next, '社区动态')).toBe('false'))
  })

  it('keeps preference acceptance independent from receipt write generations and profile failures', async () => {
    get.mockImplementation(({ url: path }: { url: string }) => {
      if (path === '/notification-preferences') return Promise.resolve(stored)
      return Promise.reject(new Error('资料暂时无法读取'))
    })
    const { a } = await twoHosts()
    // 资料失败不影响通知分区；收件写代次也不淘汰偏好读写。
    act(() => {
      captureNotificationWrite()
    })
    expect(checkedIn(a, '个人提醒')).toBe('false')
    put.mockResolvedValue({
      ...stored,
      revision: 4,
      optionalCategories: { announcement: true, personal_update: true },
    })
    await userEvent.click(a.getByRole('switch', { name: '个人提醒' }))
    await waitFor(() => expect(checkedIn(a, '个人提醒')).toBe('true'))
    expect(put).toHaveBeenCalledTimes(1)
    expect(a.queryByRole('alert')).toBeNull()
  })

  it('reads and saves from the real panel under StrictMode without a permanent loading state', async () => {
    respond()
    const view = render(
      <StrictMode>
        <SettingsExperience initialCategory="notifications" />
      </StrictMode>,
    )
    const scope = within(view.container)
    await waitFor(() => expect(scope.getByRole('switch', { name: '社区动态' })).toBeTruthy())
    put.mockResolvedValue({
      ...stored,
      revision: 4,
      optionalCategories: { announcement: false, personal_update: false },
    })
    await userEvent.click(scope.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(checkedIn(scope, '社区动态')).toBe('false'))
    expect(scope.queryByRole('status')).toBeNull()
  })

  it('stays silent on a successful save: no saved text and no temporary notification', async () => {
    respond()
    const { a } = await twoHosts()
    const info = vi.spyOn(ExMessage, 'info')
    const success = vi.spyOn(ExMessage, 'success')
    const loading = vi.spyOn(ExMessage, 'loading')
    const warn = vi.spyOn(ExMessage, 'warn')
    const error = vi.spyOn(ExMessage, 'error')
    put.mockResolvedValue({
      ...stored,
      revision: 4,
      optionalCategories: { announcement: false, personal_update: false },
    })
    await userEvent.click(a.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(checkedIn(a, '社区动态')).toBe('false'))
    // 主证据：无“已保存”文本、无成功状态；ExMessage spy 只作补充。
    expect(a.queryByText(/已保存/)).toBeNull()
    expect(a.queryByRole('status')).toBeNull()
    expect(a.queryByRole('alert')).toBeNull()
    expect(info).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
    expect(loading).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})
