import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, it } from 'vitest'
import { createServer } from 'vite'
import { createDevEntryServer, guardedProxy, proxyBoundaryPlugin } from '../../apps/web/dev-entry'

const close: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const cleanup of close.splice(0).reverse()) await cleanup()
})

it('serves Docs paths through Website fallback and proxies only Website API on both entries', async () => {
  const upstream = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ path: req.url }))
  })
  upstream.on('upgrade', (req, socket) => {
    socket.end(
      `HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nX-Upstream-Path: ${req.url}\r\n\r\n`,
    )
  })
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  close.push(() => new Promise((resolve) => upstream.close(() => resolve())))
  const target = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: { '/api': guardedProxy({ target, ws: true }) },
    },
    plugins: [
      proxyBoundaryPlugin(),
      {
        name: 'website-fixture',
        configureServer(server) {
          return () => {
            server.middlewares.use((req, res) => {
              res.end('<main>Website home</main>')
            })
          }
        },
      },
    ],
  })
  await vite.listen()
  close.push(() => vite.close())
  const entry = await createDevEntryServer(vite, 0)
  close.push(
    () =>
      new Promise((resolve) => {
        entry.closeAllConnections()
        entry.close(() => resolve())
      }),
  )
  for (const port of [
    (entry.address() as AddressInfo).port,
    (vite.httpServer!.address() as AddressInfo).port,
  ]) {
    const origin = `http://127.0.0.1:${port}`
    expect(await (await fetch(`${origin}/`)).text()).toContain('Website home')
    expect(await (await fetch(`${origin}/api/health`)).json()).toEqual({ path: '/api/health' })
    for (const path of [
      '/docs',
      '/docs/',
      '/docs/doc/old',
      '/docs/api/documents.info?x=1',
      '/docs/static/old.js',
    ]) {
      const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('Website home')
    }
    const upgradedPath = await new Promise<string | undefined>((resolve, reject) => {
      const request = httpRequest(`${origin}/api/socket?x=1`, {
        headers: { Connection: 'Upgrade', Upgrade: 'websocket' },
      })
      request.once('upgrade', (response, socket) => {
        socket.destroy()
        resolve(response.headers['x-upstream-path'] as string | undefined)
      })
      request.once('response', (response) => {
        response.resume()
        reject(new Error(`Unexpected HTTP ${response.statusCode}`))
      })
      request.once('error', reject)
      request.setTimeout(5000, () => request.destroy(new Error('WebSocket upgrade timed out')))
      request.end()
    })
    expect(upgradedPath).toBe('/api/socket?x=1')
    expect(await (await fetch(`${origin}/docs-other`)).text()).toContain('Website home')
  }
})
