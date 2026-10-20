import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { environmentFile, operatingEnvironment, withNodePath, publicSettings } from './settings.mjs'
import { acquireLock } from './ownership.mjs'
import { digest } from './local-config.mjs'
import { supervise, assertPortFree, httpReady } from './local-dev.mjs'
import { prepareSdk } from './sdk-preparation.mjs'
import { watchSdkSources } from './sdk-watch.mjs'
import { readAdminFrontendConfiguration, adminFrontendSpecification } from './admin-frontend.mjs'
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
    options: { port: { type: 'string', default: '8080' }, 'admin-port': { type: 'string' } },
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
  port = 8080,
} = {}) {
  const configured = environmentFile(join(workspace, '.env.local'))
  const node = inherited.INTEGRATION_NODE_BIN ?? configured.INTEGRATION_NODE_BIN ?? process.execPath
  const settings = publicSettings({ ...configured, ...inherited })
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
      ...settings,
      WEBSITE_WEB_PORT: String(previewPort(port)),
    },
  }
}

export async function main(options = {}, dependencies = {}) {
  const workspace = options.workspace ?? root
  const port = options.port ?? 8080
  const spec = frontendSpecification({ ...options, workspace, port })
  const admin = readAdminFrontendConfiguration({ ...options, workspace })
  if (port === admin.port)
    throw new RuntimeError('PORT_CONFLICT', { keys: ['--port', 'LOCAL_ADMIN_WEB_PORT'] })
  const adminSpec = adminFrontendSpecification({ ...options, workspace, configuration: admin })
  const webUrl = `http://127.0.0.1:${port}/`
  const adminUrl = `http://127.0.0.1:${admin.port}/`
  const output = dependencies.output ?? reporter()
  const directory = join(workspace, '.local/runtime/frontend')
  const fingerprint = digest({
    port,
    environment: spec.environment,
    adminPort: admin.port,
    adminEnvironment: adminSpec.environment,
  })
  const lock = (dependencies.acquireLock ?? acquireLock)({
    mode: 'frontend',
    fingerprint,
    directory,
  })
  output.title('启动前端')
  return (dependencies.supervise ?? supervise)({
    mode: 'frontend',
    fingerprint,
    directory,
    lock,
    specifications: [spec, adminSpec],
    signal: options.signal,
    onLog: output.log,
    prepareGeneration: ({ execute, signal }) =>
      (dependencies.prepare ?? prepareSdk)({
        ...options,
        workspace,
        execute,
        signal,
        onLog: output.log,
      }),
    preflight: async () => {
      for (const selected of [port, admin.port])
        await (dependencies.assertPortFree ?? assertPortFree)(selected)
    },
    watchSources: (change, onError) =>
      (dependencies.watchSources ?? watchSdkSources)(workspace, change, { onError }),
    readiness: async (children, { signal }) => {
      for (const url of [webUrl, adminUrl])
        await (dependencies.httpReady ?? httpReady)(url, {
          children,
          signal,
          expected: (response) => response.headers.get('content-type')?.includes('text/html'),
        })
    },
    onReady: () => {
      output.status('Website', '可访问', webUrl, { level: 'success' })
      output.status('管理端', '可访问', adminUrl, { level: 'success' })
    },
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(frontendArguments(process.argv.slice(2)))
  } catch (error) {
    reporter({ stream: process.stderr, write: (line) => console.error(line) }).failure(error)
    process.exitCode = 1
  }
}
