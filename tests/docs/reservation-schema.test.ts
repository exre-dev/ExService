import { afterEach, describe, expect, it } from 'vitest'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'

/**
 * B 类三张新表的迁移约束验收。
 *
 * 只证明 migration 0004 建立的外键、CHECK 与唯一约束真的在数据库里生效，
 * 以及模板行出现后会自动阻止空空间删除；不写任何业务实现。
 * 数据库使用隔离 PostgreSQL 的逐用例 schema，迁移由 `isolatedPostgres` 施加。
 */

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const CONTENT = validateDocsContent({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
}).content

const SPACE = '00000000-0000-4000-8000-000000000001'
const DOCUMENT = '00000000-0000-4000-8000-000000000002'
const TEMPLATE = '00000000-0000-4000-8000-000000000003'
const MISSING = '00000000-0000-4000-8000-000000000099'

async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const actor = await fixture.seedUser({
    email: 'docs-schema@example.com',
    nickname: 'Schema',
    password: 'valid password',
  })
  await fixture.db.query(
    `INSERT INTO docs_spaces (id, name, description, version, tree_version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, 'Space', '', 1, 1, 1, 1, $2, $2)`,
    [SPACE, actor],
  )
  await fixture.db.query(
    `INSERT INTO docs_documents (id, space_id, parent_id, position, title, content_schema_version, content, text_content,
      version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, NULL, 0, 'Doc', 1, $3::jsonb, 'x', 1, 1, 1, $4, $4)`,
    [DOCUMENT, SPACE, JSON.stringify(CONTENT), actor],
  )
  return { fixture, actor }
}

async function insertSpace(fixture: TestAuth, actor: string, id: string) {
  await fixture.db.query(
    `INSERT INTO docs_spaces (id, name, description, version, tree_version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, 'Space', '', 1, 1, 1, 1, $2, $2)`,
    [id, actor],
  )
}

async function insertTemplate(fixture: TestAuth, actor: string, id: string, spaceId: string) {
  await fixture.db.query(
    `INSERT INTO docs_templates (id, space_id, name, content_schema_version, content, version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, 'Template', 1, $3::jsonb, 1, 1, 1, $4, $4)`,
    [id, spaceId, JSON.stringify(CONTENT), actor],
  )
}

async function insertComment(
  fixture: TestAuth,
  actor: string,
  id: string,
  body: string,
  documentId = DOCUMENT,
) {
  await fixture.db.query(
    `INSERT INTO docs_comments (id, document_id, body, version, created_at, updated_at, created_by_user_id, updated_by_user_id)
     VALUES ($1, $2, $3, 1, 1, 1, $4, $4)`,
    [id, documentId, body, actor],
  )
}

async function insertAttachment(
  fixture: TestAuth,
  actor: string,
  id: string,
  overrides: {
    medium?: string
    sha256?: string
    byteSize?: number
    documentId?: string
    storageKey?: string
  } = {},
) {
  await fixture.db.query(
    `INSERT INTO docs_attachments (id, document_id, medium, storage_key, file_name, content_type, byte_size, sha256, created_at, created_by_user_id)
     VALUES ($1, $2, $3, $4, 'note.txt', 'text/plain', $5, $6, 1, $7)`,
    [
      id,
      overrides.documentId ?? DOCUMENT,
      overrides.medium ?? 'file',
      overrides.storageKey ?? `docs/${DOCUMENT}/${id}`,
      overrides.byteSize ?? 5,
      overrides.sha256 ?? 'a'.repeat(64),
      actor,
    ],
  )
}

/** 捕获 PostgreSQL 错误码，避免把猜测的常量写进断言。 */
async function errorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    return String((error as { code?: unknown }).code)
  }
  throw new Error('Expected the statement to be rejected')
}

describe('B 类三张表的外键与约束真实生效', () => {
  it('rejects rows whose owner does not exist', async () => {
    const { fixture, actor } = await setup()
    // 23503：外键指向不存在的空间或文档。
    expect(await errorCode(() => insertTemplate(fixture, actor, TEMPLATE, MISSING))).toBe('23503')
    expect(await errorCode(() => insertComment(fixture, actor, TEMPLATE, 'note', MISSING))).toBe(
      '23503',
    )
    expect(
      await errorCode(() => insertAttachment(fixture, actor, TEMPLATE, { documentId: MISSING })),
    ).toBe('23503')
  })

  it('enforces the attachment medium, sha256, byte size and object uniqueness', async () => {
    const { fixture, actor } = await setup()
    const id = '00000000-0000-4000-8000-000000000010'
    // 23514：CHECK 约束。
    expect(await errorCode(() => insertAttachment(fixture, actor, id, { medium: 's3' }))).toBe(
      '23514',
    )
    expect(
      await errorCode(() => insertAttachment(fixture, actor, id, { sha256: 'A'.repeat(64) })),
    ).toBe('23514')
    expect(await errorCode(() => insertAttachment(fixture, actor, id, { sha256: 'abc' }))).toBe(
      '23514',
    )
    expect(await errorCode(() => insertAttachment(fixture, actor, id, { byteSize: 0 }))).toBe(
      '23514',
    )
    expect(
      await errorCode(() =>
        insertAttachment(fixture, actor, id, { byteSize: 9_007_199_254_740_992 }),
      ),
    ).toBe('23514')

    await insertAttachment(fixture, actor, id)
    // 23505：同一介质的同一对象只能被一条附件记录引用。
    expect(
      await errorCode(() =>
        insertAttachment(fixture, actor, '00000000-0000-4000-8000-000000000011', {
          storageKey: `docs/${DOCUMENT}/${id}`,
        }),
      ),
    ).toBe('23505')
    // 不同 storage_key 可以共存，唯一键不是"一篇文档只有一个附件"。
    await insertAttachment(fixture, actor, '00000000-0000-4000-8000-000000000012')
  })

  it('bounds the comment body and keeps comments document-scoped', async () => {
    const { fixture, actor } = await setup()
    expect(await errorCode(() => insertComment(fixture, actor, TEMPLATE, ''))).toBe('23514')
    expect(await errorCode(() => insertComment(fixture, actor, TEMPLATE, 'x'.repeat(10_001)))).toBe(
      '23514',
    )
    await insertComment(fixture, actor, TEMPLATE, 'x'.repeat(10_000))
    const { rows } = await fixture.db.query('SELECT body FROM docs_comments WHERE id = $1', [
      TEMPLATE,
    ])
    expect(rows[0]!.body).toHaveLength(10_000)
    // 评论只按文档 ID 归属：表里没有空间、选区、段落、锚点或父评论列。
    const columns = await fixture.db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'docs_comments'`,
    )
    expect(columns.rows.map((row) => row.column_name).sort()).toEqual([
      'body',
      'created_at',
      'created_by_user_id',
      'document_id',
      'id',
      'updated_at',
      'updated_by_user_id',
      'version',
    ])
  })

  it('refuses to delete a referenced space or document', async () => {
    const { fixture, actor } = await setup()
    await insertTemplate(fixture, actor, TEMPLATE, SPACE)
    await insertComment(fixture, actor, '00000000-0000-4000-8000-000000000010', 'note')
    // RESTRICT 外键：被引用的空间与文档都不能先删。
    expect(
      await errorCode(() => fixture.db.query('DELETE FROM docs_spaces WHERE id = $1', [SPACE])),
    ).toBe('23001')
    expect(
      await errorCode(() =>
        fixture.db.query('DELETE FROM docs_documents WHERE id = $1', [DOCUMENT]),
      ),
    ).toBe('23001')
  })

  it('blocks empty-space deletion once a template row exists', async () => {
    const { fixture, actor } = await setup()
    const empty = '00000000-0000-4000-8000-000000000020'
    const withTemplate = '00000000-0000-4000-8000-000000000021'
    await insertSpace(fixture, actor, empty)
    await insertSpace(fixture, actor, withTemplate)
    await insertTemplate(fixture, actor, TEMPLATE, withTemplate)

    // 真正的空空间照常删除。
    await fixture.docsServices.deleteSpace(
      empty,
      { expectedVersion: 1, expectedTreeVersion: 1 },
      actor,
    )
    expect(
      (
        await fixture.db.query('SELECT count(*)::integer AS n FROM docs_spaces WHERE id = $1', [
          empty,
        ])
      ).rows,
    ).toEqual([{ n: 0 }])

    // 没有文档但有模板行：模板表在 0004 建立后自动参与条件，调用方无需改动。
    await expect(
      fixture.docsServices.deleteSpace(
        withTemplate,
        { expectedVersion: 1, expectedTreeVersion: 1 },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'DOCS_SPACE_NOT_EMPTY' })
    expect(
      (
        await fixture.db.query('SELECT count(*)::integer AS n FROM docs_spaces WHERE id = $1', [
          withTemplate,
        ])
      ).rows,
    ).toEqual([{ n: 1 }])
  })
})
