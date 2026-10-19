import { open } from 'node:fs/promises'
import { assertCliEntry, openDatabase } from '../db/client.js'
import { assertDatabaseReady } from '../db/schema-check.js'
import { readClickUpConfig } from '../modules/clickup/config.js'
import { createClickUpServices } from '../modules/clickup/factory.js'
import { createSupportMaintenance } from '../domains/support/maintenance.js'
assertCliEntry(import.meta.url)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
async function boundedFile(path: string, max: number): Promise<Buffer> {
  const handle = await open(path, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > max) throw new Error('Invalid input file')
    const buffer = Buffer.alloc(max + 1)
    let length = 0
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null)
      if (!read.bytesRead) break
      length += read.bytesRead
    }
    if (length > max) throw new Error('Input file too large')
    return buffer.subarray(0, length)
  } finally {
    await handle.close()
  }
}
async function main() {
  const [command, ...args] = process.argv.slice(2).filter((a) => a !== '--')
  const flags = new Map<string, string | true>()
  for (let index = 0; index < args.length; index++) {
    const key = args[index]!
    if (!key.startsWith('--') || flags.has(key)) throw new Error('Invalid arguments')
    if (['--confirm', '--apply'].includes(key)) flags.set(key, true)
    else {
      const value = args[++index]
      if (!value || value.startsWith('--')) throw new Error('Missing argument')
      flags.set(key, value)
    }
  }
  const allowed: Record<string, string[]> = {
    inspect: ['--submission-id', '--remote-task-id'],
    'resolve-task': ['--submission-id', '--attempt-id', '--remote-task-id', '--confirm'],
    'resolve-attachment': [
      '--submission-id',
      '--attachment-id',
      '--attempt-id',
      '--remote-attachment-id',
      '--downloaded-file',
      '--confirm',
    ],
    'confirm-not-written': ['--submission-id', '--attempt-id', '--evidence-file', '--confirm'],
    'cleanup-expired': ['--before', '--apply', '--confirm'],
  }
  if (
    !command ||
    !allowed[command] ||
    [...flags.keys()].some((f) => !allowed[command]!.includes(f))
  )
    throw new Error('Invalid command')
  const value = (key: string): string => {
    const v = flags.get(`--${key}`)
    if (typeof v !== 'string') throw new Error('Missing argument')
    if (
      key.endsWith('-id') &&
      ['submission-id', 'attachment-id', 'attempt-id'].includes(key) &&
      !uuid.test(v)
    )
      throw new Error('Invalid UUID')
    return v
  }
  const config = readClickUpConfig(process.env),
    db = await openDatabase()
  try {
    await assertDatabaseReady(db)
    const m = createSupportMaintenance({
      db,
      clickup: createClickUpServices(config),
      secrets: config.kind === 'enabled' ? [config.token] : [],
    })
    let result: unknown
    if (command === 'inspect')
      result = await m.inspect(
        value('submission-id'),
        flags.has('--remote-task-id') ? value('remote-task-id') : undefined,
      )
    else if (command === 'resolve-task')
      result = await m.resolveTask(
        value('submission-id'),
        value('attempt-id'),
        value('remote-task-id'),
        flags.has('--confirm'),
      )
    else if (command === 'resolve-attachment') {
      const bytes = await boundedFile(value('downloaded-file'), 20971520)
      result = await m.resolveAttachment(
        value('submission-id'),
        value('attachment-id'),
        value('attempt-id'),
        value('remote-attachment-id'),
        bytes,
        flags.has('--confirm'),
      )
    } else if (command === 'confirm-not-written') {
      const bytes = await boundedFile(value('evidence-file'), 4096)
      result = await m.confirmNotWritten(
        value('submission-id'),
        value('attempt-id'),
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
        flags.has('--confirm'),
      )
    } else {
      const text = value('before'),
        before = /^\d+$/.test(text) ? Number(text) : Date.parse(text)
      result = await m.cleanupExpired(before, flags.has('--apply'), flags.has('--confirm'))
    }
    console.log(JSON.stringify(result))
  } finally {
    await db.close()
  }
}
try {
  await main()
} catch {
  console.error('[support-feedback] 操作失败；请核对命令、数据库准备状态与核对证据。')
  process.exitCode = 1
}
