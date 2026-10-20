import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readContract } from '@server/src/contract/document'
import {
  DOCS_MARK_NAMES,
  DOCS_NODE_NAMES,
  docsSchema,
} from '@server/src/domains/docs/content/schema'
import {
  ADMONITION_TYPES,
  CELL_ALIGNMENTS,
  DOCS_CONTENT_LIMITS,
  ORDERED_LIST_TYPES,
  TEXT_ALIGNMENTS,
} from '@server/src/domains/docs/content/policy'

/**
 * Contract 与领域内独立维护的 policy 之间的一致性验收。
 *
 * Contract 的 Tiptap union 与 Server 的 `docsSchema` 是两份独立产物：前者由
 * `api/schemas/docs.yaml` 生成，后者在 `content/schema.ts` 手写维护。两者失配不会让
 * 任何现有检查失败，因此这里逐项比对，把"等价"变成门禁而不是约定。
 * 预算一侧同理：Contract wire 上限、`DOCS_CONTENT_LIMITS` 与数据库 CHECK 约束
 * 是三个独立来源，必须互相一致。
 */

interface ContractSchema {
  type?: unknown
  const?: unknown
  enum?: unknown[]
  properties?: Record<string, ContractSchema>
  required?: string[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  oneOf?: Array<{ $ref?: string }>
}

type ContractDocument = {
  paths: Record<
    string,
    Record<string, { 'x-fastify-config'?: { docs?: { kind?: string; wireBytes?: number } } }>
  >
  components: { schemas: Record<string, ContractSchema> }
}

const contract = readContract() as unknown as ContractDocument
const schemas = contract.components.schemas

function branchName(branch: { $ref?: string }): string {
  const name = branch.$ref?.split('/').at(-1)
  if (!name) throw new Error(`Contract union branch is not a reference: ${JSON.stringify(branch)}`)
  return name
}

/** 解析 union 的每个分支，返回 `类型名 -> 分支 schema`。 */
function unionMembers(schemaName: string): Map<string, ContractSchema> {
  const branches = schemas[schemaName]?.oneOf
  if (!branches?.length) throw new Error(`Contract ${schemaName} has no oneOf branches`)
  const members = new Map<string, ContractSchema>()
  for (const branch of branches) {
    const name = branchName(branch)
    const resolved = schemas[name]
    if (!resolved) throw new Error(`Contract branch ${name} is not defined`)
    const declared = resolved.properties?.type?.const
    if (typeof declared !== 'string') throw new Error(`Contract branch ${name} has no const type`)
    const expected = name
      .replace(/^DocsTiptap(Mark)?/, '')
      .replace(/^./, (char) => char.toLowerCase())
    if (declared !== expected)
      throw new Error(`Contract branch ${name} declares type ${declared}, expected ${expected}`)
    members.set(declared, resolved)
  }
  return members
}

const nodes = unionMembers('DocsTiptapNode')
const marks = unionMembers('DocsTiptapMark')

/** Contract 声明的 attrs 键；未声明 attrs 的节点视为空集合。 */
function contractAttrs(schema: ContractSchema): string[] {
  return Object.keys(schema.properties?.attrs?.properties ?? {})
}

function serverAttrs(name: string): string[] {
  return Object.keys(docsSchema.nodes[name]?.spec.attrs ?? docsSchema.marks[name]?.spec.attrs ?? {})
}

function enumValues(owner: string, attr: string): unknown[] {
  const values = (nodes.get(owner) ?? marks.get(owner))?.properties?.attrs?.properties?.[attr]?.enum
  if (!values) throw new Error(`Contract ${owner}.${attr} has no enum`)
  return values
}

const migration = readFileSync(
  fileURLToPath(new URL('../../apps/server/drizzle/0006_docs_core.sql', import.meta.url)),
  'utf8',
)

function checkConstraint(name: string): string {
  const match = new RegExp(
    `CONSTRAINT "${name}" CHECK \\(([\\s\\S]*?)\\)\\s*(?:,\\s*\\n|\\n\\);)`,
  ).exec(migration)
  if (!match) throw new Error(`Migration is missing ${name}`)
  return match[1]!.replace(/\s+/g, ' ')
}

describe('Contract 与 docsSchema 的类型集合一致', () => {
  it('declares exactly the same node and mark names as the server schema', () => {
    // `doc` 是持久 JSON 的根节点，不是出现在 content 里的分支。
    expect([...nodes.keys()].sort()).toEqual(
      [...DOCS_NODE_NAMES].filter((name) => name !== 'doc').sort(),
    )
    expect([...marks.keys()].sort()).toEqual([...DOCS_MARK_NAMES].sort())
    expect(nodes.size).toBe(23)
    expect(marks.size).toBe(8)
    expect(docsSchema.topNodeType.name).toBe('doc')
  })

  it('declares the same attribute keys for every node and mark', () => {
    for (const [name, schema] of nodes) {
      expect(contractAttrs(schema).sort(), `node ${name}`).toEqual(serverAttrs(name).sort())
    }
    for (const [name, schema] of marks) {
      expect(contractAttrs(schema).sort(), `mark ${name}`).toEqual(serverAttrs(name).sort())
    }
  })
})

describe('Contract 的有限值域与 policy 常量一致', () => {
  it('uses the same enumerations as the independently maintained policy', () => {
    const nullable = (values: readonly string[]) => [...values, null]
    expect(enumValues('paragraph', 'textAlign').sort()).toEqual(nullable(TEXT_ALIGNMENTS).sort())
    expect(enumValues('heading', 'textAlign').sort()).toEqual(nullable(TEXT_ALIGNMENTS).sort())
    expect(enumValues('tableCell', 'align').sort()).toEqual(nullable(CELL_ALIGNMENTS).sort())
    expect(enumValues('tableHeader', 'align').sort()).toEqual(nullable(CELL_ALIGNMENTS).sort())
    expect(enumValues('admonition', 'type')).toEqual([...ADMONITION_TYPES])
    expect(enumValues('orderedList', 'type').sort()).toEqual(nullable(ORDERED_LIST_TYPES).sort())
    // heading.level 只允许 1–4，与 profile 1 的自研 heading 一致。
    expect(enumValues('heading', 'level')).toEqual([1, 2, 3, 4])
  })

  it('keeps the span, dimension and numeric budgets aligned with the policy', () => {
    const cell = nodes.get('tableCell')!.properties!.attrs!.properties!
    expect(cell.colspan).toMatchObject({ minimum: 1, maximum: DOCS_CONTENT_LIMITS.span })
    expect(cell.rowspan).toMatchObject({ minimum: 1, maximum: DOCS_CONTENT_LIMITS.span })
    expect(cell.colwidth).toMatchObject({
      items: { minimum: 0, maximum: DOCS_CONTENT_LIMITS.dimension },
    })
    const image = nodes.get('image')!.properties!.attrs!.properties!
    expect(image.width).toMatchObject({ minimum: 1, maximum: DOCS_CONTENT_LIMITS.dimension })
    expect(image.height).toMatchObject({ minimum: 1, maximum: DOCS_CONTENT_LIMITS.dimension })
  })
})

describe('wire 预算、内容预算与数据库约束三者一致', () => {
  it('derives the content wire budget from the same Contract and keeps it above the content budget', () => {
    const budgets = new Set<number>()
    for (const item of Object.values(contract.paths)) {
      for (const operation of Object.values(item)) {
        const docs = operation?.['x-fastify-config']?.docs
        if (docs?.kind === 'content' && typeof docs.wireBytes === 'number')
          budgets.add(docs.wireBytes)
      }
    }
    expect([...budgets]).toEqual([9_437_184])
    // 9 MiB wire 必须容得下 8 MiB 内容预算加上 JSON 转义与信封开销。
    expect(9_437_184).toBeGreaterThan(DOCS_CONTENT_LIMITS.bytes)
    expect(DOCS_CONTENT_LIMITS.bytes).toBe(8 * 1024 * 1024)
  })

  it('matches the Contract field limits in the database CHECK constraints', () => {
    expect(schemas.DocsTitle).toMatchObject({ minLength: 1, maxLength: 200 })
    expect(schemas.DocsSpaceName).toMatchObject({ minLength: 1, maxLength: 100 })
    expect(schemas.DocsDescription).toMatchObject({ minLength: 0, maxLength: 2000 })
    expect(schemas.DocsContentSchemaVersion).toMatchObject({ const: 1 })

    expect(checkConstraint('docs_documents_title_check')).toBe(
      'char_length("docs_documents"."title") between 1 and 200',
    )
    expect(checkConstraint('docs_documents_content_schema_version_check')).toBe(
      '"docs_documents"."content_schema_version" = 1',
    )
    expect(checkConstraint('docs_documents_text_content_check')).toBe(
      `octet_length("docs_documents"."text_content") <= ${DOCS_CONTENT_LIMITS.bytes}`,
    )
    expect(checkConstraint('docs_spaces_name_check')).toBe(
      'char_length("docs_spaces"."name") between 1 and 100',
    )
    expect(checkConstraint('docs_spaces_description_check')).toBe(
      'char_length("docs_spaces"."description") <= 2000',
    )
    // 内容列只接受规范化后的 doc 根节点，与 `validateDocsContent` 的输出形状同源。
    expect(checkConstraint('docs_documents_content_check')).toBe(
      'jsonb_typeof("docs_documents"."content") = \'object\' and "docs_documents"."content" ->> \'type\' = \'doc\'',
    )
  })
})
