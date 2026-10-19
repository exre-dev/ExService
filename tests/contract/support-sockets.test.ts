import { request as httpRequest } from 'node:http'
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { supportFixture, requestInput } from '@tests/helpers/support-clickup'
import { sha256 } from '@server/src/domains/support/validation'
const apps: ReturnType<typeof createApp>[] = [],
  fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
async function setup(deadline = 120000) {
  const f = await createTestAuth()
  fixtures.push(f)
  const s = await supportFixture(f),
    session = await f.authServices.login({
      email: 'support@example.com',
      password: 'valid password',
    })
  const app = createApp({ ...f, clickupServices: s.fake.service, supportServices: s.support })
  apps.push(app)
  app.addHook('onRoute', (route) => {
    const limits = (route.config as { supportUpload?: { deadlineMs: number } })?.supportUpload
    if (limits) limits.deadlineMs = deadline
  })
  const entered = vi.fn()
  app.addHook('preValidation', async (request) => {
    if (request.method === 'PUT' && request.url.includes('/support/')) entered()
  })
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  if (!address || typeof address === 'string') throw new Error('No address')
  const id = randomUUID(),
    bytes = Buffer.from('abc'),
    input = {
      ...requestInput(),
      attachments: [
        {
          id,
          originalName: 'a.txt',
          contentType: 'text/plain',
          byteLength: 3,
          sha256: sha256(bytes),
        },
      ],
    }
  const snapshot = (await s.support.prepare(s.userId, input)).snapshot
  return {
    f,
    app,
    ...s,
    port: address.port,
    authorization: `Bearer ${session.token}`,
    path: `/api/support/feedback/submissions/${snapshot.id}/attachments/${id}`,
    snapshot,
    entered,
  }
}
function connect(port: number, path: string, authorization?: string) {
  let req!: ReturnType<typeof httpRequest>
  const result = new Promise<{ status: number; body: string }>((resolve, reject) => {
    req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'PUT',
        agent: false,
        headers: {
          'content-type': 'multipart/form-data; boundary=hold',
          ...(authorization ? { authorization } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }),
        )
        res.on('error', reject)
      },
    )
    req.on('error', reject)
  })
  void result.catch(() => {})
  return { req, result }
}
const prefix =
  '--hold\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\n'
it('auth and owner rejection occur before consuming multipart wire', async () => {
  const { port, path, authorization } = await setup()
  const missing = connect(port, path)
  missing.req.flushHeaders()
  expect((await missing.result).status).toBe(401)
  const other = connect(
    port,
    path.replace(/submissions\/[^/]+/, 'submissions/' + randomUUID()),
    authorization,
  )
  other.req.flushHeaders()
  expect((await other.result).status).toBe(404)
})
it('two stalled receivers exhaust capacity, timeout cleanly, and release both slots', async () => {
  const { port, path, authorization, entered, support, userId, snapshot } = await setup(1000)
  const one = connect(port, path, authorization),
    two = connect(port, path, authorization)
  one.req.write(prefix)
  two.req.write(prefix)
  await vi.waitFor(() => expect(entered).toHaveBeenCalledTimes(2))
  const three = connect(port, path, authorization)
  three.req.flushHeaders()
  const busy = await three.result
  expect(busy.status).toBe(429)
  expect(JSON.parse(busy.body).error.code).toBe('FEEDBACK_BUSY')
  for (const res of await Promise.all([one.result, two.result])) {
    expect(res.status).toBe(408)
    expect(JSON.parse(res.body).error.code).toBe('FEEDBACK_UPLOAD_TIMEOUT')
  }
  const retry = connect(port, path, authorization)
  retry.req.end(prefix + 'abc\r\n--hold--\r\n')
  expect((await retry.result).status).toBe(200)
  expect((await support.get(userId, snapshot.id)).attachments[0]!.status).toBe('received')
})
it('aborted receiver releases capacity without storing partial bytea', async () => {
  const { port, path, authorization, entered, support, userId, snapshot } = await setup()
  const first = connect(port, path, authorization)
  first.req.write(prefix + 'a')
  await vi.waitFor(() => expect(entered).toHaveBeenCalledTimes(1))
  first.req.destroy()
  await first.result.catch(() => {})
  const retry = connect(port, path, authorization)
  retry.req.end(prefix + 'abc\r\n--hold--\r\n')
  expect((await retry.result).status).toBe(200)
  expect((await support.get(userId, snapshot.id)).attachments[0]!.byteLength).toBe(3)
})
