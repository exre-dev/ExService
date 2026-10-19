import { afterEach, expect, it } from 'vitest'
import { createApp, serviceHandlers } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

const fixtures: TestAuth[] = []
const apps: Array<ReturnType<typeof createApp>> = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

it('does not expose retired application submission, results, review, or attachment routes', async () => {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const app = createApp({ ...fixture, logger: false })
  apps.push(app)
  const id = '20000000-0000-4000-8000-999999999999'
  const retired = [
    ['POST', '/join/applications', 'submitJoinApplication'],
    ['POST', '/join/applications/query', 'queryJoinApplicationResult'],
    ['GET', '/admin/join/applications', 'listJoinApplications'],
    ['GET', `/admin/join/applications/${id}`, 'getJoinApplication'],
    ['POST', `/admin/join/applications/${id}/approve`, 'approveJoinApplication'],
    ['POST', `/admin/join/applications/${id}/reject`, 'rejectJoinApplication'],
    ['POST', `/admin/join/applications/${id}/invitations`, 'resendJoinInvitation'],
    [
      'GET',
      `/admin/join/applications/${id}/attachments/${id}`,
      'downloadJoinApplicationAttachment',
    ],
  ] as const
  for (const [method, path, operation] of retired) {
    const response = await app.inject({ method, url: `/api${path}` })
    expect(response.statusCode, path).toBe(404)
    expect(Object.hasOwn(serviceHandlers, operation), operation).toBe(false)
  }
})
