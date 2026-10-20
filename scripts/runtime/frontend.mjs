import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { environmentFile, operatingEnvironment, withNodePath } from './settings.mjs'
import { signalScope } from './ownership.mjs'
import { readAdminFrontendConfiguration, adminFrontendSpecification } from './admin-frontend.mjs'
import { runFrontendGroup } from './frontend-group.mjs'
import { reporter, RuntimeError } from './output.mjs'
import { root } from './shared.mjs'

function previewPort(value, key = '--port') {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1024 || Number(value) > 65535)
    throw new RuntimeError('PORT_INVALID', { keys: [key] })
  return Number(value)
}

export function frontendArguments(input) {
  const args = input[0] === '--' ? input.slice(1) : input
  const { values } = parseArgs({
    args,
    options: { port: { type: 'string', default: '8090' }, 'admin-port': { type: 'string' } },
  })
  return {
    port: previewPort(values.port),
    ...(values['admin-port'] === undefined
      ? {}
      : { adminPort: previewPort(values['admin-port'], '--admin-port') }),
  }
}

/** Frontend-only preview reads public settings without requiring backend readiness. */
export function frontendSpecification({
  workspace = root,
  inherited = process.env,
  port = 8090,
} = {}) {
  const configured = environmentFile(join(workspace, '.env.local'))
  const node = inherited.INTEGRATION_NODE_BIN ?? configured.INTEGRATION_NODE_BIN ?? process.execPath
  const baseUrl = (inherited.VITE_API_BASE_URL ?? configured.VITE_API_BASE_URL) || '/api'
  if (baseUrl !== '/api') {
    let url
    try {
      url = new URL(baseUrl)
    } catch {}
    if (
      !url ||
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new RuntimeError('FRONTEND_API_BASE_URL_INVALID', {
        keys: ['VITE_API_BASE_URL'],
        reason: '前端 API 地址无效',
        next: '设置为 /api 或包含 API 路径的完整 HTTP(S) 地址；不要包含凭据、query 或 hash',
      })
  }
  return {
    name: 'Web',
    command: node,
    cwd: join(workspace, 'apps/web'),
    args: [
      join(workspace, 'apps/web/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(previewPort(port)),
      '--strictPort',
    ],
    environment: {
      ...withNodePath(operatingEnvironment(inherited), node),
      NODE_ENV: 'development',
      VITE_API_BASE_URL: baseUrl,
      INTEGRATION_SERVER_PORT: String(
        previewPort(inherited.LOCAL_API_PORT ?? configured.LOCAL_API_PORT ?? 8082),
      ),
    },
  }
}

export async function main(options = {}, execute = runFrontendGroup) {
  const spec = frontendSpecification(options)
  const admin = readAdminFrontendConfiguration(options)
  const adminSpec = adminFrontendSpecification({ ...options, configuration: admin })
  const webUrl = `http://127.0.0.1:${options.port ?? 8090}/`
  const adminUrl = `http://127.0.0.1:${admin.port}/`
  const output = reporter()
  output.title('启动前端预览')
  const scope = signalScope()
  try {
    await execute(
      [
        { ...spec, readinessUrl: webUrl },
        { ...adminSpec, readinessUrl: adminUrl },
      ],
      {
        onLog: output.log,
        signal: options.signal ? AbortSignal.any([scope.signal, options.signal]) : scope.signal,
        onReady() {
          output.status('Website', '可访问', webUrl, { level: 'success' })
          output.status('管理端', '可访问', adminUrl, { level: 'success' })
          output.note(`Website API 地址：${spec.environment.VITE_API_BASE_URL}；Ctrl+C 结束预览`)
        },
      },
    )
  } finally {
    scope.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(frontendArguments(process.argv.slice(2)))
  } catch (error) {
    reporter({ stream: process.stderr, write: (line) => console.error(line) }).failure(error)
    process.exitCode = 1
  }
}
