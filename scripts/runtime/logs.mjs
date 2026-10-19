import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { RuntimeError, redact } from './output.mjs'

/** Bounded per-process JSONL logs; no raw child output or secrets reach retained files. */
export function logWriter(
  file,
  { maxBytes = 10 * 1024 * 1024, retain = 5, environment = {} } = {},
) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1024 ||
    !Number.isSafeInteger(retain) ||
    retain < 1 ||
    retain > 20
  )
    throw new RuntimeError('LOG_BOUNDS_INVALID', {
      keys: ['RUNTIME_LOG_MAX_BYTES', 'RUNTIME_LOG_RETAIN'],
    })
  mkdirSync(dirname(file), { recursive: true })
  return (service, message, level = 'info') => {
    const event = {
      time: new Date().toISOString(),
      level: String(level).slice(0, 32),
      service: String(service).slice(0, 64),
      message: redact(message, environment).slice(0, Math.floor(maxBytes / 4)),
    }
    let line = JSON.stringify(event) + '\n'
    while (Buffer.byteLength(line) > maxBytes) {
      event.message = event.message.slice(0, Math.floor(event.message.length / 2))
      line = JSON.stringify(event) + '\n'
    }
    if (existsSync(file) && statSync(file).size + Buffer.byteLength(line) > maxBytes) {
      if (existsSync(`${file}.${retain}`)) unlinkSync(`${file}.${retain}`)
      for (let index = retain - 1; index >= 1; index--)
        if (existsSync(`${file}.${index}`)) renameSync(`${file}.${index}`, `${file}.${index + 1}`)
      renameSync(file, `${file}.1`)
    }
    appendFileSync(file, line, { mode: 0o600 })
  }
}
