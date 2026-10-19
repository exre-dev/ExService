import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createApp, serviceHandlers } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { createRuntime } from '@sdk/src/runtime'
const fixtures: TestAuth[] = [],
  apps: Array<ReturnType<typeof createApp>> = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
async function setup() {
  const f = await createTestAuth()
  fixtures.push(f)
  const app = createApp({ ...f })
  apps.push(app)
  return { f, app }
}
function reply() {
  const r = { code: () => r, header: () => r }
  return r as unknown as FastifyReply
}
function request(f: TestAuth, body?: unknown, authSession?: FastifyRequest['authSession']) {
  return { body, authSession, server: f } as unknown as FastifyRequest
}
describe('authentication regression after invited registration cutover', () => {
  it.each(['browser', 'node'] as const)(
    'accepts a bodyless logout from the real %s API transport',
    async (environment) => {
      const { f, app } = await setup()
      await f.seedUser({
        email: 'transport@example.com',
        nickname: 'Transport',
        password: 'valid password',
      })
      const { token } = await f.authServices.login({
        email: 'transport@example.com',
        password: 'valid password',
      })
      const origin = await app.listen({ host: '127.0.0.1', port: 0 })
      const sdk = createRuntime({ environment, origin }, async () => {
        throw new Error('COS is not part of this fixture')
      })
      sdk.setBaseUrl(`${origin}/api`)
      sdk.setAccessToken(token)
      await expect(
        sdk.instance({ url: '/auth/logout', method: 'POST', alert: false }),
      ).resolves.toEqual({ status: 'signed-out' })
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(401)
    },
  )
  it('returns the captcha placeholder over HTTP and from its registered handler', async () => {
    const { app } = await setup()
    const response = await app.inject({ method: 'POST', url: '/api/auth/captcha/challenges' })
    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    const raw = await serviceHandlers.createCaptchaChallenge({} as FastifyRequest, reply())
    expect(Object.keys(raw)).toEqual(['challengeId', 'imageBase64', 'expiresAt'])
    expect(raw.challengeId).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(raw.imageBase64, 'base64').subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  })
  it('preserves normalized login, private profile and logout', async () => {
    const { f, app } = await setup()
    await f.seedUser({
      email: 'member@example.com',
      nickname: 'Member',
      password: 'valid password',
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ' MEMBER@EXAMPLE.COM ', password: 'valid password' },
    })
    expect(login.statusCode).toBe(200)
    expect(login.headers['cache-control']).toBe('no-store')
    const { token } = login.json()
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(me.json()).toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      email: 'member@example.com',
      nickname: 'Member',
      qq: null,
      fivemId: null,
      avatarUrl: null,
    })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'member@example.com', password: 'wrong password' },
        })
      ).statusCode,
    ).toBe(401)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/logout',
          headers: { authorization: `Bearer ${token}` },
        })
      ).json(),
    ).toEqual({ status: 'signed-out' })
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/auth/me',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(401)
  })
  it('preserves SSO password login without issuing sessions and session confirmation', async () => {
    const { f, app } = await setup()
    await f.seedUser({
      email: 'member@example.com',
      nickname: 'Member',
      password: 'valid password',
    })
    const sso = await f.authServices.createSsoRequest()
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/sso/inspect',
          payload: { ssoRequestId: sso.ssoRequestId },
        })
      ).json(),
    ).toMatchObject({ status: 'pending' })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/sso/login',
          payload: {
            ssoRequestId: sso.ssoRequestId,
            email: 'member@example.com',
            password: 'valid password',
          },
        })
      ).json(),
    ).toEqual({ status: 'completed', ssoRequestId: sso.ssoRequestId })
    expect(
      (await f.db.query<{ n: number }>('SELECT count(*) n FROM auth_sessions')).rows[0],
    ).toEqual({ n: 0 })
    const login = await f.authServices.login({
        email: 'member@example.com',
        password: 'valid password',
      }),
      next = await f.authServices.createSsoRequest()
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/sso/confirm',
          headers: { authorization: `Bearer ${login.token}` },
          payload: { ssoRequestId: next.ssoRequestId },
        })
      ).json(),
    ).toEqual({ status: 'completed', ssoRequestId: next.ssoRequestId })
  })
  it('validates every retained registered auth handler before serialization', async () => {
    const { f } = await setup()
    await f.seedUser({ email: 'raw@example.com', nickname: 'Raw', password: 'valid password' })
    const r = reply()
    const login = await serviceHandlers.login(
      request(f, { email: 'raw@example.com', password: 'valid password' }),
      r,
    )
    expect(Object.keys(login)).toEqual(['token', 'expiresAt'])
    const identity = await f.authServices.authenticateToken(login.token)
    expect(
      Object.keys(await serviceHandlers.getCurrentUser(request(f, undefined, identity), r)),
    ).toEqual(['id', 'email', 'nickname', 'qq', 'fivemId', 'avatarUrl'])
    const sso = await f.authServices.createSsoRequest()
    expect(
      Object.keys(
        await serviceHandlers.inspectSsoRequest(request(f, { ssoRequestId: sso.ssoRequestId }), r),
      ),
    ).toEqual(['ssoRequestId', 'status', 'expiresAt', 'serverTime'])
    expect(
      await serviceHandlers.confirmSsoWithSession(
        request(f, { ssoRequestId: sso.ssoRequestId }, identity),
        r,
      ),
    ).toEqual({ status: 'completed', ssoRequestId: sso.ssoRequestId })
    const second = await f.authServices.createSsoRequest()
    expect(
      await serviceHandlers.loginForSso(
        request(f, {
          ssoRequestId: second.ssoRequestId,
          email: 'raw@example.com',
          password: 'valid password',
        }),
        r,
      ),
    ).toEqual({ status: 'completed', ssoRequestId: second.ssoRequestId })
    expect(await serviceHandlers.logout(request(f, undefined, identity), r)).toEqual({
      status: 'signed-out',
    })
  })
})
