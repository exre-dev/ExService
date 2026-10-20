import { join } from 'node:path'
import { appendFileSync } from 'node:fs'
import { runOwned } from './ownership.mjs'
import { acquireApplicationLock } from './application-lock.mjs'
import { toolchain } from './local-config.mjs'
import {
  httpReady,
  assertPortFree,
  supervise,
  specifications,
  verifyFoundationSchemas,
} from './local-dev.mjs'
import { verifyHydraClient, HydraClientCheckError } from './hydra-client.mjs'
import { withNodePath } from './settings.mjs'
import { reporter, RuntimeError, diagnostic } from './output.mjs'
import { prepareSdk } from './sdk-preparation.mjs'
import { watchSdkSources } from './sdk-watch.mjs'
import { readAdminFrontendConfiguration } from './admin-frontend.mjs'

export const hydraOptions = (state, client) => ({
  mode: state.profile,
  adminUrl: state.internal.hydra,
  publicUrl: state.config.issuer,
  client,
})

const hydraCheckCodes = Object.freeze({
  CLIENT_MISSING: 'HYDRA_CLIENT_MISSING',
  CLIENT_CONFLICT: 'HYDRA_CLIENT_CONFLICT',
  CREDENTIAL_PROBE_FAILED: 'HYDRA_CLIENT_CONFLICT',
  INVALID_CONFIG: 'HYDRA_CONFIG_INVALID',
  CHECK_FAILED: 'HYDRA_CLIENT_CHECK_FAILED',
})
const networkCodes = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET'])

function safeNetworkCode(error) {
  for (const code of [error?.code, error?.cause?.code, error?.errors?.[0]?.code]) {
    if (networkCodes.has(code)) return code
  }
}

export function cliSpecification(state, tools, service, action, args = []) {
  if (service !== 'server') throw new RuntimeError('APPLICATION_SERVICE_INVALID')
  return {
    name: service,
    command: tools.node,
    cwd: state.workspace,
    args: [join(state.workspace, 'scripts/runtime/server.mjs'), action, ...args],
    environment: withNodePath(state.environments.server, tools.node),
  }
}

/** Keep Hydra client/configuration failures distinct from network errors without returning raw messages. */
export async function verifyRuntimeHydraClient(
  state,
  verifyClient = verifyHydraClient,
  { ready = httpReady, timeout = 30000, signal } = {},
) {
  try {
    // Protocol readiness is required even when no application has been registered.
    await ready(new URL('/health/ready', state.internal.hydra), { timeout, signal })
    await ready(new URL('/.well-known/openid-configuration', state.config.issuer), {
      timeout,
      signal,
      expected: async (response) => (await response.json()).issuer === state.config.issuer,
    })
    return await Promise.all(
      Object.values(state.clients).map((client) => verifyClient(hydraOptions(state, client))),
    )
  } catch (error) {
    if (error instanceof RuntimeError) throw error
    const context = {
      service: 'Hydra',
      phase: 'OIDC client 检查',
      keys: ['HYDRA_ADMIN_URL', 'HYDRA_PUBLIC_URL', 'IDENTITY_CLIENTS_JSON'],
    }
    if (error instanceof HydraClientCheckError) {
      if (Object.hasOwn(hydraCheckCodes, error.kind))
        throw new RuntimeError(hydraCheckCodes[error.kind], context)
      if (error.kind !== 'NETWORK_FAILURE')
        throw new RuntimeError('HYDRA_CLIENT_CHECK_FAILED', context)
      error = error.cause
    } else if (
      error &&
      (typeof error === 'object' || typeof error === 'function') &&
      'kind' in error
    )
      throw new RuntimeError('HYDRA_CLIENT_CHECK_FAILED', context)
    const code = safeNetworkCode(error)
    if (code)
      throw diagnostic(
        { code },
        {
          ...context,
          next: '核对 Hydra admin/public 地址；本地检查 pnpm service:status 和 pnpm service:logs hydra',
        },
      )
    throw new RuntimeError('HYDRA_CLIENT_CHECK_FAILED', context)
  }
}

/** All preparation checks are read-only; database markers replace configurable hash receipts. */
export async function verifyApplications(
  state,
  {
    execute = runOwned,
    tools = toolchain({ workspace: state.workspace, inherited: state.values }),
    verifySchemas = verifyFoundationSchemas,
    verifyClient = verifyHydraClient,
    ready = httpReady,
    onLog = () => {},
    signal,
  } = {},
) {
  signal?.throwIfAborted()
  await verifySchemas(state, { bootstrap: true })
  signal?.throwIfAborted()
  await execute(cliSpecification(state, tools, 'server', 'integration:check'), {
    onLog,
    signal,
    code: 'WEBSITE_NOT_READY',
    next: '按上方 Website 检查失败项修正；只有表结构或 migration 缺失时才执行 pnpm db:migrate',
  })
  await verifyRuntimeHydraClient(state, verifyClient, { ready, signal })
  signal?.throwIfAborted()
}

/** Watch processes own only their child generation. Dependency services are never stopped here. */
export async function runDevelopment(
  state,
  {
    service,
    verbose = false,
    prepare = prepareSdk,
    inherited = process.env,
    tools: selectedTools,
    acquireLock = acquireApplicationLock,
    superviseApplications = supervise,
    verify = verifyApplications,
    assertFree = assertPortFree,
    ready = httpReady,
    watchSources = watchSdkSources,
    output: selectedOutput,
  } = {},
) {
  if (state.profile !== 'local') throw new RuntimeError('LOCAL_PROFILE_REQUIRED')
  const tools = selectedTools ?? toolchain({ workspace: state.workspace, inherited: state.values })
  const lock = acquireLock(state)
  const logFile = join(state.directory, `applications-${lock.record.runId}.log`)
  const output =
    selectedOutput ??
    reporter({
      environment: state.values,
      verbose,
      persist: (line) => appendFileSync(logFile, `${line}\n`),
    })
  const onLog = output.log
  let handedOff = false
  try {
    output.heading('ExWebsite · 开发监听')
    output.note('正在准备 Contract / SDK 并检查 Website 的启动条件…')
    const admin =
      !service || service === 'admin-web'
        ? readAdminFrontendConfiguration({ workspace: state.workspace, inherited })
        : undefined
    const adminUrl = admin && `http://127.0.0.1:${admin.port}/`
    const selected = specifications(state, tools, admin).filter(
      (spec) => !service || spec.name === service,
    )
    handedOff = true
    await superviseApplications({
      mode: 'local',
      fingerprint: state.fingerprint,
      directory: state.directory,
      controlDirectory: state.directory,
      lock,
      specifications: selected,
      onLog,
      prepareGeneration: ({ execute, signal }) =>
        prepare({
          workspace: state.workspace,
          inherited: state.values,
          tools,
          execute,
          signal,
          onLog,
        }),
      preflight: async ({ signal, execute }) => {
        if (admin && Object.values(state.config.ports).includes(admin.port))
          throw new RuntimeError('PORT_CONFLICT', {
            service: 'admin-web',
            keys: ['LOCAL_ADMIN_WEB_PORT'],
            target: `127.0.0.1:${admin.port}`,
          })
        await verify(state, { tools, onLog, signal, execute })
        for (const port of [
          state.config.ports.public,
          state.config.ports.web,
          state.config.ports.api,
        ])
          await assertFree(port)
        if (admin) {
          try {
            await assertFree(admin.port)
          } catch {
            throw new RuntimeError('APPLICATION_PORT_OCCUPIED', {
              service: 'admin-web',
              keys: ['LOCAL_ADMIN_WEB_PORT'],
              target: `127.0.0.1:${admin.port}`,
              reason: '管理端监听端口被占用',
              next: '在端口所属终端停止原进程，或调整 LOCAL_ADMIN_WEB_PORT',
            })
          }
        }
      },
      watchSources: (onChange, onError) => watchSources(state.workspace, onChange, { onError }),
      onReady: () => {
        output.success('开发服务已就绪')
        output.status('Website', '可访问', `${state.config.publicOrigin}/`, { level: 'success' })
        if (admin) output.status('管理端', '可访问', adminUrl, { level: 'success' })
        output.note('LOCAL_READY · Ctrl+C 结束应用')
      },
      readiness: async (children, { signal }) => {
        if (!service || service === 'server')
          await ready(new URL('/api/health', state.internal.website), { children, signal })
        if (!service || service === 'web')
          await ready(`${state.config.publicOrigin}/`, { children, signal })
        if (!service) {
          await ready(`${state.config.publicOrigin}/api/health`, { children, signal })
        }
        if (admin) await ready(adminUrl, { children, signal })
      },
    })
  } finally {
    if (!handedOff) lock.release()
  }
}
