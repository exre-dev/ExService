import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { environmentFile, operatingEnvironment, withNodePath } from './settings.mjs'
import { runOwned, signalScope } from './ownership.mjs'
import { reporter, RuntimeError } from './output.mjs'
import { root } from './shared.mjs'

function previewPort(value) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1024 || Number(value) > 65535)
    throw new RuntimeError('PORT_INVALID', { keys: ['--port'] })
  return Number(value)
}

export function frontendArguments(input) {
  const args = input[0] === '--' ? input.slice(1) : input
  const { values } = parseArgs({ args, options: { port: { type: 'string', default: '8090' } } })
  return { port: previewPort(values.port) }
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

export async function main(options = {}, execute = runOwned) {
  const spec = frontendSpecification(options)
  const output = reporter()
  output.title('启动前端预览')
  output.note(`预览地址：http://127.0.0.1:${options.port ?? 8090}/`)
  output.note(`API 地址：${spec.environment.VITE_API_BASE_URL}；Ctrl+C 结束预览`)
  const scope = signalScope()
  try {
    await execute(spec, { onLog: output.log, signal: scope.signal })
  } catch (error) {
    if (!scope.signal.aborted) throw error
  } finally {
    scope.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(frontendArguments(process.argv.slice(2)))
  } catch (error) {
    reporter({ stream: process.stderr, write: (line) => console.error(line) }).failure(
      error instanceof RuntimeError
        ? error
        : new RuntimeError('FRONTEND_START_FAILED', {
            reason: '前端预览启动失败',
            next: '检查前端依赖、启动日志和监听端口；可用 pnpm dev:web --port 8091 更换端口',
          }),
    )
    process.exitCode = 1
  }
}
