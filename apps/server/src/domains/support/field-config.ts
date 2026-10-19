import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { components } from '@workspace/sdk/types'
import {
  FIELD_IDS,
  FIELD_DEFINITIONS,
  parseSupportField,
} from '../../../../../scripts/support-field-definition.mjs'

export type FieldDefinition = components['schemas']['FeedbackFieldDefinition']
export { FIELD_IDS }
export function parseFieldDefinition(
  input: unknown,
  id: string,
  expectedType: 'drop_down' | 'text',
): FieldDefinition {
  return parseSupportField(input, id, expectedType)
}

export function loadFieldDefinitions(): FieldDefinition[] {
  const own = fileURLToPath(import.meta.url)
  const directory = dirname(own)
  const built = own.replaceAll('\\', '/').includes('/dist/')
  const base = built
    ? resolve(directory, '../../clickup-fields')
    : resolve(directory, '../../../../web/public/clickups/fields')
  return FIELD_DEFINITIONS.flatMap(({ id, type }) => {
    try {
      return [
        parseFieldDefinition(
          JSON.parse(readFileSync(resolve(base, `${id}.json`), 'utf8')) as unknown,
          id,
          type,
        ),
      ]
    } catch {
      return []
    }
  })
}
