import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { digest, atomicJson, readJson } from './local-config.mjs'
import { acquireLock } from './ownership.mjs'
import { assertPortFree, httpReady } from './local-dev.mjs'
import { RuntimeError, reporter, diagnostic } from './output.mjs'
import { acquireApplicationLock } from './application-lock.mjs'
import { containerProof } from './container-proof.mjs'

export const serviceNames = Object.freeze(['postgres', 'hydra'])
const project = 'exwebsite-runtime'
const label = 'dev.exwebsite.runtime'
const context = (service, phase) => ({
  service,
  phase,
  next: '检查 Docker 状态（docker info）、配置和端口占用；容器日志使用 pnpm service:logs，状态使用 pnpm service:status',
})
const serviceDetails = (state) => [
  ['postgres', 'PostgreSQL', `127.0.0.1:${state.config.ports.postgres}`],
  ['hydra', 'Hydra', state.config.issuer],
]

/** No defaults or secrets live in Compose: it receives an explicit adapter environment. */
export function composeEnvironment(state) {
  if (state.profile !== 'local') throw new RuntimeError('LOCAL_PROFILE_REQUIRED')
  const { ports: p } = state.config,
    v = state.values
  for (const prefix of ['DATABASE', 'HYDRA_DATABASE']) {
    const url = new URL(state.databases[prefix])
    if (url.hostname !== '127.0.0.1' || Number(url.port) !== p.postgres)
      throw new RuntimeError('LOCAL_DATABASE_LAYOUT_CONFLICT', {
        keys: [`${prefix}_HOST`, `${prefix}_PORT`, 'LOCAL_POSTGRES_PORT'],
      })
  }
  const images = JSON.parse(
    readFileSync(join(state.workspace, 'infra/runtime/images.lock.json'), 'utf8'),
  )
  const dsn = new URL(state.databases.HYDRA_DATABASE)
  dsn.hostname = 'postgres'
  dsn.port = '5432'
  const postgresVolume = v.POSTGRES_VOLUME_NAME ?? 'exwebsite-runtime-pgdata'
  const postgresUser = v.POSTGRES_USER ?? 'postgres'
  const externalVolume = v.POSTGRES_VOLUME_EXTERNAL ?? 'false'
  if (!['true', 'false'].includes(externalVolume))
    throw new RuntimeError('EXTERNAL_VOLUME_SETTING_INVALID', {
      keys: ['POSTGRES_VOLUME_EXTERNAL'],
    })
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(postgresVolume) || !v.POSTGRES_PASSWORD)
    throw new RuntimeError('LOCAL_SERVICE_CONFIG_INVALID', {
      keys: ['POSTGRES_VOLUME_NAME', 'POSTGRES_PASSWORD'],
    })
  if (!postgresUser || /[\u0000\r\n]/.test(postgresUser))
    throw new RuntimeError('LOCAL_SERVICE_CONFIG_INVALID', { keys: ['POSTGRES_USER'] })
  return {
    ...state.inherited,
    POSTGRES_USER: postgresUser,
    POSTGRES_PASSWORD: v.POSTGRES_PASSWORD,
    HYDRA_SYSTEM_SECRET: v.HYDRA_SYSTEM_SECRET,
    POSTGRES_VOLUME_NAME: postgresVolume,
    RUNTIME_POSTGRES_IMAGE: images.postgres,
    RUNTIME_HYDRA_IMAGE: images.hydra,
    RUNTIME_HYDRA_DSN: dsn.href,
    RUNTIME_POSTGRES_VOLUME_EXTERNAL: externalVolume,
    LOCAL_POSTGRES_PORT: String(p.postgres),
    LOCAL_HYDRA_PUBLIC_PORT: String(p.hydraPublic),
    LOCAL_HYDRA_ADMIN_PORT: String(p.hydraAdmin),
    RUNTIME_ISSUER: state.config.issuer,
    RUNTIME_PUBLIC_ORIGIN: state.config.publicOrigin,
  }
}

export class Services {
  constructor(state, { run = spawnSync } = {}) {
    this.state = state
    this.run = run
    this.environment = composeEnvironment(state)
    this.args = [
      'compose',
      '--project-name',
      project,
      '--env-file',
      join(state.workspace, '.env.example'),
      '-f',
      join(state.workspace, 'compose.yaml'),
    ]
    this.file = join(state.directory, 'dependencies.json')
  }
  call(args) {
    const result = this.run('docker', args, {
      cwd: this.state.workspace,
      env: this.environment,
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      timeout: 120000,
    })
    if (result.error || result.status !== 0) {
      if (result.error?.code === 'ENOENT')
        throw new RuntimeError('DOCKER_NOT_FOUND', {
          service: 'Docker',
          phase: '命令检查',
          next: '检查 Docker 是否已安装且 docker 命令位于 PATH；安装后重试 pnpm service:status',
        })
      if (result.error?.code === 'ETIMEDOUT')
        throw new RuntimeError('DOCKER_COMMAND_TIMEOUT', {
          service: 'Docker',
          phase: '调用超时',
          next: '检查 Docker 状态（docker info）及 Docker Desktop/daemon 是否响应；恢复后重试 pnpm service:status',
        })
      // Classify known engine connection failures without returning raw stderr or secrets.
      if (
        /failed to connect to the docker API|cannot connect to the docker daemon|error during connect:/i.test(
          result.stderr ?? '',
        )
      )
        throw new RuntimeError('DOCKER_UNAVAILABLE', {
          service: 'Docker',
          phase: '引擎连接失败',
          next: '检查 Docker 状态（docker info），确认 Docker Desktop/daemon 已启动，并检查当前 context（docker context show）；恢复后重试 pnpm service:status',
        })
      throw new RuntimeError('DOCKER_COMMAND_FAILED', context('Docker', '调用'))
    }
    return result.stdout
  }
  compose(args) {
    return this.call([...this.args, ...args])
  }
  inventory() {
    const ids = this.call([
      'ps',
      '-a',
      '--no-trunc',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--format',
      '{{.ID}}',
    ])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
    if (ids.some((id) => !/^[a-f0-9]{64}$/.test(id)) || new Set(ids).size !== ids.length)
      throw new RuntimeError('INVENTORY_INVALID')
    return ids.length ? JSON.parse(this.call(['inspect', ...ids])) : []
  }
  status({ log = reporter({ environment: this.state.values }) } = {}) {
    const items = this.verify(this.inventory())
    log.heading('ExWebsite · 后台服务状态')
    for (const [name, display, address] of serviceDetails(this.state)) {
      const item = items.find((item) => item.Config.Labels['com.docker.compose.service'] === name),
        health = item?.State.Health?.Status
      const running = item?.State.Running
      const description =
        { healthy: '健康检查通过', unhealthy: '健康检查失败', starting: '健康检查中' }[health] ??
        '无容器健康检查'
      log.status(
        display,
        !item ? '未创建' : !running ? '已停止' : `运行中（${description}）`,
        item ? address : '',
        {
          level:
            running && health === 'healthy'
              ? 'success'
              : running && health === 'unhealthy'
                ? 'error'
                : 'warning',
        },
      )
    }
    if (!items.length) {
      log.note('未发现本项目服务容器。')
      log.next('检查 Docker 状态（docker info）；环境已准备后执行 pnpm service:start')
      log.note(
        '首次准备：填写根 .env.local，显式 pnpm infra init，并单独准备 exre 和 pnpm db:migrate',
      )
    } else
      log.next(
        items.every(
          (item) =>
            item.State.Running && (!item.State.Health || item.State.Health.Status === 'healthy'),
        ) && items.length === serviceNames.length
          ? 'pnpm dev'
          : '检查 pnpm service:logs；依赖尚未运行时执行 pnpm service:start',
      )
  }
  verify(items) {
    const configuration = JSON.parse(this.compose(['config', '--format', 'json']))
    for (const item of items) {
      const labels = item.Config.Labels ?? {},
        service = labels['com.docker.compose.service']
      if (
        !serviceNames.includes(service) ||
        labels[label] !== 'dependencies' ||
        labels['com.docker.compose.oneoff']?.toLowerCase() !== 'false' ||
        labels['com.docker.compose.project'] !== project ||
        item.Config.Image !== configuration.services[service].image ||
        labels['com.docker.compose.config-hash'] !==
          this.compose(['config', '--hash', service]).trim().split(/\s+/).at(-1)
      )
        throw new RuntimeError(
          'CONTAINER_OWNERSHIP_CONFLICT',
          context(service ?? 'Docker', '归属核验'),
        )
      const expected = configuration.services[service]
      const variables = Object.fromEntries(
        item.Config.Env.map((value) => {
          const index = value.indexOf('=')
          return [value.slice(0, index), value.slice(index + 1)]
        }),
      )
      if (
        Object.entries(expected.environment ?? {}).some(
          ([key, value]) => variables[key] !== String(value).replaceAll('$$', '$'),
        )
      )
        throw new RuntimeError('CONTAINER_ENV_CONFLICT')
      const ports = Object.fromEntries(
        (expected.ports ?? []).map((port) => [
          `${port.target}/${port.protocol || 'tcp'}`,
          [{ HostIp: port.host_ip, HostPort: String(port.published) }],
        ]),
      )
      if (digest(ports) !== digest(item.HostConfig.PortBindings ?? {}))
        throw new RuntimeError('CONTAINER_PORT_CONFLICT')
      for (const volume of expected.volumes ?? []) {
        const actual = item.Mounts.find((mount) => mount.Destination === volume.target)
        if (
          !actual ||
          actual.Type !== 'volume' ||
          actual.Name !== configuration.volumes[volume.source].name
        )
          throw new RuntimeError('CONTAINER_VOLUME_CONFLICT')
      }
    }
    if (
      new Set(items.map((item) => item.Config.Labels['com.docker.compose.service'])).size !==
      items.length
    )
      throw new RuntimeError('CONTAINER_DUPLICATE')
    return items
  }
  verifyVolumes() {
    for (const name of [this.environment.POSTGRES_VOLUME_NAME]) {
      const names = this.call(['volume', 'ls', '--format', '{{.Name}}']).trim().split(/\r?\n/)
      const external =
        name === this.environment.POSTGRES_VOLUME_NAME &&
        this.environment.RUNTIME_POSTGRES_VOLUME_EXTERNAL === 'true'
      if (!names.includes(name)) {
        if (external)
          throw new RuntimeError('EXTERNAL_VOLUME_NOT_FOUND', {
            service: 'PostgreSQL',
            target: name,
          })
        continue
      }
      const volume = JSON.parse(this.call(['volume', 'inspect', name]))[0]
      if (external) {
        const items = this.verify(this.inventory())
        const owned = items.find(
          (item) =>
            item.Config.Labels['com.docker.compose.service'] === 'postgres' &&
            item.Mounts.some(
              (mount) =>
                mount.Type === 'volume' &&
                mount.Name === name &&
                mount.Destination === '/var/lib/postgresql',
            ),
        )
        if (!owned)
          throw new RuntimeError('VOLUME_ADOPTION_REQUIRES_MAINTENANCE', {
            ...context('PostgreSQL', '外部卷归属核验'),
            target: name,
          })
        const ids = this.call([
          'ps',
          '-a',
          '--no-trunc',
          '--filter',
          `volume=${name}`,
          '--format',
          '{{.ID}}',
        ])
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
        const consumers = ids.length ? JSON.parse(this.call(['inspect', ...ids])) : []
        if (
          !consumers.some((item) => item.Id === owned.Id) ||
          consumers.some(
            (item) =>
              item.Id !== owned.Id &&
              item.State.Running &&
              item.Mounts.some((mount) => mount.Type === 'volume' && mount.Name === name),
          )
        )
          throw new RuntimeError('EXTERNAL_VOLUME_IN_USE', { service: 'PostgreSQL', target: name })
        continue
      }
      const expectedKey = 'pgdata'
      if (
        volume?.Labels?.['com.docker.compose.project'] !== project ||
        volume.Labels['com.docker.compose.volume'] !== expectedKey
      )
        throw new RuntimeError('VOLUME_ADOPTION_REQUIRES_MAINTENANCE', {
          ...context('Docker', '卷归属核验'),
          target: name,
        })
    }
  }
  ownershipRecord() {
    const record = readJson(this.file)
    if (
      !record ||
      record.version !== 1 ||
      record.project !== project ||
      !Array.isArray(record.proofs) ||
      !Array.isArray(record.newlyStarted) ||
      record.proofs.some(
        (proof) =>
          !proof ||
          typeof proof.id !== 'string' ||
          typeof proof.digest !== 'string' ||
          !serviceNames.includes(proof.service),
      )
    )
      throw new RuntimeError('OWNERSHIP_RECORD_INVALID')
    return record
  }
  verifyProofs(items, proofs, code, phase) {
    for (const item of items)
      if (
        !proofs.some(
          (proof) => proof?.id === item.Id && digest(proof) === digest(containerProof(item)),
        )
      )
        throw new RuntimeError(code, context('Docker', phase))
  }
  async start({
    ready = verifyDependencyHealth,
    assertFree = assertPortFree,
    log = reporter({ environment: this.state.values }),
    selectedServices = serviceNames,
  } = {}) {
    if (!selectedServices.length || selectedServices.some((name) => !serviceNames.includes(name)))
      throw new RuntimeError('SERVICE_SELECTION_INVALID')
    const lock = acquireLock({
      mode: 'local',
      fingerprint: this.state.fingerprint,
      directory: this.state.directory,
      name: 'service-lock.json',
    })
    let previous = [],
      saved = false
    try {
      previous = this.verify(this.inventory())
      const record = existsSync(this.file) ? this.ownershipRecord() : null
      if (!record && previous.length)
        throw new RuntimeError('OWNERSHIP_RECORD_MISSING', context('Docker', '启动前归属核验'))
      if (record)
        this.verifyProofs(previous, record.proofs, 'START_OWNERSHIP_CONFLICT', '启动前归属核验')
      this.verifyVolumes()
      const priorProofs = previous.map(containerProof)
      const p = this.state.config.ports
      for (const [service, ports] of [
        ['postgres', [p.postgres]],
        ['hydra', [p.hydraPublic, p.hydraAdmin]],
      ].filter(([service]) => selectedServices.includes(service))) {
        if (
          !previous.some(
            (item) =>
              item.Config.Labels['com.docker.compose.service'] === service && item.State.Running,
          )
        )
          for (const port of ports) await assertFree(port)
      }
      const original = new Set(previous.filter((item) => item.State.Running).map((item) => item.Id))
      const save = () => {
        const items = this.verify(this.inventory())
        this.verifyVolumes()
        // Compose may start existing containers, but cannot replace their ownership evidence.
        const existing = items.filter((item) =>
          previous.some(
            (prior) =>
              prior.Config.Labels['com.docker.compose.service'] ===
              item.Config.Labels['com.docker.compose.service'],
          ),
        )
        this.verifyProofs(existing, priorProofs, 'START_OWNERSHIP_CONFLICT', '启动后归属核验')
        atomicJson(this.file, {
          version: 1,
          project,
          proofs: items.map(
            (item) =>
              record?.proofs.find((proof) => proof.id === item.Id) ??
              priorProofs.find((proof) => proof.id === item.Id) ??
              containerProof(item),
          ),
          newlyStarted: items.filter((item) => !original.has(item.Id)).map((item) => item.Id),
        })
        saved = true
      }
      try {
        this.compose([
          'up',
          '-d',
          '--no-recreate',
          '--wait',
          '--wait-timeout',
          '60',
          ...selectedServices,
        ])
      } finally {
        save()
      }
      await ready(this.state, this, selectedServices)
      const allServices = serviceNames.every((name) => selectedServices.includes(name))
      log.success(allServices ? '后台依赖已就绪' : '所选后台依赖已就绪')
      for (const [name, display, address] of serviceDetails(this.state).filter(([name]) =>
        selectedServices.includes(name),
      ))
        log.status(display, '已就绪', address, { level: 'success' })
      log.next(allServices ? 'pnpm dev' : 'pnpm service:start', [
        ['状态', 'pnpm service:status'],
        ['日志', 'pnpm service:logs'],
        ['停止', 'pnpm service:stop'],
      ])
    } catch (error) {
      if (saved) await this.stop({ onlyNew: true, lock: false })
      throw error
    } finally {
      lock.release()
    }
  }
  async stop({ onlyNew = false, lock: useLock = true } = {}) {
    const applicationLock = useLock ? acquireApplicationLock(this.state) : undefined
    let lock
    try {
      if (useLock)
        for (const port of ['public', 'web', 'api'].map((name) => this.state.config.ports[name]))
          await assertPortFree(port)
      lock = useLock
        ? acquireLock({
            mode: 'local',
            fingerprint: this.state.fingerprint,
            directory: this.state.directory,
            name: 'service-lock.json',
          })
        : undefined
      if (!existsSync(this.file)) {
        if (!this.inventory().length) return
        throw new RuntimeError('OWNERSHIP_RECORD_MISSING', context('Docker', '停止'))
      }
      const record = this.ownershipRecord(),
        items = this.inventory()
      this.verifyProofs(items, record.proofs, 'STOP_OWNERSHIP_CONFLICT', '停止')
      const selected = items.filter(
        (item) => item.State.Running && (!onlyNew || record.newlyStarted.includes(item.Id)),
      )
      if (selected.length) this.call(['stop', '--time', '10', ...selected.map((item) => item.Id)])
      const actual = this.inventory()
      this.verifyProofs(actual, record.proofs, 'STOP_OWNERSHIP_CONFLICT', '停止后归属核验')
      if (
        actual.some((item) => selected.some((prior) => prior.Id === item.Id) && item.State.Running)
      )
        throw new RuntimeError('STOP_INCOMPLETE')
      atomicJson(this.file, { ...record, proofs: actual.map(containerProof) })
    } finally {
      lock?.release()
      applicationLock?.release()
    }
  }
}

export async function verifyDependencyHealth(state, services, selected = serviceNames) {
  const { default: pg } = await import('pg')
  for (const name of ['postgres']) {
    const client = new pg.Client({
      host: '127.0.0.1',
      port: state.config.ports.postgres,
      database: name,
      user: state.values.POSTGRES_USER ?? 'postgres',
      password: state.values.POSTGRES_PASSWORD,
      connectionTimeoutMillis: 3000,
    })
    try {
      await client.connect()
      const identity = (
        await client.query('SELECT current_database() AS name, current_user AS role')
      ).rows[0]
      if (identity?.name !== name || identity.role !== (state.values.POSTGRES_USER ?? 'postgres'))
        throw new RuntimeError('DATABASE_IDENTITY_CONFLICT')
    } catch (error) {
      throw diagnostic(error, {
        ...context(name, '连接检查'),
        keys: ['LOCAL_POSTGRES_PORT', 'POSTGRES_PASSWORD'],
      })
    } finally {
      await client.end().catch(() => {})
    }
  }
  if (!selected.includes('hydra')) return
  await httpReady(new URL('/health/ready', state.internal.hydra), { timeout: 20000 })
  await httpReady(new URL('/.well-known/openid-configuration', state.config.issuer), {
    timeout: 20000,
    expected: async (response) => (await response.json()).issuer === state.config.issuer,
  })
}
