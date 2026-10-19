#!/usr/bin/env node
// Read-only ClickUp field discovery. Node 22+, no additional dependencies.
// API reference: https://developer.clickup.com/reference/getaccessiblecustomfields
import { readFile, writeFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const defaultListUrl = 'https://app.clickup.com/90181517066/v/l/li/901810170816'
const args = process.argv.slice(2)
const rootEnvPath = fileURLToPath(new URL('../../.env.local', import.meta.url))
let token

function listIdFrom(input) {
  if (/^\d+$/.test(input)) return input
  const url = new URL(input)
  const match = url.pathname.match(/\/li\/(\d+)\/?$/)
  if (url.protocol !== 'https:' || url.hostname !== 'app.clickup.com' || !match) {
    throw new Error('Expected a ClickUp List URL or numeric List ID.')
  }
  return match[1]
}

async function get(path) {
  const response = await fetch(`https://api.clickup.com/api/v2${path}`, {
    method: 'GET',
    headers: { Authorization: token, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    // Do not echo response bodies or request headers containing credentials.
    throw new Error(`ClickUp GET ${path}: HTTP ${response.status}`)
  }
  return response.json()
}

async function main() {
  if (args.includes('--help')) {
    console.log(
      'Usage: node scripts/probes/clickup-fields.mjs [list-url-or-id] [--out output.json]',
    )
    console.log(
      'Reads CLICKUP_TOKEN from the repository root .env.local; performs only GET requests.',
    )
    return
  }
  let listInput = defaultListUrl
  let hasListInput = false
  let outputPath
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--out') {
      outputPath = args[++index]
      if (!outputPath || outputPath.startsWith('--')) throw new Error('--out requires a file path.')
    } else if (!args[index].startsWith('--') && !hasListInput) {
      listInput = args[index]
      hasListInput = true
    } else {
      throw new Error('Unknown argument. Use --help for usage.')
    }
  }

  const listId = listIdFrom(listInput)
  token = parseEnv(await readFile(rootEnvPath, 'utf8')).CLICKUP_TOKEN?.trim()
  if (!token) throw new Error('CLICKUP_TOKEN is missing from the repository root .env.local.')

  const [list, customFields] = await Promise.all([
    get(`/list/${listId}`),
    get(`/list/${listId}/field?include_applied_objects=true`),
  ])
  if (String(list.id) !== listId || !Array.isArray(customFields.fields)) {
    throw new Error('Unexpected ClickUp List or Custom Fields response shape.')
  }

  // Inspect field names only, without printing task content or field values.
  let taskKeys = []
  let sampledTaskCount = 0
  const warnings = []
  try {
    const sample = await get(
      `/list/${listId}/task?page=0&include_closed=true&subtasks=true&include_timl=true`,
    )
    if (!Array.isArray(sample.tasks)) throw new Error('Unexpected ClickUp tasks response shape.')
    sampledTaskCount = sample.tasks.length
    taskKeys = [...new Set(sample.tasks.flatMap((task) => Object.keys(task)))].sort()
  } catch (error) {
    warnings.push(`Task field sampling failed: ${error.message}`)
  }

  const report = {
    fetchedAt: new Date().toISOString(),
    list: { id: list.id, name: list.name, taskCount: list.task_count, statuses: list.statuses },
    customFieldCount: customFields.fields.length,
    customFields: customFields.fields,
    taskFieldSample: {
      page: 0,
      sampledTaskCount,
      keys: taskKeys,
      note: 'Observed top-level keys only; at most 100 tasks, not an exhaustive task schema. No task values included.',
    },
    warnings,
  }
  // Redact even if an API response unexpectedly contains the token.
  const json = JSON.stringify(report, null, 2).replaceAll(token, '[REDACTED]')
  if (outputPath) await writeFile(outputPath, `${json}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log(json)
}

main().catch((error) => {
  const message = token ? error.message.replaceAll(token, '[REDACTED]') : error.message
  console.error(`ClickUp probe failed: ${message}`)
  process.exitCode = 1
})
