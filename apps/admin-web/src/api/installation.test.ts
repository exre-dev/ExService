import { afterEach, expect, it, vi } from 'vitest'
import { getInstallationStatus, install } from './installation'
afterEach(() => vi.unstubAllGlobals())
it('preserves actionable PHP validation messages for installation failures', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ msg: 'PostgreSQL 连接失败，请检查连接信息' }), {
          status: 400,
        }),
    ),
  )
  await expect(getInstallationStatus()).rejects.toThrow('PostgreSQL 连接失败，请检查连接信息')
})
it('checks readiness with unauthenticated no-store fetch', async () => {
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, _options?: RequestInit) =>
      new Response(
        JSON.stringify({ msg: 'ok', data: { installed: false, ready: true, checks: [] } }),
      ),
  )
  vi.stubGlobal('fetch', fetcher)
  expect(await getInstallationStatus()).toEqual({ installed: false, ready: true, checks: [] })
  expect(fetcher).toHaveBeenCalledWith(
    '/api/installation/status',
    expect.objectContaining({ method: 'GET', cache: 'no-store' }),
  )
  const options = fetcher.mock.calls[0]?.[1] as RequestInit | undefined
  expect(new Headers(options?.headers).has('Authorization')).toBe(false)
})
it.each([
  new Response('{', { status: 200 }),
  new Response(JSON.stringify({ data: { installed: 'yes' } })),
  new Response(JSON.stringify({ msg: 'SQL password=secret' }), { status: 500 }),
])('rejects malformed or failed readiness without exposing internals', async (response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response),
  )
  await expect(getInstallationStatus()).rejects.toThrow('初始化请求失败，请检查服务后重试')
})
it('submits installation with setup header and no bearer', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ msg: 'ok', data: [] })))
  vi.stubGlobal('fetch', fetcher)
  const body = {
    force: false,
    database: { host: 'db', port: 5432, database: 'app', username: 'app', password: '' },
    redis: { host: 'redis', port: 6379, database: 0, password: '' },
    admin: {
      email: 'a@example.test',
      username: 'admin',
      password: 'Password123456',
      password_confirmation: 'Password123456',
    },
  }
  await install(body)
  expect(fetcher).toHaveBeenCalledWith(
    '/api/installation/install',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Setup-Request': '1' },
      body: JSON.stringify(body),
    }),
  )
})
