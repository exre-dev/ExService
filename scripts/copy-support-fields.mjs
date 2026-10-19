import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIELD_DEFINITIONS, parseSupportField } from './support-field-definition.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function copySupportFields(source, target) {
  // Validation completes for all three fields before creating the target directory.
  for (const { id, type } of FIELD_DEFINITIONS)
    parseSupportField(JSON.parse(readFileSync(resolve(source, `${id}.json`), 'utf8')), id, type)
  mkdirSync(target, { recursive: true })
  for (const { id } of FIELD_DEFINITIONS)
    copyFileSync(resolve(source, `${id}.json`), resolve(target, `${id}.json`))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  copySupportFields(
    resolve(root, 'apps/web/public/clickups/fields'),
    resolve(root, 'apps/server/dist/clickup-fields'),
  )
}
