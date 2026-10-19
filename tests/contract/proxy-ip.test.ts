import { afterEach, expect, it } from 'vitest'
import { createApp } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
const apps: Array<ReturnType<typeof createApp>> = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('keeps invitation IP budgets separate behind a trusted loopback proxy over actual HTTP', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const app = createApp({ ...fixture, trustProxy: ['loopback'] })
  apps.push(app)
  const origin = await app.listen({ host: '127.0.0.1', port: 0 })
  const check = (forwarded: string) =>
    fetch(`${origin}/api/auth/invitations/check`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': forwarded,
        connection: 'close',
      },
      body: JSON.stringify({ email: 'missing@example.com' }),
    })

  for (let count = 0; count < 60; count++) {
    const response = await check('203.0.113.10')
    expect(response.status).toBe(404)
    await response.arrayBuffer()
  }
  const limited = await check('203.0.113.10')
  expect(limited.status).toBe(429)
  expect(await limited.json()).toMatchObject({ error: { code: 'JOIN_RATE_LIMITED' } })

  // The nearest untrusted address owns the budget, even if a client prepends a spent IP.
  const other = await check('203.0.113.10, 203.0.113.20')
  expect(other.status).toBe(404)
  expect(await other.json()).toMatchObject({ error: { code: 'INVITATION_APPLICATION_NOT_FOUND' } })
})

it('ignores changing forwarded IPs from a direct non-loopback peer when proxy trust is restricted', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const app = createApp({ ...fixture, trustProxy: ['loopback'] })
  apps.push(app)
  for (let count = 0; count < 61; count++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/invitations/check',
      remoteAddress: '198.51.100.15',
      headers: { 'x-forwarded-for': `203.0.113.${count + 1}` },
      payload: { email: 'missing@example.com' },
    })
    expect(response.statusCode).toBe(count === 60 ? 429 : 404)
  }
})
