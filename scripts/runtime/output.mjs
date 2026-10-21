import { performance } from 'node:perf_hooks'

/** Redacts even short and percent-encoded secrets; never prints raw connection URLs or SQL. */
export function redact(value, environment = {}) {
  let text = String(value).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
  const secrets = new Set()
  for (const [key, value] of Object.entries(environment)) {
    if (!value) continue
    if (
      /(?:PASSWORD|SECRET|TOKEN|KEY|DSN|DATABASE_URL|REDIS_URL|OUTBOX_TARGETS_JSON|IDENTITY_CLIENTS_JSON)/i.test(
        key,
      )
    ) {
      secrets.add(value)
      secrets.add(encodeURIComponent(value))
      secrets.add(JSON.stringify(value).slice(1, -1))
      try {
        const url = new URL(value)
        if (url.password) {
          secrets.add(url.password)
          secrets.add(decodeURIComponent(url.password))
        }
      } catch {}
      if (['IDENTITY_CLIENTS_JSON', 'IDENTITY_OUTBOX_TARGETS_JSON'].includes(key)) {
        const collect = (item) => {
          if (!item || typeof item !== 'object') return
          for (const [field, nested] of Object.entries(item)) {
            if (
              ['clientSecret', 'integrationKey', 'key', 'deliveryKey'].includes(field) &&
              typeof nested === 'string' &&
              nested
            ) {
              secrets.add(nested)
              secrets.add(encodeURIComponent(nested))
              secrets.add(JSON.stringify(nested).slice(1, -1))
            } else collect(nested)
          }
        }
        try {
          collect(JSON.parse(value))
        } catch {}
      }
    }
  }
  for (const secret of [...secrets].sort((a, b) => b.length - a.length))
    text = text.split(secret).join('[已隐藏]')
  return text
    .replace(/\bBearer\s+\S+/gi, 'Bearer [已隐藏]')
    .replace(/(?:postgres(?:ql)?|rediss?):\/\/[^\s'"<>]+/gi, '[连接串已隐藏]')
    .replace(
      /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER|CREATE|DROP|TRUNCATE)\b[^\r\n]*/gi,
      '[SQL 已隐藏]',
    )
}

const advice = {
  ENV_INVALID: ['根环境文件无法读取或解析', '修正根 .env.local 的权限和 dotenv 格式'],
  PORT_INVALID: ['端口不是有效整数', '将端口设置为 1024–65535 的整数'],
  APPLICATION_NOT_READY: ['前端 HTTP 就绪检查未通过', '核对监听端口和进程日志'],
  APP_EXITED_DURING_START: ['前端在启动期间退出', '检查退出进程日志，修正后重试'],
  APPLICATION_PORT_OCCUPIED: [
    '前端端口已被占用',
    '停止已知端口占用进程，或使用 pnpm dev --port 指定其他端口',
  ],
}

export class RuntimeError extends Error {
  constructor(
    code,
    { service = '运行配置', phase = '校验', keys = [], target = '', reason, next } = {},
  ) {
    const hint = advice[code]
    reason ??=
      hint?.[0] ??
      (/CONFLICT|OWNERSHIP|PROOF|INVENTORY/.test(code)
        ? '资源配置或归属核验未通过'
        : '检查项未通过')
    next ??=
      hint?.[1] ??
      (/CONFLICT|OWNERSHIP|PROOF|INVENTORY/.test(code)
        ? '核对当前配置和资源归属，保留现有数据；不要删除归属记录绕过检查'
        : '核对上方服务、阶段和配置键，修正失败项后重试')
    super(
      `${service} · ${phase} · ${code}（${reason}）${target ? ` · ${target}` : ''}${keys.length ? ` · 配置键 ${keys.join(', ')}` : ''}；下一步：${next}`,
    )
    this.code = code
    Object.assign(this, { service, phase, keys, target, reason, next })
  }
}

/** Render only trusted runtime errors or safe codes; unknown exception messages stay hidden. */
export function runtimeFailure(error) {
  if (error instanceof RuntimeError) return error.message
  if (/^[A-Z][A-Z0-9_]+$/.test(error?.code ?? '')) return new RuntimeError(error.code).message
  return '运行失败：未分类异常；请检查上方服务日志中的失败项；原始异常已隐藏'
}

/** Color is terminal-only; persisted output is always redacted plain text. */
export function reporter({
  environment = {},
  verbose = false,
  stream = process.stdout,
  colorEnvironment = process.env,
  write = (line) => console.log(line),
  persist,
} = {}) {
  const color =
    Boolean(stream.isTTY) &&
    !colorEnvironment.NO_COLOR &&
    colorEnvironment.TERM !== 'dumb' &&
    colorEnvironment.FORCE_COLOR !== '0'
  const safe = (value) => redact(value, environment)
  const styles = { bold: 1, gray: 90, cyan: 36, success: 32, warning: 33, error: 31 }
  const paint = (value, style) => (color ? `\x1b[${styles[style]}m${value}\x1b[0m` : value)
  const emit = (plain, displayed = plain, retained = plain) => {
    persist?.(safe(retained))
    write(displayed)
  }
  const title = (value) => {
    const text = safe(value)
    emit(text, paint(text, 'bold'))
  }
  const log = (service, line, level = '信息') => {
    const now = new Date(),
      name = safe(service),
      text = safe(line)
    // stderr is a transport channel, not proof of an error (many tools use it for progress).
    if (['stdout', 'stderr'].includes(level)) level = '信息'
    let severity
    try {
      severity = JSON.parse(text).level
    } catch {}
    const prefix = text.replace(/^(?:\[[^\]]+\]\s*)+/, '')
    const tone =
      /^(?:错误|error|fatal)$/i.test(level) ||
      severity >= 50 ||
      /^(?:错误|error|fatal)(?:[:\s]|$)/i.test(prefix)
        ? 'error'
        : /^(?:警告|warn|warning)$/i.test(level) ||
            severity >= 40 ||
            /^(?:警告|warn(?:ing)?)(?:[:\s]|$)/i.test(prefix) ||
            /DeprecationWarning|deprecated/i.test(text)
          ? 'warning'
          : 'cyan'
    const time = verbose ? now.toISOString() : now.toTimeString().slice(0, 8)
    const plain = `${time} [${name}] ${text}`
    emit(
      plain,
      `${paint(time, 'gray')} ${paint(`[${name}]`, tone)} ${text}`,
      `${now.toISOString()} [${level}] [${name}] ${text}`,
    )
  }
  const status = (service, state, detail = '', { level = 'warning', detailTone = 'cyan' } = {}) => {
    const symbol = { success: '✓', warning: '!', error: '✗', gray: '·' }[level] ?? '·'
    const name = safe(service).padEnd(10),
      label = safe(state),
      suffix = detail ? `  ${safe(detail)}` : ''
    emit(
      `  ${symbol} ${name}  ${label}${suffix}`,
      `  ${paint(symbol, level)} ${name}  ${paint(label, level)}${paint(suffix, detailTone)}`,
    )
  }
  const next = (value, commands = []) => {
    emit('')
    title('下一步')
    for (const line of safe(value).split(/；|\n/).filter(Boolean))
      emit(`  ${line}`, `  ${paint(line, 'cyan')}`)
    if (commands.length) {
      emit('')
      title('其他操作')
      for (const [label, command] of commands) {
        const name = safe(label),
          action = safe(command)
        emit(`  ${name}  ${action}`, `  ${paint(name, 'gray')}  ${paint(action, 'cyan')}`)
      }
    }
  }
  const success = (value) => {
    const text = `✓ ${safe(value)}`
    emit('')
    emit(text, paint(text, 'success'))
  }
  return {
    log,
    title,
    status,
    next,
    success,
    heading(value) {
      emit('')
      title(value)
      emit('')
    },
    note(value) {
      for (const line of safe(value).split('\n')) emit(`  ${line}`, paint(`  ${line}`, 'gray'))
    },
    failure(error) {
      const failure =
        error instanceof RuntimeError
          ? error
          : /^[A-Z][A-Z0-9_]+$/.test(error?.code ?? '')
            ? new RuntimeError(error.code)
            : null
      const reason = failure
        ? `${failure.reason.startsWith(failure.service) ? '' : `${failure.service} `}${failure.reason}`
        : '运行失败'
      const text = `✗ ${safe(reason)}`
      emit('')
      emit(text, paint(text, 'error'))
      emit('')
      const fields = failure
        ? [
            ['检查项', failure.phase],
            ['错误码', failure.code],
            ['目标', failure.target],
            ['配置键', failure.keys.join(', ')],
          ]
        : [['原因', '未分类异常，原始消息已隐藏']]
      for (const [label, value] of fields)
        if (value) {
          const line = `  ${label}  ${safe(value)}`
          emit(line, paint(line, 'gray'))
        }
      next(failure?.next ?? '请检查上方服务日志中的失败项')
    },
    async stage(service, execute) {
      const start = performance.now(),
        lines = []
      log(service, '开始')
      try {
        const result = await execute((name, line, channel) => {
          const safe = redact(line, environment)
          if (verbose || channel === 'stderr' || /warn|error|警告|错误|deprecated/i.test(safe))
            log(name, safe)
          lines.push(`[${name}] ${safe}`)
          if (lines.length > 300) lines.shift()
        })
        log(service, `完成 (${((performance.now() - start) / 1000).toFixed(1)} 秒)`)
        return result
      } catch (error) {
        lines.forEach((line) => emit(line))
        log(
          service,
          error instanceof RuntimeError ? error.message : '阶段失败；检查上方日志',
          '错误',
        )
        throw error
      }
    },
  }
}
