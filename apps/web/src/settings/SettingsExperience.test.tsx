// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { selectSessionScope, writeToken } from '@web/src/auth/storage'
import { bindNotificationsToken } from '@web/src/notifications/notificationsConfig'
import { bindSettingsToken } from '@web/src/settings/settingsConfig'

const get = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
const invalidateSession = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'unavailable' }))
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get, PUT: put }
    return Promise.resolve(
      handlers[(config.method ?? 'GET') as keyof typeof handlers](config),
    ).then((data) => ({ msg: 'ok', data }))
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
vi.mock('@workspace/components', () => ({
  SettingsPanel: ({
    category,
    onCategoryChange,
    profileStatus,
    notifications,
  }: {
    category: string
    onCategoryChange: (category: 'profile' | 'notifications' | 'general') => void
    profileStatus: string
    notifications: {
      status: string
      failure: unknown
      onSaveField: (
        field: string,
        values: { announcement: boolean; personal_update: boolean },
      ) => Promise<unknown>
    }
  }) => (
    <div>
      <span>
        {category}:{profileStatus}
      </span>
      <span data-testid="notifications-status">{notifications.status}</span>
      <span data-testid="notifications-failure">
        {notifications.failure === null ? 'none' : 'failed'}
      </span>
      <button onClick={() => onCategoryChange('profile')}>个人资料分类</button>
      <button onClick={() => onCategoryChange('notifications')}>通知分类</button>
      <button
        onClick={() =>
          void notifications.onSaveField('announcement', {
            announcement: false,
            personal_update: true,
          })
        }
      >
        保存偏好
      </button>
    </div>
  ),
}))

import { SettingsExperience, SettingsModal } from '@web/src/settings/SettingsExperience'

const user = {
  id: 1,
  platform_role: 'user',
  last_login_time: null,
  email: 'person@example.com',
  username: 'Person',
  qq: null,

  avatar: null,
}
const preferences = {
  revision: 1,
  optionalCategories: { announcement: true, personal_update: true },
  necessaryCategories: ['service_notice'],
  serverTime: 0,
}

beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
)

function respond(overrides: { failPreferences?: boolean; failProfile?: boolean } = {}) {
  get.mockImplementation(({ url: path }: { url: string }) => {
    if (path === '/api/notification-preferences') {
      return overrides.failPreferences
        ? Promise.reject(new Error('通知设置暂时无法读取'))
        : Promise.resolve(preferences)
    }
    return overrides.failProfile
      ? Promise.reject(new Error('资料暂时无法读取'))
      : Promise.resolve(user)
  })
}

afterEach(() => {
  cleanup()
  get.mockReset()
  put.mockReset()
  invalidateSession.mockReset()
  bindSettingsToken(null)
  bindNotificationsToken(null)
  window.localStorage.clear()
  selectSessionScope('/')
  authState.status = 'authenticated'
  vi.unstubAllGlobals()
})

describe('SettingsExperience', () => {
  it.each(['profile', 'notifications'] as const)(
    'reads %s again after a same-token root switch',
    async (category) => {
      selectSessionScope('/scope-a')
      writeToken(window.localStorage, 'same-token')
      respond()
      render(<SettingsExperience initialCategory={category} />)
      await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
      const path = category === 'profile' ? '/api/auth/me' : '/api/notification-preferences'
      window.localStorage.setItem(
        `exwebsite.php.auth.v1:${encodeURIComponent(new URL('/scope-b', window.location.origin).href)}`,
        'same-token',
      )
      act(() => selectSessionScope('/scope-b'))
      await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
      expect(get.mock.calls.map(([config]) => config.url)).toEqual([path, path])
    },
  )

  it('names the settings dialog without the extra top description', () => {
    render(<SettingsModal initialCategory="general" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy()
    expect(screen.queryByText('管理外观、个人资料和账号。')).toBeNull()
  })

  it('reads a data source only when its own category is entered', async () => {
    writeToken(window.localStorage, 'current-token')
    respond()
    const first = render(<SettingsExperience initialCategory="general" />)
    // 初始为 general 时不由设置层触发资料或偏好读取。
    expect(screen.getByText('general:idle')).toBeTruthy()
    expect(get).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    await waitFor(() => expect(screen.getByText('profile:ready')).toBeTruthy())
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith({ url: '/api/auth/me', method: 'GET', alert: false })

    // 同一次设置实例内切回已读过的分区不再重复请求。
    await userEvent.click(screen.getByRole('button', { name: '通知分类' }))
    await waitFor(() =>
      expect(screen.getByTestId('notifications-status').textContent).toBe('ready'),
    )
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenLastCalledWith({
      url: '/api/notification-preferences',
      method: 'GET',
      alert: false,
    })
    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    expect(screen.getByText('profile:ready')).toBeTruthy()
    expect(get).toHaveBeenCalledTimes(2)

    first.unmount()
  })

  it('re-reads a source when the settings are reopened in a new instance', async () => {
    writeToken(window.localStorage, 'current-token')
    respond()
    const first = render(<SettingsExperience initialCategory="general" />)
    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    await waitFor(() => expect(screen.getByText('profile:ready')).toBeTruthy())
    first.unmount()

    // 关闭后重新打开：停在 general 不读任何来源。
    const second = render(<SettingsExperience initialCategory="general" />)
    expect(get).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    second.unmount()
  })

  it('keeps the profile partition usable when the notification read fails', async () => {
    writeToken(window.localStorage, 'current-token')
    respond({ failPreferences: true })
    render(<SettingsExperience initialCategory="general" />)
    await userEvent.click(screen.getByRole('button', { name: '通知分类' }))
    await waitFor(() =>
      expect(screen.getByTestId('notifications-status').textContent).toBe('error'),
    )

    respond()
    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    await waitFor(() => expect(screen.getByText('profile:ready')).toBeTruthy())
    expect(get).toHaveBeenLastCalledWith({ url: '/api/auth/me', method: 'GET', alert: false })
  })

  it('keeps the notifications partition usable when the profile read fails', async () => {
    writeToken(window.localStorage, 'current-token')
    respond({ failProfile: true })
    render(<SettingsExperience initialCategory="general" />)
    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    await waitFor(() => expect(screen.getByText('profile:error')).toBeTruthy())

    respond()
    await userEvent.click(screen.getByRole('button', { name: '通知分类' }))
    await waitFor(() =>
      expect(screen.getByTestId('notifications-status').textContent).toBe('ready'),
    )
  })

  it('sends a preference write only while the notifications category is selected', async () => {
    writeToken(window.localStorage, 'current-token')
    respond()
    put.mockResolvedValue({ ...preferences, revision: 2 })
    render(<SettingsExperience initialCategory="general" />)
    await userEvent.click(screen.getByRole('button', { name: '通知分类' }))
    await waitFor(() =>
      expect(screen.getByTestId('notifications-status').textContent).toBe('ready'),
    )

    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    await waitFor(() => expect(screen.getByText('profile:ready')).toBeTruthy())
    // 分类投影只作为 module 的发送前资格：非通知分类不自动 PUT。
    await userEvent.click(screen.getByRole('button', { name: '保存偏好' }))
    expect(put).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '通知分类' }))
    await userEvent.click(screen.getByRole('button', { name: '保存偏好' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    expect(put).toHaveBeenCalledWith({
      url: '/api/notification-preferences',
      method: 'PUT',
      alert: false,
      data: {
        expectedRevision: 1,
        optionalCategories: { announcement: false, personal_update: true },
      },
    })
    expect(screen.getByTestId('notifications-failure').textContent).toBe('none')
  })

  it('loads the selected profile category when authentication recovers', async () => {
    authState.status = 'unavailable'
    writeToken(window.localStorage, 'current-token')
    respond()
    const view = render(<SettingsExperience initialCategory="general" />)
    await userEvent.click(screen.getByRole('button', { name: '个人资料分类' }))
    expect(get).not.toHaveBeenCalled()
    authState.status = 'authenticated'
    view.rerender(<SettingsExperience initialCategory="general" />)
    await waitFor(() => expect(screen.getByText('profile:ready')).toBeTruthy())
    expect(get).toHaveBeenCalledTimes(1)
  })
})
