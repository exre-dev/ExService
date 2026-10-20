// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { createAuthStore } from './store'
import type { Payload } from '@admin/src/api/types'
const user = {
  id: 1,
  email: 'admin@example.test',
  username: 'Admin',
  avatar: null,
  platform_role: 'admin',
}
beforeEach(() => localStorage.clear())
function deferred() {
  let resolve!: (value: Payload<'/api/server/mine'>) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Payload<'/api/server/mine'>>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
it('loads persisted auth and clears server ownership on logout', async () => {
  localStorage.setItem('exre_token', 'old')
  localStorage.setItem('exre_user', JSON.stringify(user))
  const store = createAuthStore(async () => ({ list: [] }))
  expect(store.getState().user).toEqual(user)
  await store.getState().loadServers()
  expect(store.getState().serversLoaded).toBe(true)
  store.getState().logout()
  expect(store.getState()).toMatchObject({
    token: null,
    user: null,
    servers: [],
    serversLoaded: false,
  })
  expect(localStorage.getItem('exre_token')).toBeNull()
})
it.each(['logout', 'switch'] as const)('ignores a delayed server list after %s', async (action) => {
  const task = deferred()
  const store = createAuthStore(() => task.promise)
  store.getState().setAuth('old', user)
  const loading = store.getState().loadServers()
  if (action === 'logout') store.getState().logout()
  else store.getState().setAuth('new', { ...user, id: 2 })
  task.resolve({ list: [{ id: 1, name: 'old', slug: 'old', logo: '', my_role: 'owner' }] })
  await loading
  expect(store.getState()).toMatchObject({
    servers: [],
    serversLoaded: false,
    token: action === 'logout' ? null : 'new',
  })
})
it('does not mark the new account loaded after an old failure', async () => {
  const task = deferred()
  const store = createAuthStore(() => task.promise)
  store.getState().setAuth('old', user)
  const loading = store.getState().loadServers()
  store.getState().setAuth('new', { ...user, id: 2 })
  task.reject(new Error('offline'))
  await loading
  expect(store.getState().serversLoaded).toBe(false)
})
it('does not request a server list while anonymous', async () => {
  const load = vi.fn(async () => ({ list: [] }))
  const store = createAuthStore(load)
  await store.getState().loadServers()
  expect(load).not.toHaveBeenCalled()
})
