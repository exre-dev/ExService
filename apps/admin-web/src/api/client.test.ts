// @vitest-environment jsdom
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, expect, it, vi } from 'vitest'
import { createAdminClient } from './client'

const navigate = vi.fn()
const success = vi.fn()
const error = vi.fn()
const expired = vi.fn()
beforeEach(() => vi.clearAllMocks())
function client(status = 200, body: unknown = { msg: 'ok', data: { id: 1 } }, headers = {}) {
  return createAdminClient({
    readToken: () => 'secret',
    expireSession: expired,
    navigate,
    pathname: () => '/users',
    success,
    error,
    adapter: async (config) => {
      expect(config.baseURL).toBe('/api')
      expect(config.timeout).toBe(15000)
      expect(config.headers.Authorization).toBe('Bearer secret')
      const response = {
        data: body,
        status,
        statusText: '',
        headers: new AxiosHeaders(headers),
        config,
      }
      if (status >= 400) throw new AxiosError('failed', undefined, config, undefined, response)
      return response
    },
  })
}
it('returns the payload instead of an AxiosResponse and announces semantic success', async () => {
  expect(
    await client(200, { msg: '已保存', data: { id: 1 } }).get<{ id: number }>('/admin/users'),
  ).toEqual({ id: 1 })
  expect(success).toHaveBeenCalledWith('已保存')
})
it('leaves non-envelope responses intact', async () => {
  expect(await client(200, ['raw']).get<string[]>('/admin/users')).toEqual(['raw'])
  expect(success).not.toHaveBeenCalled()
})
it('sends setup-required responses to installation without expiring the session', async () => {
  await expect(
    client(503, { msg: 'setup' }, { 'x-setup-required': '1' }).get('/admin/users'),
  ).rejects.toThrow()
  expect(navigate).toHaveBeenCalledWith('/install')
  expect(expired).not.toHaveBeenCalled()
})
it.each([
  [401, 'unauthorized'],
  [400, 'token 已失效'],
])('expires login on %s', async (status, msg) => {
  await expect(client(status, { msg }).get('/admin/users')).rejects.toThrow()
  expect(expired).toHaveBeenCalledWith('secret')
  expect(navigate).toHaveBeenCalledWith('/login')
})
it('shows a fixed message for internal server errors', async () => {
  await expect(
    client(500, { msg: 'password=internal-secret' }).get('/admin/users'),
  ).rejects.toThrow()
  expect(error).toHaveBeenCalledWith('请求失败，请稍后重试')
})
