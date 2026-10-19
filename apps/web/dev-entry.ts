import { createServer } from 'node:http'
import type { ClientRequest, IncomingMessage, Server } from 'node:http'
import type { Plugin, ProxyOptions, ViteDevServer } from 'vite'

/** Decode before normalization, including nested encodings and Windows separators. */
export function isInternalPath(raw = ''): boolean {
  let path = raw.split('?')[0] ?? ''
  for (let attempt = 0; attempt < 32; attempt++) {
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      return true
    }
    if (decoded === path) break
    path = decoded
    if (attempt === 31) return true
  }
  path = path.split(/[?#]/)[0] ?? ''
  if (/[\u0000-\u001f\u007f]/.test(path)) return true
  const segments: string[] = []
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return /^(?:api|docs)\/internal(?:\/|$)/i.test(segments.join('/'))
}

/** Keep browser storage and OIDC on one configured development origin. */
export function proxyBoundaryPlugin(publicOrigin?: string): Plugin {
  const canonical = publicOrigin ? new URL(publicOrigin) : undefined
  return {
    name: 'website-proxy-boundary',
    apply: 'serve',
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (isInternalPath(request.url)) {
          response.statusCode = 404
          response.end()
          return
        }
        if (canonical && request.headers.host?.toLowerCase() !== canonical.host.toLowerCase()) {
          // Redirect before a page can create a Bearer session under a different origin.
          // Never replay writes or credentials across origins.
          if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.statusCode = 421
            response.end()
            return
          }
          const path = request.url ?? '/'
          if (!path.startsWith('/')) {
            response.statusCode = 400
            response.end()
            return
          }
          response.writeHead(307, {
            Location: `${canonical.origin}${path}`,
            'Cache-Control': 'no-store',
          })
          response.end()
          return
        }
        next()
      })
      // Each proxy also uses bypass: ending a socket cannot cancel other listeners.
      vite.httpServer?.prependListener('upgrade', (request, socket) => {
        if (!isInternalPath(request.url)) return
        const matched = Object.keys(vite.config.server.proxy ?? {}).some((context) =>
          context.startsWith('^')
            ? new RegExp(context).test(request.url ?? '')
            : request.url?.startsWith(context),
        )
        // The matched proxy's bypass owns its 404. Avoid ending that socket twice.
        if (!matched)
          socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
      })
    },
  }
}

export function guardedProxy(options: ProxyOptions): ProxyOptions {
  return {
    ...options,
    bypass(request) {
      if (isInternalPath(request.url)) return false
      return undefined
    },
  }
}

export function trustedProxy(options: ProxyOptions, publicOrigin: string): ProxyOptions {
  const origin = new URL(publicOrigin)
  return guardedProxy({
    ...options,
    configure(proxy, proxyOptions) {
      options.configure?.(proxy, proxyOptions)
      const headers = (request: ClientRequest, _incoming: IncomingMessage) => {
        request.setHeader('X-Forwarded-Host', origin.host)
        request.setHeader('X-Forwarded-Proto', origin.protocol.slice(0, -1))
        request.setHeader('X-Forwarded-Port', origin.port)
        request.setHeader('X-Forwarded-For', '127.0.0.1')
        request.setHeader('Host', new URL(String(options.target)).host)
        request.removeHeader('Forwarded')
        // Origin is copied by the proxy unchanged for the upstream's CSRF guard.
      }
      proxy.on('proxyReq', headers)
      proxy.on('proxyReqWs', headers)
    },
  })
}

export async function createDevEntryServer(vite: ViteDevServer, port: number): Promise<Server> {
  const entry = createServer((request, response) => {
    if (isInternalPath(request.url)) {
      response.statusCode = 404
      response.end()
      return
    }
    vite.middlewares(request, response)
  })
  entry.on('upgrade', (request, socket, head) => {
    if (isInternalPath(request.url)) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
      return
    }
    vite.httpServer?.emit('upgrade', request, socket, head)
  })
  await new Promise<void>((resolve, reject) => {
    entry.once('error', reject)
    entry.listen(port, '127.0.0.1', () => {
      entry.off('error', reject)
      resolve()
    })
  })
  return entry
}

export function devEntryPlugin(port: number): Plugin {
  return {
    name: 'website-development-entry',
    apply: 'serve',
    configureServer(vite) {
      vite.httpServer?.once('listening', () => {
        void createDevEntryServer(vite, port)
          .then((entry) => {
            vite.httpServer?.once('close', () => {
              entry.close()
              entry.closeAllConnections()
            })
          })
          .catch(() => {
            vite.config.logger.error('WEBSITE_ENTRY_LISTEN_FAILED')
            void vite.close().finally(() => {
              process.exit(1)
            })
          })
      })
    },
  }
}
