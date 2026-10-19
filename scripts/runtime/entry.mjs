import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, watchFile, unwatchFile } from 'node:fs'
import { runOwned, signalScope } from './ownership.mjs'
import { readRuntimeConfiguration } from './settings.mjs'
import { RuntimeError, redact, reporter } from './output.mjs'
import { Services, serviceNames } from './services.mjs'
import { runDevelopment } from './applications.mjs'
import { NativeApplications } from './native.mjs'
import { convertConfiguration } from './convert.mjs'
import { prepareInfrastructure, provisionIdentityClients } from './infrastructure.mjs'
import { renderNginx } from './nginx.mjs'
import { prepareSdk } from './sdk-preparation.mjs'

export function parseRuntimeArguments(input) {
  const args = [...input]
  if (args[0] === '--') args.shift()
  const command = args.shift()
  if (args[0] === '--') args.shift()
  if (
    ![
      'service:start',
      'service:stop',
      'service:status',
      'service:logs',
      'dev',
      'start',
      'stop',
      'logs',
      'infra',
    ].includes(command)
  )
    throw new RuntimeError('COMMAND_INVALID')
  let verbose = false
  if (args.at(-1) === '--verbose') {
    verbose = true
    args.pop()
  }
  if (command === 'infra') {
    const action = args.shift()
    if (args[0] === '--') args.shift()
    if (!['convert', 'init', 'migrate', 'clients', 'nginx'].includes(action))
      throw new RuntimeError('INFRA_ACTION_INVALID')
    if (args.length) throw new RuntimeError('ARGUMENTS_INVALID')
    return { command, action, verbose }
  }
  if (command === 'service:logs' || command === 'logs') {
    if (
      args.length > 1 ||
      (args.length && !(command === 'logs' ? ['server', 'hydra'] : serviceNames).includes(args[0]))
    )
      throw new RuntimeError('LOG_SERVICE_INVALID')
    return { command, service: args[0], verbose }
  }
  if (args.length) throw new RuntimeError('ARGUMENTS_INVALID')
  return { command, verbose }
}

async function applicationLogs(state, service) {
  const scope = signalScope(),
    services = service ? [service] : ['server', 'hydra']
  const files = services.map((name) => join(state.directory, 'logs', `${name}.jsonl`)),
    positions = new Map()
  const read = (file, initial = false) => {
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    const offset = positions.get(file) ?? 0
    const lines = (
      initial
        ? content.split('\n').slice(-51)
        : content.slice(content.length < offset ? 0 : offset).split('\n')
    ).filter(Boolean)
    positions.set(file, content.length)
    for (const line of lines) console.log(redact(line, state.values))
  }
  try {
    files.forEach((file) => {
      read(file, true)
      watchFile(file, { interval: 500 }, () => read(file))
    })
    await new Promise((resolve) => scope.signal.addEventListener('abort', resolve, { once: true }))
  } finally {
    files.forEach((file) => unwatchFile(file))
    scope.close()
  }
}

/** Hand preparation to the application-lock owner; never build before acquiring it. */
export async function runDevelopmentWithContract(
  state,
  options = {},
  { prepare = prepareSdk, launch = runDevelopment } = {},
) {
  return launch(state, { ...options, prepare })
}

export async function main(input = process.argv.slice(2)) {
  const options = parseRuntimeArguments(input)
  if (options.action === 'convert') {
    const result = await convertConfiguration()
    console.log(
      result.changed
        ? '配置转换完成；原目标、端口、issuer 和秘密已保留，备份位于 .local/runtime/config-backups/'
        : '配置已采用连接字段，无需转换',
    )
    return
  }
  const state = readRuntimeConfiguration(),
    output = reporter({ environment: state.values, verbose: options.verbose })
  if (options.command.startsWith('service:')) {
    const services = new Services(state)
    if (options.command === 'service:start') {
      output.heading('ExWebsite · 后台服务')
      output.note('正在检查并启动后台依赖…')
      await services.start({ log: output })
    } else if (options.command === 'service:stop') {
      await services.stop()
      output.success('本项目依赖已停止')
      output.note('持久卷已保留')
      output.next('pnpm service:start')
    } else if (options.command === 'service:status') services.status({ log: output })
    else {
      services.verify(services.inventory())
      output.heading('ExWebsite · 后台服务日志')
      output.note('Ctrl+C 结束日志查看')
      const scope = signalScope()
      try {
        await runOwned(
          {
            name: '后台日志',
            command: 'docker',
            args: [
              ...services.args,
              'logs',
              '--follow',
              '--tail',
              '100',
              ...(options.service ? [options.service] : []),
            ],
            cwd: state.workspace,
            environment: services.environment,
          },
          { onLog: output.log, signal: scope.signal },
        )
      } finally {
        scope.close()
      }
    }
  } else if (options.command === 'dev') await runDevelopmentWithContract(state, options)
  else if (options.command === 'start') await new NativeApplications(state).start({ log: output })
  else if (options.command === 'stop') {
    await new NativeApplications(state).stop()
    output.title('本项目应用已停止；后台服务与数据已保留')
  } else if (options.command === 'logs') await applicationLogs(state, options.service)
  else if (['init', 'migrate'].includes(options.action))
    await prepareInfrastructure(state, { migrateOnly: options.action === 'migrate' })
  else if (options.action === 'clients') await provisionIdentityClients(state)
  else if (options.action === 'nginx') {
    renderNginx(state)
    output.title(
      'Nginx 配置已生成于 .local/runtime/nginx/nginx.conf；须显式 nginx -t 校验后安装与重载',
    )
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    reporter({
      environment: process.env,
      stream: process.stderr,
      write: (line) => console.error(line),
    }).failure(error)
    process.exitCode = 1
  }
}
