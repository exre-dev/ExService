// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { removeMatchingToken, writeToken } from '@web/src/auth/storage'
import { bindSettingsToken } from '@web/src/settings/settingsConfig'
import { ExAxiosError } from '@workspace/sdk'

const get = vi.hoisted(() => vi.fn())
const invalidateSession = vi.hoisted(() => vi.fn())
vi.mock('@workspace/sdk', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  instance: (config: { method?: string }) => {
    const handlers = { GET: get }
    return handlers[(config.method ?? 'GET') as keyof typeof handlers](config)
  },
}))
vi.mock('@web/src/auth/AuthContext', () => ({
  useAuth: () => ({
    state: { status: 'authenticated' },
    openModal: vi.fn(),
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
    profileStatus,
    profileError,
    onRetry,
  }: {
    profileStatus: string
    profileError: string | null
    onRetry: () => void
  }) => (
    <div>
      {profileStatus === 'error' ? (
        <>
          <p role="alert">{profileError}</p>
          <button onClick={onRetry}>重试读取资料</button>
        </>
      ) : profileStatus === 'ready' ? (
        <p>设置资料</p>
      ) : (
        <p>正在读取个人资料</p>
      )}
    </div>
  ),
}))

import { ProfilePage } from '@web/src/pages/ProfilePage'

beforeEach(() =>
  invalidateSession.mockImplementation((token: string) => {
    removeMatchingToken(window.localStorage, token)
  }),
)

afterEach(() => {
  cleanup()
  get.mockReset()
  invalidateSession.mockReset()
  bindSettingsToken(null)
  window.localStorage.clear()
})

describe('ProfilePage loading errors', () => {
  it('ends loading after a temporary failure and retries successfully', async () => {
    writeToken(window.localStorage, 'old-token')
    get
      .mockRejectedValueOnce(
        new ExAxiosError('http', 'INTERNAL_ERROR', '暂时无法读取', { status: 500 }),
      )
      .mockResolvedValueOnce({
        id: 'user',
        email: 'person@example.com',
        nickname: 'Person',
        qq: null,
        fivemId: null,
        avatarUrl: null,
      })
    render(<ProfilePage />)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '暂时无法读取')
    expect(screen.queryByText('正在读取个人资料')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '重试读取资料' }))
    expect(await screen.findByText('设置资料')).toBeTruthy()
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('reports an invalid session to the shared auth state', async () => {
    writeToken(window.localStorage, 'expired-token')
    get.mockRejectedValue(
      new ExAxiosError('http', 'SESSION_INVALID', '会话已失效', { status: 401 }),
    )
    render(<ProfilePage />)
    await waitFor(() => expect(invalidateSession).toHaveBeenCalledWith('expired-token'))
  })
})
