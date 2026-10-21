import { createServer } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { createRuntime } from '@sdk/src/runtime'
import { createConfig, type TokenRead } from '@sdk/src/config'
import { ExAxiosError } from '@sdk/src/http/errors'

const servers: ReturnType<typeof createServer>[] = []
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        }),
    ),
  )
})

it('refreshes directly written persisted credentials on every browser request', async () => {
  const received: string[] = []
  const server = createServer((request, response) => {
    received.push(request.headers.authorization ?? '')
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{}')
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP fixture')
  const origin = `http://127.0.0.1:${address.port}`
  let stored: string | null = 'first'
  const { instance: http } = createRuntime({
    environment: 'browser',
    origin,
    readToken: () => ({ kind: 'known', value: stored }),
  })
  await http({ url: '/api/auth/me' })
  stored = 'second'
  await http({ url: '/api/auth/me' })
  stored = null
  await http({ url: '/api/auth/me' })
  expect(received).toEqual(['Bearer first', 'Bearer second', ''])
})

function browserState(initial: TokenRead = { kind: 'known', value: 'persisted' }) {
  let observed = initial,
    reads = 0,
    clears = 0
  const state = createConfig({
    environment: 'browser',
    origin: 'https://website.test',
    readToken: () => {
      reads++
      return observed
    },
    clearToken: (expected) => {
      clears++
      if (observed.kind !== 'known' || observed.value !== expected) return false
      observed = { kind: 'known', value: null }
      return true
    },
  })
  return {
    state,
    write: (value: TokenRead) => {
      observed = value
    },
    counts: () => ({ reads, clears }),
  }
}
const expired = new ExAxiosError('http', 'HTTP_ERROR', 'expired', { status: 401 })

it('validates setters atomically without reading credentials for illegal input', () => {
  const { state, counts } = browserState()
  const before = counts()
  for (const value of ['', 'bad\r\ntoken', 1, undefined])
    expect(() => state.setAccessToken(value as never)).toThrow(ExAxiosError)
  for (const url of [
    'ftp://site.test/api',
    'https://u:p@site.test/api',
    '/api?x=1',
    '/a/../api',
    '/%2e%2e/api',
    '/api%2fother',
    '/api\\other',
  ])
    expect(() => state.setBaseUrl(url)).toThrow(ExAxiosError)
  expect(() => state.setSessionExpiredHandler(1 as never)).toThrow(ExAxiosError)
  expect(counts()).toEqual(before)
  expect(state.resolve()).toMatchObject({ baseUrl: 'https://website.test', token: 'persisted' })
})

it('preserves revisions for equal effective tokens, including automatic to explicit source changes', () => {
  const { state } = browserState()
  const before = state.resolve()
  state.setAccessToken('persisted')
  state.setBaseUrl('https://website.test/')
  expect(state.resolve()).toEqual({ ...before, source: 'explicit' })
  state.setAccessToken('persisted')
  expect(state.matches(before)).toBe(true)
})

it('keeps explicit null while storage is unavailable and establishes an unknown baseline once', () => {
  const { state, write } = browserState({ kind: 'unavailable' })
  state.setAccessToken(null)
  write({ kind: 'known', value: 'old-persisted' })
  expect(state.resolve()).toMatchObject({ token: null, source: 'explicit' })
  write({ kind: 'unavailable' })
  expect(state.resolve().token).toBeNull()
  write({ kind: 'known', value: 'new-persisted' })
  expect(state.resolve()).toMatchObject({ token: 'new-persisted', source: 'automatic' })
})

it('does not confuse unavailable storage with observed null or retain automatic credentials', () => {
  const { state, write } = browserState()
  expect(state.resolve().token).toBe('persisted')
  write({ kind: 'unavailable' })
  expect(state.resolve()).toMatchObject({ token: null, source: 'unavailable' })
  state.setAccessToken('manual')
  expect(state.resolve().token).toBe('manual')
  write({ kind: 'known', value: 'persisted' })
  expect(state.resolve().token).toBe('manual')
  write({ kind: 'known', value: null })
  expect(state.resolve()).toMatchObject({ token: null, source: 'automatic' })
})

it('does not borrow persisted credentials on another API root and resets credentials when targets change', () => {
  const { state, counts } = browserState()
  state.setBaseUrl('/other-api')
  expect(state.resolve().token).toBeNull()
  const before = counts()
  state.setAccessToken('other-token')
  state.resolve()
  expect(counts()).toEqual(before)
  state.setBaseUrl('/')
  expect(state.resolve().token).toBe('persisted')
  state.setBaseUrl('https://remote.test/api')
  expect(state.resolve().token).toBeNull()
})

it('only invalidates an explicit override, leaves another persisted credential intact and locks anonymous repetitions', () => {
  const { state, counts } = browserState()
  let calls = 0
  state.setSessionExpiredHandler(() => {
    calls++
    return Promise.reject(new Error('handler failed'))
  })
  state.setAccessToken('manual')
  state.expire(state.resolve(), expired, false)
  expect(state.resolve()).toMatchObject({ token: null, source: 'explicit' })
  state.expire(state.resolve(), expired, false)
  expect(calls).toBe(1)
  expect(counts().clears).toBe(0)
  state.setAccessToken('new')
  state.expire(state.resolve(), expired, false)
  expect(calls).toBe(2)
})

it('resolves the latest source before invalidation without changing revision for the same token', () => {
  const { state, counts } = browserState()
  let calls = 0
  state.setSessionExpiredHandler(() => {
    calls++
  })
  const automatic = state.resolve()
  state.setAccessToken('persisted')
  state.expire(automatic, expired, false)
  expect(calls).toBe(1)
  expect(counts().clears).toBe(0)
})

it('suppresses cleanup and callbacks if persistent removal cannot be proven', () => {
  for (const after of [{ kind: 'unavailable' }, { kind: 'known', value: 'new-token' }] as const) {
    let current: TokenRead = { kind: 'known', value: 'old-token' },
      handled = 0
    const state = createConfig({
      environment: 'browser',
      origin: 'https://website.test',
      readToken: () => current,
      clearToken: () => {
        current = after
        return true
      },
      navigate: () => {
        handled++
      },
    })
    state.expire(state.resolve(), expired, true)
    expect(handled).toBe(0)
    expect(state.resolve().token).toBe(after.kind === 'known' ? after.value : null)
  }
})
