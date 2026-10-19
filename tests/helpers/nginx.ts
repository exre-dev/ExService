import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execute = promisify(execFile)
const image = 'nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236'
const workspace = fileURLToPath(new URL('../../', import.meta.url))

/** Disposable HTTPS proxy with public test-only credentials; never reads runtime secrets. */
export async function nginxProxy(upstream: string) {
  const directory = mkdtempSync(join(tmpdir(), 'exwebsite-nginx-test-'))
  let container: string | undefined
  const docker = async (args: string[]) =>
    (await execute('docker', args, { windowsHide: true, timeout: 120_000 })).stdout.trim()
  const close = async () => {
    if (container) {
      await docker(['rm', '-f', container])
      container = undefined
    }
    // mkdtemp returns an immediate child of the named temporary directory.
    if (dirname(directory) !== tmpdir()) throw new Error('Unexpected Nginx fixture directory')
    rmSync(directory, { recursive: true, force: true })
  }
  try {
    for (const file of ['cert.pem', 'key.pem'])
      copyFileSync(new URL(`../fixtures/nginx/${file}`, import.meta.url), join(directory, file))
    const target = new URL(upstream)
    target.hostname = 'host.docker.internal'
    const { nginxConfiguration } = await import(
      new URL('../../scripts/runtime/nginx.mjs', import.meta.url).href
    )
    writeFileSync(
      join(directory, 'nginx.conf'),
      nginxConfiguration({
        workspace,
        profile: 'deployment',
        config: { publicOrigin: 'https://site.example', issuer: 'https://issuer.example/' },
        internal: { website: target.href, outline: target.href },
        values: {
          HYDRA_INTERNAL_PUBLIC_URL: target.href,
          NGINX_SITE_CERT: '/fixture/cert.pem',
          NGINX_SITE_KEY: '/fixture/key.pem',
          NGINX_ISSUER_CERT: '/fixture/cert.pem',
          NGINX_ISSUER_KEY: '/fixture/key.pem',
        },
      }),
    )
    container = await docker([
      'run',
      '--rm',
      '-d',
      '--name',
      `exwebsite-nginx-test-${randomUUID()}`,
      '--add-host',
      'host.docker.internal:host-gateway',
      '-p',
      '127.0.0.1::443',
      '--mount',
      `type=bind,source=${directory},target=/fixture,readonly`,
      image,
      'nginx',
      '-c',
      '/fixture/nginx.conf',
      '-g',
      'daemon off;',
    ])
    if (!/^[a-f0-9]{64}$/.test(container))
      throw new Error('Invalid Nginx fixture container identity')
    const port = Number((await docker(['port', container, '443/tcp'])).split(':').at(-1))
    const request = (
      path: string,
      options: { method?: string; headers?: Record<string, string>; payload?: Buffer } = {},
    ) =>
      new Promise<{ status: number; body: Buffer }>((resolve, reject) => {
        const req = httpsRequest(
          {
            hostname: '127.0.0.1',
            port,
            servername: 'site.example',
            rejectUnauthorized: false,
            method: options.method ?? 'GET',
            path,
            headers: {
              Host: 'site.example',
              ...(options.payload ? { 'Content-Length': String(options.payload.length) } : {}),
              ...options.headers,
            },
          },
          (response) => {
            const chunks: Buffer[] = []
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            response.on('error', reject)
            response.on('end', () =>
              resolve({ status: response.statusCode!, body: Buffer.concat(chunks) }),
            )
          },
        )
        req.setTimeout(30_000, () => req.destroy(new Error('Nginx fixture request timed out')))
        req.on('error', reject)
        req.end(options.payload)
      })
    // The denied internal route proves Nginx is ready without touching the upstream.
    let ready = false
    for (let attempt = 0; attempt < 50 && !ready; attempt++) {
      try {
        ready = (await request('/api/internal/probe')).status === 404
      } catch {
        /* startup race */
      }
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!ready) throw new Error('Nginx fixture did not become ready')
    return { request, close }
  } catch (error) {
    await close()
    throw error
  }
}
