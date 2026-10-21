import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { reporter, RuntimeError, redact } from './output.mjs'

function capture({ isTTY = false, colorEnvironment = {}, ...options } = {}) {
  const lines = [],
    retained = []
  const output = reporter({
    stream: { isTTY },
    colorEnvironment,
    write: (line) => lines.push(line),
    persist: (line) => retained.push(line),
    ...options,
  })
  return { output, lines, retained }
}

test('service summaries separate readiness, addresses and copyable commands without timestamps', () => {
  const { output, lines } = capture()
  output.heading('ExWebsite · 前端')
  output.status('Web', '已就绪', '127.0.0.1:8080', { level: 'success' })
  output.next('pnpm dev', [
    ['构建', 'pnpm build'],
    ['验证', 'pnpm test'],
  ])
  const text = lines.join('\n')
  assert.match(text, /✓ Web\s+已就绪\s+127\.0\.0\.1:8080/)
  assert.match(text, /下一步\n  pnpm dev\n\n其他操作\n  构建  pnpm build/)
  assert.doesNotMatch(text, /\x1b|\d{4}-\d{2}-\d{2}|\[信息\]/)
})

test('color follows each output stream and explicit disable settings', () => {
  for (const options of [
    { isTTY: false },
    { isTTY: true, colorEnvironment: { NO_COLOR: '1' } },
    { isTTY: true, colorEnvironment: { TERM: 'dumb' } },
    { isTTY: true, colorEnvironment: { FORCE_COLOR: '0' } },
  ]) {
    const { output, lines } = capture(options)
    output.status('Redis', '已停止', '', { level: 'warning' })
    assert.doesNotMatch(lines.join('\n'), /\x1b/)
    assert.match(lines.join('\n'), /! Redis\s+已停止/)
  }
  const { output, lines } = capture({ isTTY: true })
  output.status('Redis', '已就绪', '127.0.0.1:6379', { level: 'success' })
  assert.match(lines.join('\n'), /\x1b\[32m/)
  assert.match(lines.join('\n'), /\x1b\[36m/)
})

test('live logs use short time while persisted logs keep ISO time, with neither secrets nor ANSI', () => {
  const { output, lines, retained } = capture({
    isTTY: true,
    environment: { DATABASE_PASSWORD: 'p@%' },
  })
  output.log(
    'server',
    '\x1b[31mBearer private-token postgres://user:p@%25@host/exre p%40%25\x1b[0m',
  )
  assert.match(redact(lines[0]), /^\d{2}:\d{2}:\d{2} \[server\]/)
  assert.match(retained[0], /^\d{4}-\d{2}-\d{2}T.* \[信息\] \[server\]/)
  assert.doesNotMatch(retained[0], /\x1b|private-token|p@%|p%40%25|postgres:\/\//)
  assert.doesNotMatch(lines[0], /private-token|p@%|p%40%25|postgres:\/\//)
})

test('errors show a readable reason, context and next step but hide untrusted exception messages', () => {
  const { output, lines, retained } = capture({
    isTTY: true,
    environment: { DATABASE_PASSWORD: 'private-password' },
  })
  output.failure(
    new RuntimeError('UPSTREAM_UNAVAILABLE', {
      reason: '无法连接上游服务',
      service: 'Docker',
      phase: '引擎连接失败',
      target: 'private-password',
      keys: ['DOCKER_HOST'],
      next: '检查 Docker Desktop/daemon 状态；执行 docker info',
    }),
  )
  const text = redact(lines.join('\n'))
  assert.match(text, /✗ Docker 无法连接上游服务/)
  assert.match(text, /错误码  UPSTREAM_UNAVAILABLE/)
  assert.match(text, /检查项  引擎连接失败/)
  assert.match(text, /配置键  DOCKER_HOST/)
  assert.match(text, /下一步\n  检查 Docker Desktop\/daemon 状态\n  执行 docker info/)
  assert.doesNotMatch(text, /private-password/)
  assert.ok(retained.every((line) => !line.includes('\x1b')))
  for (const error of [
    new Error('private-password'),
    { code: 'DOCKER_UNAVAILABLE', message: 'private-password' },
  ]) {
    const result = capture()
    result.output.failure(error)
    assert.doesNotMatch(result.lines.join('\n'), /private-password/)
    assert.match(result.lines.join('\n'), /下一步/)
  }
})

test('the real entry point writes grouped argument errors to redirected stderr and retains failure exit status', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./frontend.mjs', import.meta.url)), 'private-command'],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '', TERM: 'xterm-256color' },
    },
  )
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /✗.*\n\n.*检查项/)
  assert.match(result.stderr, /错误码  ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL/)
  assert.match(result.stderr, /下一步/)
  assert.doesNotMatch(result.stderr, /\x1b|private-command|Error:|at main/)
})

test('log colors follow severity, not error words in file names or informational task descriptions', () => {
  for (const [line, color] of [
    ['[frontend] page reload build/server/error.dev.html', 36],
    ['[backend] info: [task] Error file operations running longer than 12 hours...', 36],
    ['[backend] error: [database] connection failed', 31],
    ['[backend] warn: Running in development mode', 33],
    ['{"level":50,"msg":"database failed"}', 31],
    ['{"level":40,"msg":"parser not found"}', 33],
  ]) {
    const { output, lines } = capture({ isTTY: true })
    output.log('outline', line, 'stderr')
    assert.ok(lines[0].includes(`\x1b[${color}m[outline]`), line)
  }
})
