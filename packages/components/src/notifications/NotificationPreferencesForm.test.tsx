// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExMessage } from '@exre/exui'
import {
  NotificationPreferencesForm,
  type NotificationPreferencesDraft,
  type NotificationPreferencesFormProps,
  type PreferenceSaveFailure,
} from '@components/src/notifications/NotificationPreferencesForm'

beforeEach(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const initial = { announcement: true, personal_update: true }
function props(
  overrides: Partial<NotificationPreferencesFormProps> = {},
): NotificationPreferencesFormProps {
  return {
    active: true,
    identityEpoch: 1,
    saved: initial,
    status: 'ready',
    saving: false,
    conflict: false,
    failure: null,
    onRetryRead: vi.fn(),
    onSaveField: vi.fn(async (_field: string, values: NotificationPreferencesDraft) => values),
    ...overrides,
  }
}
function deferred() {
  let resolve!: (value: NotificationPreferencesDraft | null) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<NotificationPreferencesDraft | null>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
function failure(overrides: Partial<PreferenceSaveFailure> = {}): PreferenceSaveFailure {
  return {
    id: 1,
    retryValues: { announcement: false, personal_update: true },
    onRetrySave: vi.fn(async (values: NotificationPreferencesDraft) => values),
    ...overrides,
  }
}
const checked = (name: string) => screen.getByRole('switch', { name }).getAttribute('aria-checked')

describe('NotificationPreferencesForm immediate saving', () => {
  it('shows only the two optional switches, without service, necessary group or save/cancel actions', () => {
    render(<NotificationPreferencesForm {...props()} />)
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.queryByText('服务通知')).toBeNull()
    expect(screen.queryByLabelText('必要通知')).toBeNull()
    expect(screen.queryByRole('button', { name: /保存|取消/ })).toBeNull()
    expect(screen.queryByText(/已保存/)).toBeNull()
  })
  it('saves only on a user toggle and hands the field intent with the full validated values', async () => {
    const onSaveField = vi.fn(async () => ({ announcement: true, personal_update: false }))
    render(<NotificationPreferencesForm {...props({ onSaveField })} />)
    expect(onSaveField).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('switch', { name: '社区动态' }))
    expect(onSaveField).toHaveBeenCalledWith('announcement', {
      announcement: false,
      personal_update: true,
    })
    expect(checked('社区动态')).toBe('true')
    expect(checked('个人提醒')).toBe('false')
    expect(screen.queryByText(/已保存/)).toBeNull()
  })
  it('allows a toggle that only the full schema can reject after the field intent was formed', async () => {
    const onSaveField = vi.fn(async () => initial)
    render(<NotificationPreferencesForm {...props({ onSaveField })} />)
    await userEvent.click(screen.getByRole('switch', { name: '个人提醒' }))
    // 整份值一起校验：布尔 schema 下通过，仍然带着字段意图交给 module。
    expect(onSaveField).toHaveBeenCalledWith('personal_update', {
      announcement: true,
      personal_update: false,
    })
  })
  it('locks both switches synchronously for rapid toggles while saving', async () => {
    const pending = deferred(),
      onSaveField = vi.fn(() => pending.promise)
    render(<NotificationPreferencesForm {...props({ onSaveField })} />)
    act(() => {
      fireEvent.click(screen.getByRole('switch', { name: '社区动态' }))
      fireEvent.click(screen.getByRole('switch', { name: '个人提醒' }))
    })
    await waitFor(() => expect(onSaveField).toHaveBeenCalledTimes(1))
    expect(
      screen.getAllByRole('switch').every((element) => (element as HTMLButtonElement).disabled),
    ).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('保存中…')
    await act(async () => {
      pending.resolve({ announcement: false, personal_update: true })
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('rolls back on failure and offers the retry entry produced by the module failure', async () => {
    const onSaveField = vi.fn(async () => initial)
    const input = props({ onSaveField }),
      view = render(<NotificationPreferencesForm {...input} />)
    await userEvent.click(screen.getByRole('switch', { name: '社区动态' }))
    expect(checked('社区动态')).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
    // 失败文案由 module 的 failure 投影驱动，Form 不保存 confirmed 副本或失败字段。
    const onRetrySave = vi.fn(async (values: NotificationPreferencesDraft) => values)
    view.rerender(<NotificationPreferencesForm {...input} failure={failure({ onRetrySave })} />)
    expect(screen.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
    await userEvent.click(screen.getByRole('button', { name: '重试保存' }))
    expect(onRetrySave).toHaveBeenCalledWith({ announcement: false, personal_update: true })
  })
  it('retries through the projected retryValues after the canonical other field moved', async () => {
    const onRetrySave = vi.fn(async (values: NotificationPreferencesDraft) => values)
    const input = props({
      saved: { announcement: true, personal_update: false },
      failure: failure({
        retryValues: { announcement: false, personal_update: false },
        onRetrySave,
      }),
    })
    render(<NotificationPreferencesForm {...input} />)
    expect(checked('个人提醒')).toBe('false')
    await userEvent.click(screen.getByRole('button', { name: '重试保存' }))
    // 整份 retryValues 经同一完整 schema 校验后交给该 failure 自己的 callback。
    expect(onRetrySave).toHaveBeenCalledWith({ announcement: false, personal_update: false })
    expect(checked('个人提醒')).toBe('false')
  })
  it('keeps the root error when an equivalent failure object with the same id re-renders', async () => {
    const input = props({ failure: failure({ id: 5 }) })
    const view = render(<NotificationPreferencesForm {...input} />)
    expect(screen.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
    // 不要求对象或 callback 引用稳定：同 id 的等价对象不能清掉错误。
    view.rerender(<NotificationPreferencesForm {...input} failure={failure({ id: 5 })} />)
    expect(screen.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
    // retryValues 更新同样不清错误、不自动写入。
    view.rerender(
      <NotificationPreferencesForm
        {...input}
        failure={failure({ id: 5, retryValues: { announcement: false, personal_update: false } })}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('re-shows the error for a new failure id and clears it once the failure is gone', async () => {
    const input = props({ failure: failure({ id: 5 }) })
    const view = render(<NotificationPreferencesForm {...input} />)
    view.rerender(<NotificationPreferencesForm {...input} failure={failure({ id: 6 })} />)
    expect(screen.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
    view.rerender(<NotificationPreferencesForm {...input} failure={null} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: '重试保存' })).toBeNull()
  })
  it('keeps the failure error across a canonical value update inside the same identity', async () => {
    const input = props({
      failure: failure({ id: 11, retryValues: { announcement: false, personal_update: true } }),
    })
    const view = render(<NotificationPreferencesForm {...input} />)
    view.rerender(
      <NotificationPreferencesForm
        {...input}
        saved={{ announcement: true, personal_update: false }}
      />,
    )
    expect(checked('个人提醒')).toBe('false')
    expect(screen.getByRole('alert').textContent).toContain('保存失败，已恢复上次设置。请重试。')
  })
  it('follows latest confirmed props and category switches without automatic writes', async () => {
    const input = props(),
      view = render(<NotificationPreferencesForm {...input} />)
    view.rerender(
      <NotificationPreferencesForm
        {...input}
        active={false}
        saved={{ announcement: false, personal_update: false }}
      />,
    )
    view.rerender(
      <NotificationPreferencesForm
        {...input}
        saved={{ announcement: false, personal_update: false }}
      />,
    )
    expect(checked('社区动态')).toBe('false')
    expect(input.onSaveField).not.toHaveBeenCalled()
  })
  it.each(['success', 'failure'] as const)(
    'ignores old account %s and finally while a new account save is pending',
    async (outcome) => {
      const old = deferred(),
        next = deferred()
      const onSaveField = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
      const input = props({ onSaveField }),
        view = render(<NotificationPreferencesForm {...input} />)
      await userEvent.click(screen.getByRole('switch', { name: '社区动态' }))
      view.rerender(
        <NotificationPreferencesForm
          {...input}
          identityEpoch={2}
          saved={{ announcement: true, personal_update: false }}
        />,
      )
      await userEvent.click(screen.getByRole('switch', { name: '个人提醒' }))
      await act(async () => {
        if (outcome === 'success') old.resolve({ announcement: false, personal_update: true })
        else old.reject(new Error('old account secret'))
      })
      expect(screen.getByRole('status').textContent).toBe('保存中…')
      expect(checked('社区动态')).toBe('true')
      expect(screen.queryByRole('alert')).toBeNull()
      await act(async () => {
        next.resolve({ announcement: true, personal_update: true })
      })
      expect(checked('个人提醒')).toBe('true')
    },
  )
  it('drops old completion after unmount', async () => {
    const pending = deferred(),
      input = props({ onSaveField: vi.fn(() => pending.promise) })
    const view = render(<NotificationPreferencesForm {...input} />)
    await userEvent.click(screen.getByRole('switch', { name: '社区动态' }))
    view.unmount()
    await act(async () => {
      pending.resolve({ announcement: false, personal_update: false })
    })
    render(<NotificationPreferencesForm {...props()} />)
    expect(checked('社区动态')).toBe('true')
  })
  it('renders refreshed conflict values and asks for a new adjustment without a blind save retry', () => {
    render(
      <NotificationPreferencesForm
        {...props({ saved: { announcement: false, personal_update: false }, conflict: true })}
      />,
    )
    expect(checked('社区动态')).toBe('false')
    expect(screen.getByText('设置已由其他设备更新，请重新调整。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '重试保存' })).toBeNull()
  })
  it('renders independent loading and read-error retry', async () => {
    const input = props({ status: 'loading', saved: null }),
      view = render(<NotificationPreferencesForm {...input} />)
    expect(screen.getByLabelText('正在加载通知设置')).toBeTruthy()
    view.rerender(<NotificationPreferencesForm {...input} status="error" />)
    await userEvent.click(screen.getByRole('button', { name: '重试通知设置' }))
    expect(input.onRetryRead).toHaveBeenCalledOnce()
  })
  it('stays silent after a successful save: no saved text and no temporary notification', async () => {
    const onSaveField = vi.fn(async () => ({ announcement: false, personal_update: true }))
    const info = vi.spyOn(ExMessage, 'info')
    const success = vi.spyOn(ExMessage, 'success')
    const loading = vi.spyOn(ExMessage, 'loading')
    const warn = vi.spyOn(ExMessage, 'warn')
    render(<NotificationPreferencesForm {...props({ onSaveField })} />)
    await userEvent.click(screen.getByRole('switch', { name: '社区动态' }))
    await waitFor(() => expect(onSaveField).toHaveBeenCalledTimes(1))
    // 主证据：没有“已保存”文本，也没有任何成功状态；ExMessage spy 只作补充。
    expect(screen.queryByText(/已保存/)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(checked('社区动态')).toBe('false')
    expect(info).not.toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
    expect(loading).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
  it('renders nothing while the notifications category is not active', () => {
    const input = props({ active: false })
    render(<NotificationPreferencesForm {...input} />)
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('通知')).toBeNull()
    expect(screen.queryByLabelText('正在加载通知设置')).toBeNull()
  })
})
