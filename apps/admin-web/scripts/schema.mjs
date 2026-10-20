import { readFile, writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

// Explicit tooling only. Build and typecheck consume the committed output.
const source = new URL('../../php-server/api/internal/openapi.yaml', import.meta.url)
const output = new URL('../src/api/schema.d.ts', import.meta.url)
const generated = astToString(await openapiTS(source))
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== generated) {
    throw new Error('Admin PHP contract types are stale; run api:generate in apps/admin-web')
  }
} else {
  await writeFile(output, generated)
}
