import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

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
