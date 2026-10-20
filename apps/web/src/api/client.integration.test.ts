// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { setBaseUrl, setSessionExpiredHandler } from '@workspace/sdk'
import { installSdkIntegration } from './client'
import { syncSessionToken } from '../auth/storage'
vi.mock('@workspace/sdk', () => ({ setBaseUrl: vi.fn(), setSessionExpiredHandler: vi.fn() }))
vi.mock('../auth/storage', () => ({
  clearLegacySessionStorage: vi.fn(),
  expirePersistedSession: vi.fn(() => true),
  syncSessionToken: vi.fn(() => null),
  selectSessionScope: vi.fn(),
  sessionScopeRevision: () => 0,
  startSessionSync: () => () => {},
  readToken: () => null,
  subscribeSessionChanges: () => () => {},
}))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it.each([undefined, ''])('selects the SDK default base when Web configuration is %s', (value) => {
  vi.stubEnv('VITE_API_BASE_URL', value)
  const dispose = installSdkIntegration()
  expect(setBaseUrl).toHaveBeenCalledWith(window.location.origin)
  expect(setSessionExpiredHandler).toHaveBeenCalledWith(expect.any(Function))
  dispose()
  expect(setSessionExpiredHandler).toHaveBeenLastCalledWith(null)
})

it('sets an explicit API base only during installation', () => {
  vi.stubEnv('VITE_API_BASE_URL', '/custom-api')
  installSdkIntegration()
  expect(setBaseUrl).toHaveBeenCalledExactlyOnceWith('/custom-api')
})

it.each(['/support', '/support/deep', '/login?ssoRequestId=pending'])(
  'synchronizes expiry without leaving a protected route: %s',
  (url) => {
    const parsed = new URL(url, 'http://localhost')
    const replace = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: parsed.pathname, search: parsed.search, replace },
    })
    installSdkIntegration()
    const handler = vi.mocked(setSessionExpiredHandler).mock.calls.at(-1)![0]!
    handler({} as Parameters<typeof handler>[0])
    expect(syncSessionToken).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
  },
)

it.each([null, 'new-token', undefined])(
  'redirects an ordinary expired route only when current session is known empty: %s',
  (token) => {
    const replace = vi.fn()
    vi.stubGlobal('window', { location: { pathname: '/support-other', search: '', replace } })
    vi.mocked(syncSessionToken).mockReturnValueOnce(token)
    installSdkIntegration()
    const handler = vi.mocked(setSessionExpiredHandler).mock.calls.at(-1)![0]!
    handler({} as Parameters<typeof handler>[0])
    if (token === null) expect(replace).toHaveBeenCalledWith('/login')
    else expect(replace).not.toHaveBeenCalled()
  },
)
