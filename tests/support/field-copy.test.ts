import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  cpSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { copySupportFields } from '../../scripts/copy-support-fields.mjs'
import { FIELD_DEFINITIONS, parseSupportField } from '../../scripts/support-field-definition.mjs'
import { parseFieldDefinition } from '@server/src/domains/support/field-config'

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

it('validates every option before copying any packaged field', () => {
  const dir = mkdtempSync(join(tmpdir(), 'support-fields-'))
  temps.push(dir)
  const source = join(dir, 'source'),
    target = join(dir, 'target')
  cpSync(resolve('apps/web/public/clickups/fields'), source, { recursive: true })
  const id = '4c3befc0-5146-43a2-8610-86efe4e8124a'
  const file = join(source, `${id}.json`)
  const valid = JSON.parse(readFileSync(file, 'utf8'))
  const badCases = [
    {
      ...valid,
      type_config: { options: [...valid.type_config.options, { ...valid.type_config.options[0] }] },
    },
    {
      ...valid,
      type_config: {
        options: [
          ...valid.type_config.options,
          { ...valid.type_config.options[0], id: '11111111-1111-4111-8111-111111111111' },
        ],
      },
    },
    { ...valid, type_config: { options: [{ ...valid.type_config.options[0], orderindex: -1 }] } },
  ]
  for (const bad of badCases) {
    writeFileSync(file, JSON.stringify(bad))
    expect(() => copySupportFields(source, target)).toThrow()
    expect(existsSync(target)).toBe(false)
  }
  writeFileSync(file, JSON.stringify(valid))
  copySupportFields(source, target)
  expect(readdirSync(target).sort()).toEqual(readdirSync(source).sort())
})

it('uses one normalized field definition for packaging and server loading', () => {
  for (const { id, type } of FIELD_DEFINITIONS) {
    const raw = JSON.parse(
      readFileSync(resolve('apps/web/public/clickups/fields', `${id}.json`), 'utf8'),
    )
    expect(parseSupportField(raw, id, type)).toEqual(parseFieldDefinition(raw, id, type))
    for (const invalid of [
      { ...raw, type: 'wrong' },
      { ...raw, id: 'wrong' },
    ]) {
      expect(() => parseSupportField(invalid, id, type)).toThrow('Invalid support field')
      expect(() => parseFieldDefinition(invalid, id, type)).toThrow('Invalid support field')
    }
  }
})
