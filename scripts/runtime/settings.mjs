import { existsSync, readFileSync } from 'node:fs'
import { dirname, delimiter } from 'node:path'
import { parseEnv } from 'node:util'
import { RuntimeError } from './output.mjs'

export const pick = (values, keys) =>
  Object.fromEntries(
    keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]),
  )
export function operatingEnvironment(inherited = process.env) {
  return pick(inherited, [
    'PATH',
    'Path',
    'SystemRoot',
    'SYSTEMROOT',
    'WINDIR',
    'COMSPEC',
    'ComSpec',
    'PATHEXT',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'LANG',
    'LC_ALL',
    'TERM',
    'COREPACK_HOME',
    'COREPACK_ENABLE_DOWNLOAD_PROMPT',
    'PNPM_HOME',
    'CI',
    'NO_COLOR',
    'FORCE_COLOR',
  ])
}
export function withNodePath(environment, node) {
  const path = Object.entries(environment).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
  return {
    ...Object.fromEntries(
      Object.entries(environment).filter(([key]) => key.toUpperCase() !== 'PATH'),
    ),
    PATH: `${dirname(node)}${delimiter}${path}`,
  }
}
export function environmentFile(path) {
  try {
    return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}
  } catch {
    throw new RuntimeError('ENV_INVALID', { keys: ['.env.local'] })
  }
}

export function publicSettings(values = {}) {
  const baseUrl = values.VITE_API_BASE_URL || '/'
  let api
  if (baseUrl !== '/') {
    try {
      api = new URL(baseUrl)
    } catch {}
    if (
      !api ||
      !/^https?:\/\//.test(baseUrl) ||
      api.username ||
      api.password ||
      /[?#\\\s]/.test(baseUrl) ||
      baseUrl.includes('@')
    )
      throw new RuntimeError('FRONTEND_API_BASE_URL_INVALID', {
        keys: ['VITE_API_BASE_URL'],
        reason: '前端服务根地址无效',
        next: '设置为 / 或完整 HTTP(S) 服务根地址，可包含部署前缀；旧 /api 必须显式改为 /',
      })
  }
  const php = values.PHP_SERVER_ORIGIN || 'http://127.0.0.1:8787'
  let target
  try {
    target = new URL(php)
  } catch {}
  if (!target || !/^https?:\/\/[^/\s\\?#@]+\/?$/.test(php) || target.username || target.password)
    throw new RuntimeError('PHP_SERVER_ORIGIN_INVALID', {
      keys: ['PHP_SERVER_ORIGIN'],
      reason: 'PHP 代理目标必须是 HTTP(S) origin',
      next: '例如 http://127.0.0.1:8787；不能包含凭据、路径、query 或 hash',
    })
  return { VITE_API_BASE_URL: baseUrl, PHP_SERVER_ORIGIN: target.origin }
}
