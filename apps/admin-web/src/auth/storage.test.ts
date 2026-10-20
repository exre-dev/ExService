// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { loadSession, saveSession, clearSession } from './storage'

const user = {
  id: 1,
  email: 'admin@example.test',
  username: 'Admin',
  avatar: '',
  platform_role: 'admin',
}
beforeEach(() => localStorage.clear())
it('restores the legacy session keys and clears both on logout', () => {
  saveSession('token', user)
  expect(localStorage.getItem('exre_token')).toBe('token')
  expect(loadSession()).toEqual({ token: 'token', user })
  clearSession()
  expect(loadSession()).toEqual({ token: null, user: null })
})
it.each(['{', 'null', '{"id":"invalid"}'])(
  'treats corrupt persisted identity as anonymous: %s',
  (value) => {
    localStorage.setItem('exre_token', 'token')
    localStorage.setItem('exre_user', value)
    expect(loadSession()).toEqual({ token: null, user: null })
  },
)
