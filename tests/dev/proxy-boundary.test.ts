import { createServer as httpServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, it } from 'vitest'
import { createServer, loadConfigFromFile } from 'vite'
import {
  createDevEntryServer,
  isInternalPath,
  proxyBoundaryPlugin,
  trustedProxy,
} from '../../apps/web/dev-entry'

const cleanup: (() => Promise<void>)[] = []
it('uses PHP proxy origin and exact OAuth HTML paths on the public frontend port', async () => {
  const keys = ['PHP_SERVER_ORIGIN', 'WEBSITE_WEB_PORT']
  const prior = keys.map((key) => process.env[key])
  try {
    process.env.PHP_SERVER_ORIGIN = 'http://127.0.0.1:18787'
    process.env.WEBSITE_WEB_PORT = '18080'
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      'apps/web/vite.config.ts',
    )
    const server = loaded!.config.server!
    expect(server.host).toBe('127.0.0.1')
    expect(server.port).toBe(18080)
    expect(server.strictPort).toBe(true)
    expect(server.headers).toMatchObject({ 'Referrer-Policy': 'no-referrer' })
    const proxies = server.proxy!
    for (const path of [
      '/api/account/me',
      '/oauth/authorize?request=1',
      '/oauth/device?user_code=x',
    ]) {
      const entry = Object.entries(proxies).find(([context]) =>
        context.startsWith('^') ? new RegExp(context).test(path) : path.startsWith(context),
      )
      expect(entry?.[1]).toMatchObject({ target: 'http://127.0.0.1:18787' })
    }
    for (const path of [
      '/oauth/device/extra',
      '/oauth/authorize-extra',
      '/oauth/other',
      '/apiculture',
      '/login',
      '/register',
      '/sso/success',
    ])
      expect(
        Object.keys(proxies).some((context) =>
          context.startsWith('^') ? new RegExp(context).test(path) : path.startsWith(context),
        ),
      ).toBe(false)
  } finally {
    keys.forEach((key, i) =>
      prior[i] === undefined ? delete process.env[key] : (process.env[key] = prior[i]),
    )
  }
})
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close()
})
it('keeps Website login and OIDC on the configured origin before serving either entry', async () => {
  const publicOrigin = 'http://127.0.0.1:8080'
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
      allowedHosts: true,
    },
    plugins: [
      proxyBoundaryPlugin(publicOrigin),
      {
        name: 'website-fixture',
        configureServer(server) {
          return () => {
            server.middlewares.use((_req, res) => {
              res.end('Website home')
            })
          }
        },
      },
    ],
  })
  await vite.listen()
  cleanup.push(() => vite.close())
  const entry = await createDevEntryServer(vite, 0)
  cleanup.push(
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
    for (const host of ['localhost:8080', '127.0.0.1:8081']) {
      for (const path of [
        '/',
        '/login',
        '/docs/?q=hello%20world',
        '/identity/login',
        '/docs?x=1',
        '//outside.test/path',
      ]) {
        const response = await raw(port, path, false, { Host: host })
        expect(response, `${host}${path}`).toMatchObject({
          status: 307,
          headers: { location: `${publicOrigin}${path}` },
        })
        expect(response.body).not.toContain('Website home')
      }
      expect((await raw(port, '/api/auth/login', false, { Host: host }, 'POST')).status).toBe(421)
      expect((await raw(port, '/docs/internal/revoke', false, { Host: host })).status).toBe(404)
    }
    const canonical = await raw(port, '/', false, { Host: '127.0.0.1:8080' })
    expect(canonical).toMatchObject({ status: 200, body: 'Website home' })
    expect(await raw(port, '/docs?x=1', false, { Host: '127.0.0.1:8080' })).toMatchObject({
      status: 200,
      body: 'Website home',
    })
  }
})
function raw(
  port: number,
  path: string,
  upgrade = false,
  headers: Record<string, string> = {},
  method = 'GET',
) {
  return new Promise<{ status: number; headers: Record<string, unknown>; body: string }>(
    (resolve, reject) => {
      const req = request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...headers,
          ...(upgrade ? { Connection: 'Upgrade', Upgrade: 'websocket' } : {}),
        },
      })
      req.on('response', (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (value) => {
          body += value
        })
        response.once('end', () =>
          resolve({ status: response.statusCode!, headers: response.headers, body }),
        )
      })
      req.once('upgrade', (response, socket) => {
        socket.destroy()
        resolve({ status: response.statusCode!, headers: response.headers, body: '' })
      })
      req.once('error', reject)
      req.setTimeout(5000, () => req.destroy(new Error('Fixture request timeout')))
      req.end()
    },
  )
}
it('blocks internal HTTP and WS bypasses on both entries before any upstream call and preserves CSRF Origin', async () => {
  const upstreamCalls: string[] = [],
    publicOrigin = 'http://127.0.0.1:8080'
  const upstream = httpServer((req, res) => {
    upstreamCalls.push(req.url!)
    if (req.method === 'POST' && req.headers.origin !== publicOrigin) {
      res.writeHead(403)
      res.end('CSRF_ORIGIN_REJECTED')
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        path: req.url,
        origin: req.headers.origin,
        forwardedHost: req.headers['x-forwarded-host'],
        forwardedProto: req.headers['x-forwarded-proto'],
        forwardedFor: req.headers['x-forwarded-for'],
        forwarded: req.headers.forwarded,
      }),
    )
  })
  upstream.on('upgrade', (req, socket) => {
    upstreamCalls.push(req.url!)
    socket.end(
      `HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nX-Upstream-Path: ${req.url}\r\nX-Forwarded-Host: ${req.headers['x-forwarded-host']}\r\n\r\n`,
    )
  })
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  cleanup.push(
    () =>
      new Promise((resolve) => {
        upstream.closeAllConnections()
        upstream.close(() => resolve())
      }),
  )
  const target = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`
  const vite = await createServer({
    configFile: false,
    logLevel: 'silent',
    server: {
      host: '127.0.0.1',
      port: 0,
      allowedHosts: true,
      proxy: { '/api': trustedProxy({ target, ws: true }, publicOrigin) },
    },
    plugins: [proxyBoundaryPlugin()],
  })
  await vite.listen()
  cleanup.push(() => vite.close())
  const entry = await createDevEntryServer(vite, 0)
  cleanup.push(
    () =>
      new Promise((resolve) => {
        entry.closeAllConnections()
        entry.close(() => resolve())
      }),
  )
  const forbidden = [
    '/api/internal',
    '/api/internal/',
    '/api/internal?x=1',
    '/docs/internal/revoke',
    '/docs/internal?x=1',
    '/api/%69nternal/revoke',
    '/docs/%2569nternal/revoke',
    '/api/internal%2frevoke',
    '/docs/internal%255Crevoke',
    '/docs/static/../internal/revoke',
    '/docs/static/%252e%252e/internal/revoke',
    '/foo/../api/internal',
    '//docs//internal//revoke',
    '/docs\\internal\\revoke',
    '/%64ocs/internal',
    '/docs/internal%25252frevoke',
    '/docs/../api/internal',
    '/docs/internal%3frevoke',
    '/docs/%2e/internal',
    '/docs/%zz/internal',
  ]
  for (const port of [
    (entry.address() as AddressInfo).port,
    (vite.httpServer!.address() as AddressInfo).port,
  ]) {
    for (const path of forbidden)
      for (const upgrade of [false, true]) {
        const before = upstreamCalls.length
        const response = await raw(port, path, upgrade)
        expect(response.status, `${path} upgrade=${upgrade}`).toBe(404)
        expect(upstreamCalls.length).toBe(before)
      }
    const trusted = await raw(port, '/api/health', false, {
      Host: 'attacker.test',
      'X-Forwarded-Host': 'attacker.test',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-For': '203.0.113.9',
      Forwarded: 'for=203.0.113.9',
      Origin: publicOrigin,
    })
    expect(JSON.parse(trusted.body).forwarded).toBeUndefined()
    expect(JSON.parse(trusted.body)).toMatchObject({
      path: '/api/health',
      origin: publicOrigin,
      forwardedHost: '127.0.0.1:8080',
      forwardedProto: 'http',
      forwardedFor: '127.0.0.1',
    })
    expect(
      (await raw(port, '/api/auth/login', false, { Origin: 'http://attacker.test' }, 'POST'))
        .status,
    ).toBe(403)
    expect((await raw(port, '/api/auth/login', false, {}, 'POST')).status).toBe(403)
    expect(
      (await raw(port, '/api/auth/login', false, { Origin: publicOrigin }, 'POST')).status,
    ).toBe(200)
    const upgrade = await raw(port, '/api/socket?x=1', true, {
      'X-Forwarded-Host': 'attacker.test',
    })
    expect(upgrade).toMatchObject({
      status: 101,
      headers: { 'x-upstream-path': '/api/socket?x=1', 'x-forwarded-host': '127.0.0.1:8080' },
    })
  }
})
it('normalizes deep repeated encodings, slash/backslash and dot-segment internal paths', () => {
  expect(isInternalPath('/docs/%2525252569nternal/revoke')).toBe(true)
  expect(isInternalPath('/docs/static/file.js')).toBe(false)
  expect(isInternalPath('/api/internal-other')).toBe(false)
})
