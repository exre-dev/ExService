import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { root, assertInstalledExui } from './shared.mjs'

export class LocalError extends Error {
  constructor(code, next = 'check the root .env.local configuration') {
    super(`${code}; next: ${next}`)
    this.code = code
  }
}
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value
export const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(canonical(value)))
    .digest('hex')
export function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  renameSync(temporary, path)
}
export function readJson(path, code = 'LOCAL_CONFIG_INVALID') {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new LocalError(code)
  }
}
export function toolchain({ workspace = root, inherited = process.env } = {}) {
  const node = inherited.INTEGRATION_NODE_BIN || process.execPath
  const corepack =
    inherited.INTEGRATION_COREPACK_JS ||
    join(dirname(process.execPath), 'node_modules/corepack/dist/corepack.js')
  if (!existsSync(node) || !existsSync(corepack))
    throw new LocalError(
      'LOCAL_TOOLS_MISSING',
      'set INTEGRATION_NODE_BIN / INTEGRATION_COREPACK_JS',
    )
  const version = spawnSync(node, ['--version'], { encoding: 'utf8', shell: false })
  const [major, minor] = (version.stdout?.trim().replace(/^v/, '') ?? '').split('.').map(Number)
  if (version.status !== 0 || major < 22 || (major === 22 && minor < 12))
    throw new LocalError('LOCAL_NODE_UNSUPPORTED', 'use Node >=22.12.0')
  if (!existsSync(join(workspace, 'node_modules')))
    throw new LocalError('LOCAL_DEPENDENCIES_MISSING', 'pnpm install')
  try {
    assertInstalledExui(workspace)
  } catch {
    throw new LocalError('LOCAL_EXUI_ARTIFACTS_MISSING', 'pnpm install; use the registry package')
  }
  return Object.freeze({ node, corepack })
}
