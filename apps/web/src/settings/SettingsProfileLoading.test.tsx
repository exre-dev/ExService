// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { writeToken } from '@web/src/auth/storage'
import { bindSettingsToken } from '@web/src/settings/settingsConfig'
import { bindNotificationsToken } from '@web/src/notifications/notificationsConfig'

const get = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get }
    return Promise.resolve(
      handlers[(config.method ?? 'GET') as keyof typeof handlers](config),
    ).then((data) => ({ msg: 'ok', data }))
  },
}))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({
    state: { status: 'authenticated' },
    invalidateSession: vi.fn(),
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
  id: 1,
  platform_role: 'user',
  last_login_time: null,
  email: 'person@example.com',
  username: 'Person',
  qq: '123456789',

  avatar: null,
}
const preferences = {
  revision: 3,
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

afterEach(() => {
  cleanup()
  get.mockReset()
  bindSettingsToken(null)
  bindNotificationsToken(null)
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

it.each([false, true])(
  'shows the returned profile in the real settings panel (StrictMode=%s)',
  async (strict) => {
    writeToken(window.localStorage, 'test-token')
    get.mockResolvedValue(profile)
    const panel = <SettingsExperience initialCategory="profile" />
    render(strict ? <StrictMode>{panel}</StrictMode> : panel)
    expect(get).toHaveBeenCalledWith({ url: '/api/auth/me', method: 'GET', alert: false })
    await waitFor(
      () =>
        expect(screen.queryByRole('button', { name: '编辑用户名' })?.textContent ?? '').toContain(
          'Person',
        ),
      { onTimeout: (error) => error },
    )
    expect(screen.queryByRole('button', { name: /FiveM/ })).toBeNull()
  },
)

it('shows profile fields when the settings modal opens under StrictMode', async () => {
  writeToken(window.localStorage, 'test-token')
  get.mockResolvedValue(profile)
  render(
    <StrictMode>
      <SettingsModal initialCategory="profile" onClose={vi.fn()} />
    </StrictMode>,
  )
  expect(await screen.findByRole('button', { name: '编辑用户名' })).toHaveProperty(
    'textContent',
    'Person',
  )
  expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy()
})

it('keeps the new read when the discarded StrictMode read completes later', async () => {
  writeToken(window.localStorage, 'test-token')
  let resolveOld!: (value: typeof profile) => void
  get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    .mockResolvedValue(profile)
  render(
    <StrictMode>
      <SettingsExperience initialCategory="profile" />
    </StrictMode>,
  )
  expect(await screen.findByRole('button', { name: '编辑用户名' })).toHaveProperty(
    'textContent',
    'Person',
  )
  expect(get).toHaveBeenCalledTimes(2)
  await act(async () => {
    resolveOld({ ...profile, username: 'Outdated' })
  })
  expect(screen.getByRole('button', { name: '编辑用户名' })).toHaveProperty('textContent', 'Person')
})

it('keeps the new notification read when the discarded StrictMode read completes later', async () => {
  writeToken(window.localStorage, 'test-token')
  let resolveOld!: (value: typeof preferences) => void
  let notificationReads = 0
  get.mockImplementation(({ url: path }: { url: string }) => {
    if (path !== '/api/notification-preferences') return Promise.resolve(profile)
    notificationReads += 1
    // 第一次读取被 StrictMode 清理丢弃，只有第二次的结果可以落地。
    return notificationReads === 1
      ? new Promise((resolve) => {
          resolveOld = resolve
        })
      : Promise.resolve(preferences)
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  try {
    render(
      <StrictMode>
        <SettingsExperience initialCategory="notifications" />
      </StrictMode>,
    )
    expect(await screen.findByRole('switch', { name: '社区动态' })).toBeTruthy()
    expect(get).toHaveBeenCalledTimes(2)
    await act(async () => {
      resolveOld({
        ...preferences,
        optionalCategories: { announcement: false, personal_update: false },
      })
    })
    // 迟到读不能回退规范值；资料语义不受这条通知生命周期证据影响。
    expect(screen.getByRole('switch', { name: '社区动态' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(screen.getByRole('switch', { name: '个人提醒' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  } finally {
    vi.unstubAllGlobals()
  }
})
