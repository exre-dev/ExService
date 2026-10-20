import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { environmentFile, operatingEnvironment, withNodePath } from './settings.mjs'
import { signalScope } from './ownership.mjs'
import { reporter, RuntimeError } from './output.mjs'
import { runFrontendGroup } from './frontend-group.mjs'
import { root } from './shared.mjs'

function adminPort(value, key = 'LOCAL_ADMIN_WEB_PORT') {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1024 || Number(value) > 65535)
    throw new RuntimeError('PORT_INVALID', { service: 'admin-web', keys: [key] })
  return Number(value)
}

export function adminFrontendArguments(input) {
  const args = input[0] === '--' ? input.slice(1) : input
  const { values } = parseArgs({ args, options: { port: { type: 'string' } } })
  return values.port === undefined ? {} : { port: adminPort(values.port, '--port') }
}

/** Reads only public development settings; does not inspect PHP or backend readiness. */
export function readAdminFrontendConfiguration({
  workspace = root,
  inherited = process.env,
  adminPort: explicitPort,
} = {}) {
  const configured = environmentFile(join(workspace, '.env.local'))
  const value =
    inherited.ADMIN_API_PROXY_TARGET !== undefined
      ? inherited.ADMIN_API_PROXY_TARGET
      : configured.ADMIN_API_PROXY_TARGET !== undefined
        ? configured.ADMIN_API_PROXY_TARGET
        : 'http://127.0.0.1:8787'
  let url
  try {
    url = new URL(value)
  } catch {}
  if (
    typeof value !== 'string' ||
    !/^https?:\/\/[^/\s\\?#@]+\/?$/i.test(value) ||
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new RuntimeError('ADMIN_API_PROXY_TARGET_INVALID', {
      service: 'admin-web',
      keys: ['ADMIN_API_PROXY_TARGET'],
      reason: '管理端 API 代理地址无效',
      next: '设置 HTTP(S) origin；不要包含凭据、路径、query 或 hash',
    })
  return {
    port: adminPort(
      explicitPort !== undefined
        ? explicitPort
        : inherited.LOCAL_ADMIN_WEB_PORT !== undefined
          ? inherited.LOCAL_ADMIN_WEB_PORT
          : configured.LOCAL_ADMIN_WEB_PORT !== undefined
            ? configured.LOCAL_ADMIN_WEB_PORT
            : 5173,
    ),
    apiProxyTarget: url.origin,
    node: inherited.INTEGRATION_NODE_BIN ?? configured.INTEGRATION_NODE_BIN ?? process.execPath,
  }
}

export function adminFrontendSpecification({
  workspace = root,
  inherited = process.env,
  configuration = readAdminFrontendConfiguration({ workspace, inherited }),
  node = configuration.node,
} = {}) {
  return {
    name: 'admin-web',
    command: node,
    cwd: join(workspace, 'apps/admin-web'),
    args: [
      join(workspace, 'apps/admin-web/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(configuration.port),
      '--strictPort',
    ],
    environment: {
      ...withNodePath(operatingEnvironment(inherited), node),
      NODE_ENV: 'development',
      ADMIN_API_PROXY_TARGET: configuration.apiProxyTarget,
    },
  }
}

export async function main(options = {}, execute = runFrontendGroup) {
  const configuration = readAdminFrontendConfiguration({ ...options, adminPort: options.port })
  const spec = adminFrontendSpecification({ ...options, configuration })
  const url = `http://127.0.0.1:${configuration.port}/`
  const output = reporter()
  output.title('启动管理端预览')
  const scope = signalScope()
  try {
    await execute([{ ...spec, readinessUrl: url }], {
      signal: options.signal ? AbortSignal.any([scope.signal, options.signal]) : scope.signal,
      onLog: output.log,
      onReady() {
        output.status('管理端', '可访问', url, { level: 'success' })
        output.note('Ctrl+C 结束预览')
      },
    })
  } finally {
    scope.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(adminFrontendArguments(process.argv.slice(2)))
  } catch (error) {
    reporter({ stream: process.stderr, write: (line) => console.error(line) }).failure(error)
    process.exitCode = 1
  }
}
