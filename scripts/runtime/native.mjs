import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { acquireLock, runOwned } from './ownership.mjs'
import { httpReady, verifyFoundationSchemas } from './local-dev.mjs'
import { toolchain } from './local-config.mjs'
import { verifyRuntimeHydraClient, cliSpecification } from './applications.mjs'
import { validateDeployment } from './deployment.mjs'
import { RuntimeError, reporter } from './output.mjs'
import { digest } from './local-config.mjs'
import { verifyHydraBinary } from './infrastructure.mjs'
import { processRecord } from './pm2-process.mjs'

export const names = Object.freeze(['exwebsite-server', 'exwebsite-hydra'])

export class NativeApplications {
  constructor(
    state,
    {
      run = spawnSync,
      health = verifyNativeHealth,
      preflight = verifyNativePreflight,
      client = verifyNativeClient,
    } = {},
  ) {
    if (state.profile !== 'deployment') throw new RuntimeError('DEPLOYMENT_PROFILE_REQUIRED')
    this.state = state
    this.run = run
    this.health = health
    this.preflight = preflight
    this.client = client
    this.ecosystem = join(state.workspace, 'infra/runtime/ecosystem.config.cjs')
    this.script = join(state.workspace, 'scripts/runtime/pm2-process.mjs')
  }
  call(args) {
    const binary = this.state.values.PM2_BINARY ?? 'pm2'
    const script =
      /\.(?:c?js|mjs)$/.test(binary) ||
      (/(?:^|[/\\])pm2$/.test(binary) &&
        existsSync(binary) &&
        readFileSync(binary, 'utf8').slice(0, 100).includes('node'))
    const command = script ? process.execPath : binary
    const arguments_ = command === binary ? args : [binary, ...args]
    const result = this.run(command, arguments_, {
      cwd: this.state.workspace,
      env: {
        ...this.state.inherited,
        ...(args[0] === 'start'
          ? {
              EXWEBSITE_RUNTIME_LAUNCH_PLAN: JSON.stringify(
                Object.fromEntries(
                  ['server', 'hydra'].map((service) => [
                    service,
                    processRecord(this.state, service),
                  ]),
                ),
              ),
            }
          : {}),
      },
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 30000,
    })
    if (result.error || result.status !== 0)
      throw new RuntimeError('PM2_COMMAND_FAILED', {
        service: 'PM2',
        keys: ['PM2_BINARY'],
        next: '安装 PM2；Windows 指定 PM2_BINARY 为 pm2/bin/pm2 的完整路径',
      })
    return result.stdout
  }
  inventory({ configuration = false } = {}) {
    let items
    try {
      items = JSON.parse(this.call(['jlist']))
    } catch (error) {
      if (error instanceof RuntimeError) throw error
      throw new RuntimeError('PM2_INVENTORY_INVALID')
    }
    if (!Array.isArray(items)) throw new RuntimeError('PM2_INVENTORY_INVALID')
    const selected = items.filter((item) => names.includes(item.name))
    if (new Set(selected.map((item) => item.name)).size !== selected.length)
      throw new RuntimeError('PM2_DUPLICATE_PROCESS')
    for (const item of selected) {
      const environment = item.pm2_env
      if (
        resolve(environment?.pm_exec_path ?? '') !== resolve(this.script) ||
        resolve(environment?.pm_cwd ?? '') !== resolve(this.state.workspace) ||
        !Number.isSafeInteger(item.pm_id) ||
        !['server', 'hydra'].some(
          (service) =>
            item.name === `exwebsite-${service}` &&
            JSON.stringify(environment.args) === JSON.stringify([service]),
        )
      )
        throw new RuntimeError('PM2_OWNERSHIP_CONFLICT', { service: item.name })
      if (
        configuration &&
        digest(environment.EXWEBSITE_RUNTIME_PROCESS) !==
          digest(JSON.stringify(processRecord(this.state, item.name.slice('exwebsite-'.length))))
      )
        throw new RuntimeError('PM2_CONFIGURATION_CHANGED', {
          service: item.name,
          next: 'pnpm stop 后按当前配置重新启动',
        })
    }
    return selected
  }
  async start({
    log = reporter({ environment: this.state.values }),
    verifySchemas = verifyFoundationSchemas,
    acquire = acquireLock,
    verifyBinary = verifyHydraBinary,
  } = {}) {
    const lock = acquire({
      mode: 'local',
      fingerprint: this.state.fingerprint,
      directory: this.state.directory,
      name: 'applications-lock.json',
    })
    const previous = new Map()
    let changed = false
    try {
      for (const item of this.inventory({ configuration: true })) previous.set(item.name, item)
      await verifySchemas(this.state, { bootstrap: true })
      await this.preflight(this.state)
      for (const service of ['server']) {
        const entry = join(this.state.workspace, 'apps/server/dist/server.js')
        if (!existsSync(entry))
          throw new RuntimeError('BUILD_ARTIFACT_MISSING', { service, next: 'pnpm build' })
      }
      if (!existsSync(this.state.values.HYDRA_BINARY ?? ''))
        throw new RuntimeError('HYDRA_BINARY_REQUIRED', { keys: ['HYDRA_BINARY'] })
      verifyBinary(this.state)
      const missing = names.filter((name) => !previous.has(name))
      // Existing processes are verified, never silently restarted to adopt changed settings.
      if ([...previous.values()].some((item) => item.pm2_env.status !== 'online'))
        throw new RuntimeError('PM2_EXISTING_PROCESS_STOPPED', {
          next: 'pnpm stop；核对配置后重新 pnpm start',
        })
      if (missing.includes('exwebsite-hydra')) {
        changed = true
        this.call(['start', this.ecosystem, '--only', 'exwebsite-hydra'])
      }
      // Client verification needs Hydra, but Website remain stopped until it succeeds.
      await this.client(this.state)
      const applications = missing.filter((name) => name !== 'exwebsite-hydra')
      if (applications.length) {
        changed = true
        this.call(['start', this.ecosystem, '--only', applications.join(',')])
      }
      await this.health(this.state)
      const items = this.inventory({ configuration: true })
      if (
        items.length !== names.length ||
        items.some((item) => item.pm2_env.status !== 'online' || !item.pid)
      )
        throw new RuntimeError('PM2_PROCESS_NOT_ONLINE')
      log.title('应用已就绪')
      items.forEach((item) => log.log(item.name, `PID ${item.pid}；健康检查通过`))
      log.title(`网站：${this.state.config.publicOrigin}/；日志：pnpm logs；停止：pnpm stop`)
    } catch (error) {
      if (changed) {
        const created = this.inventory().filter((item) => !previous.has(item.name))
        if (created.length) this.call(['delete', ...created.map((item) => String(item.pm_id))])
      }
      throw error
    } finally {
      lock.release()
    }
  }
  async stop() {
    const lock = acquireLock({
      mode: 'local',
      fingerprint: this.state.fingerprint,
      directory: this.state.directory,
      name: 'applications-lock.json',
    })
    try {
      const items = this.inventory({ configuration: false })
      if (items.length) this.call(['delete', ...items.map((item) => String(item.pm_id))])
      if (this.inventory({ configuration: false }).length)
        throw new RuntimeError('PM2_STOP_INCOMPLETE')
    } finally {
      lock.release()
    }
  }
}

/** Read-only database identity and application marker checks precede any PM2 mutation. */
export async function verifyNativePreflight(state) {
  await validateDeployment(state, { verifyClient: async () => {} })
  const tools = toolchain({ workspace: state.workspace, inherited: state.values })
  await runOwned(cliSpecification(state, tools, 'server', 'integration:check'))
}
export async function verifyNativeClient(state, { verifyClient, ready = httpReady } = {}) {
  await verifyRuntimeHydraClient(state, verifyClient, { ready })
}

/** PM2 online is a process signal. Every real health and identity check must also pass. */
export async function verifyNativeHealth(state) {
  const tools = toolchain({ workspace: state.workspace, inherited: state.values })
  await httpReady(new URL('/api/health', state.internal.website), { timeout: 30000 })
  await verifyNativeClient(state)
  await validateDeployment(state, { verifyClient: async () => {} })
  await runOwned(cliSpecification(state, tools, 'server', 'integration:check'))
}
