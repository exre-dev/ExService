import { afterEach, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { resolveConfig } from 'vite'
import config from '../../vite.config'
afterEach(() => vi.unstubAllEnvs())
async function resolve(command: 'build' | 'serve') {
  if (typeof config !== 'function') throw new Error('Expected config factory')
  return config({
    command,
    mode: command === 'build' ? 'production' : 'development',
    isSsrBuild: false,
    isPreview: false,
  })
}
it.each([
  'http:example.com',
  'http://host/path/..',
  'http://user:secret@host',
  'http://@host',
  'http://host/path',
  'http://host?x=1',
  'ftp://host',
  ' http://host',
  '',
])('rejects non-origin dev targets without leaking their value', async (value) => {
  vi.stubEnv('ADMIN_API_PROXY_TARGET', value)
  await expect(resolve('serve')).rejects.toThrow('ADMIN_API_PROXY_TARGET must be an HTTP(S) origin')
})
it('does not consume an invalid inherited dev target when building', async () => {
  vi.stubEnv('ADMIN_API_PROXY_TARGET', 'secret://invalid')
  expect(await resolve('build')).toHaveProperty('envDir', false)
})
it.each(['serve', 'build'] as const)(
  'does not expose inherited VITE variables through the %s configuration',
  async (command) => {
    vi.stubEnv('ADMIN_API_PROXY_TARGET', 'http://127.0.0.1:8787')
    vi.stubEnv('VITE_UNSUPPORTED_SECRET', 'private-test-value')
    vi.stubEnv('VITE_API_BASE_URL', 'https://website.example.test/api')
    const resolved = await resolveConfig(
      {
        ...(await resolve(command)),
        configFile: false,
        root: fileURLToPath(new URL('../../', import.meta.url)),
      },
      command,
    )
    expect(resolved.env).not.toHaveProperty('VITE_UNSUPPORTED_SECRET')
    expect(resolved.env).not.toHaveProperty('VITE_API_BASE_URL')
    expect(resolved.env).toHaveProperty('BASE_URL', '/')
  },
)
it('uses the explicit admin origin and loopback strict port only', async () => {
  vi.stubEnv('ADMIN_API_PROXY_TARGET', 'https://php.example.test/')
  vi.stubEnv('VITE_API_BASE_URL', 'https://website.example.test/api')
  const resolved = await resolve('serve')
  expect(resolved.server).toMatchObject({
    host: '127.0.0.1',
    strictPort: true,
    proxy: { '/api': { target: 'https://php.example.test', changeOrigin: false } },
  })
  expect(resolved.envDir).toBe(false)
})
