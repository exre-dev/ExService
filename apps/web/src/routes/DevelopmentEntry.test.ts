import assert from 'node:assert/strict'
import { get } from 'node:http'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { createServer } from 'vite'

it('sets the referrer policy before Vite injects its development entry scripts', async () => {
  const server = await createServer({
    configFile: resolve(process.cwd(), 'apps/web/vite.config.ts'),
    root: resolve(process.cwd(), 'apps/web'),
    logLevel: 'silent',
    server: { port: 0 },
  })
  try {
    await server.listen()
    const address = server.httpServer?.address()
    assert.ok(address && typeof address !== 'string')
    const response = await new Promise<{
      status: number | undefined
      policy: string | string[] | undefined
    }>((resolveResponse, reject) => {
      get(
        `http://127.0.0.1:${address.port}/register?email=entry.fixture%40example.com&code=001234`,
        (res) => {
          res.resume()
          res.once('end', () =>
            resolveResponse({ status: res.statusCode, policy: res.headers['referrer-policy'] }),
          )
          res.once('error', reject)
        },
      ).once('error', reject)
    })
    expect(response.status).toBe(200)
    expect(response.policy).toBe('no-referrer')
  } finally {
    await server.close()
  }
}, 10_000)
