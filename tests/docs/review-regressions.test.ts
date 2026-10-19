import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '@server/src/app'
import type { FastifyInstance } from 'fastify'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'
import { assertKnownContentShape } from '@server/src/domains/docs/content/validation'
import { DocsService } from '@server/src/domains/docs/service'
import type { AppDatabase, SqlExecutor } from '@server/src/db/client'

const fixtures: TestAuth[] = []
const apps: FastifyInstance[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const CONTENT = validateDocsContent({ type: 'doc', content: [] }).content

function invalidCursorId(cursor: string): string {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >
  return Buffer.from(JSON.stringify({ ...payload, id: 'not-a-uuid' })).toString('base64url')
}

async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const actor = await fixture.seedUser({
    email: 'docs-review@example.com',
    nickname: 'Review',
    password: 'valid password',
  })
  return { fixture, service: fixture.docsServices, actor }
}

describe('Docs reviewed tree invariants', () => {
  it('queries metadata without selecting rich content for navigation and relocation', async () => {
    const { fixture, service, actor } = await setup()
    const space = await service.createSpace({ name: 'Projection', description: '' }, actor)
    const root = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Root',
        content: CONTENT,
      },
      actor,
    )
    const child = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 2,
        parentId: root.document.id,
        beforeDocumentId: null,
        title: 'Child',
        content: CONTENT,
      },
      actor,
    )
    const selects: string[] = []
    const record = (tx: SqlExecutor): SqlExecutor => ({
      query: async (sql, values) => {
        if (/^\s*(SELECT|WITH)/i.test(sql)) selects.push(sql)
        return tx.query(sql, values)
      },
    })
    const observedDb: AppDatabase = {
      ...record(fixture.db),
      transaction: (run, mode) => fixture.db.transaction((tx) => run(record(tx)), mode),
      close: async () => {},
    }
    const observedService = new DocsService({ db: observedDb, now: fixture.now })
    await observedService.getTree(space.id, {})
    await observedService.getTree(space.id, { parentId: root.document.id })
    await observedService.moveDocument(
      child.document.id,
      {
        sourceSpaceId: space.id,
        targetSpaceId: space.id,
        expectedVersion: 1,
        expectedSourceTreeVersion: 3,
        expectedTargetTreeVersion: 3,
        parentId: null,
        beforeDocumentId: null,
      },
      actor,
    )
    expect(selects.length).toBeGreaterThan(0)
    expect(selects.filter((sql) => /\b(content|text_content)\b/i.test(sql))).toEqual([])
    await observedService.getDocument(child.document.id)
    expect(selects.some((sql) => /\bcontent\b/.test(sql))).toBe(true)
  })

  it('rejects a physical cycle as corrupt and rolls back the attempted move', async () => {
    const { fixture, service, actor } = await setup()
    const source = await service.createSpace({ name: 'Cycle source', description: '' }, actor)
    const target = await service.createSpace({ name: 'Cycle target', description: '' }, actor)
    const a = await service.createDocument(
      source.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'A',
        content: CONTENT,
      },
      actor,
    )
    const b = await service.createDocument(
      source.id,
      {
        expectedTreeVersion: 2,
        parentId: a.document.id,
        beforeDocumentId: null,
        title: 'B',
        content: CONTENT,
      },
      actor,
    )
    await fixture.db.query('UPDATE docs_documents SET parent_id = $2 WHERE id = $1', [
      a.document.id,
      b.document.id,
    ])
    const short = new DocsService({
      db: fixture.db,
      now: fixture.now,
      timeouts: {
        metadata: { lockTimeoutMs: 500, statementTimeoutMs: 1000 },
        content: { lockTimeoutMs: 500, statementTimeoutMs: 1000 },
        tree: { lockTimeoutMs: 500, statementTimeoutMs: 1000 },
      },
    })
    await expect(
      short.moveDocument(
        a.document.id,
        {
          sourceSpaceId: source.id,
          targetSpaceId: target.id,
          expectedVersion: 1,
          expectedSourceTreeVersion: 3,
          expectedTargetTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR', statusCode: 500 })
    const rows = await fixture.db.query<{ space_id: string }>(
      'SELECT space_id FROM docs_documents WHERE id = ANY($1::uuid[])',
      [[a.document.id, b.document.id]],
    )
    expect(rows.rows.map((row) => row.space_id)).toEqual([source.id, source.id])
  })

  it('rejects an existing 65-level physical subtree as corrupt without trashing it', async () => {
    const { fixture, service, actor } = await setup()
    const space = await service.createSpace({ name: 'Overdeep', description: '' }, actor)
    const ids = Array.from(
      { length: 65 },
      (_entry, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    )
    const parents = ids.map((_id, index) => (index === 0 ? null : ids[index - 1]))
    await fixture.db.query(
      `INSERT INTO docs_documents
       (id, space_id, parent_id, position, title, content_schema_version, content, text_content,
        version, created_at, updated_at, created_by_user_id, updated_by_user_id)
       SELECT input.id, $3, input.parent_id, 0, 'Deep', 1, $4::jsonb, '',
              1, $5, $5, $6, $6
       FROM unnest($1::uuid[], $2::uuid[]) AS input(id, parent_id)`,
      [ids, parents, space.id, JSON.stringify(CONTENT), fixture.now(), actor],
    )
    await expect(service.getDocument(ids[64]!)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    })
    await expect(
      service.trashDocument(
        ids[0]!,
        {
          expectedSpaceId: space.id,
          expectedVersion: 1,
          expectedTreeVersion: 1,
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR', statusCode: 500 })
    const rows = await fixture.db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM docs_documents WHERE deleted_at IS NOT NULL AND space_id = $1',
      [space.id],
    )
    expect(Number(rows.rows[0]!.count)).toBe(0)
  })

  it('preserves Unicode code-point limits and description round trips over HTTP', async () => {
    const { fixture } = await setup()
    const app = createApp({ ...fixture })
    apps.push(app)
    await app.ready()
    const { token } = await fixture.authServices.login({
      email: 'docs-review@example.com',
      password: 'valid password',
    })
    const headers = { authorization: `Bearer ${token}` }
    const name = '😀'.repeat(51)
    const description = '😀'.repeat(1001)
    const spaceResponse = await app.inject({
      method: 'POST',
      url: '/api/docs/spaces',
      headers,
      payload: { name, description },
    })
    expect(spaceResponse.statusCode, spaceResponse.body).toBe(201)
    const space = spaceResponse.json()
    expect(space.name).toBe(name)
    expect(space.description).toBe(description)
    const title = '😀'.repeat(101)
    const docResponse = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers,
      payload: {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title,
        contentSchemaVersion: 1,
        content: CONTENT,
      },
    })
    expect(docResponse.statusCode, docResponse.body).toBe(201)
    const read = await app.inject({
      method: 'GET',
      url: `/api/docs/documents/${docResponse.json().document.id}`,
    })
    expect(read.statusCode, read.body).toBe(200)
    expect(read.json().document.title).toBe(title)
    const spaceRead = await app.inject({ method: 'GET', url: `/api/docs/spaces/${space.id}` })
    expect(spaceRead.json().description).toBe(description)
    for (const payload of [
      { name: '😀'.repeat(101), description: '' },
      { name: 'Valid', description: '😀'.repeat(2001) },
    ]) {
      const rejected = await app.inject({
        method: 'POST',
        url: '/api/docs/spaces',
        headers,
        payload,
      })
      expect(rejected.statusCode).toBe(400)
    }
    const tooLongTitle = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers,
      payload: {
        expectedTreeVersion: 2,
        parentId: null,
        beforeDocumentId: null,
        title: '😀'.repeat(201),
        contentSchemaVersion: 1,
        content: CONTENT,
      },
    })
    expect(tooLongTitle.statusCode).toBe(400)
  })

  it('returns invalid move for a missing or wrong-space write parent over HTTP', async () => {
    const { fixture, service, actor } = await setup()
    const source = await service.createSpace({ name: 'Source', description: '' }, actor)
    const target = await service.createSpace({ name: 'Target', description: '' }, actor)
    const created = await service.createDocument(
      source.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Root',
        content: CONTENT,
      },
      actor,
    )
    const app = createApp({ ...fixture })
    apps.push(app)
    await app.ready()
    const { token } = await fixture.authServices.login({
      email: 'docs-review@example.com',
      password: 'valid password',
    })
    const authorization = `Bearer ${token}`
    const missing = '00000000-0000-4000-8000-000000000099'
    const create = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${target.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 1,
        parentId: missing,
        beforeDocumentId: null,
        title: 'Child',
        contentSchemaVersion: 1,
        content: CONTENT,
      },
    })
    expect(create.statusCode, create.body).toBe(409)
    expect(create.json().error.code).toBe('DOCS_INVALID_MOVE')
    const move = await app.inject({
      method: 'POST',
      url: `/api/docs/documents/${created.document.id}/move`,
      headers: { authorization },
      payload: {
        sourceSpaceId: source.id,
        targetSpaceId: target.id,
        expectedVersion: 1,
        expectedSourceTreeVersion: 2,
        expectedTargetTreeVersion: 1,
        parentId: created.document.id,
        beforeDocumentId: null,
      },
    })
    expect(move.statusCode, move.body).toBe(409)
    expect(move.json().error.code).toBe('DOCS_INVALID_MOVE')
  })

  it('returns a fixed 500 for corrupted stored trash content', async () => {
    const { fixture, service, actor } = await setup()
    const space = await service.createSpace({ name: 'Corruption', description: '' }, actor)
    const created = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Corrupt me',
        content: CONTENT,
      },
      actor,
    )
    await service.trashDocument(
      created.document.id,
      {
        expectedSpaceId: space.id,
        expectedVersion: 1,
        expectedTreeVersion: 2,
      },
      actor,
    )
    await fixture.db.query('UPDATE docs_documents SET content = $2::jsonb WHERE id = $1', [
      created.document.id,
      JSON.stringify({ type: 'doc', content: [{ type: 'secret-invalid-node' }] }),
    ])
    await expect(service.getTrashedDocument(created.document.id)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    })
    const app = createApp({ ...fixture })
    apps.push(app)
    await app.ready()
    const { token } = await fixture.authServices.login({
      email: 'docs-review@example.com',
      password: 'valid password',
    })
    const response = await app.inject({
      method: 'GET',
      url: `/api/docs/trash/documents/${created.document.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode, response.body).toBe(500)
    expect(response.json().error.code).toBe('INTERNAL_ERROR')
    expect(response.body).not.toContain('secret-invalid-node')
  })

  it('moves within one parent with one version increment per changed row', async () => {
    const { service, actor } = await setup()
    const space = await service.createSpace({ name: 'Order', description: '' }, actor)
    let treeVersion = space.treeVersion
    const docs = []
    for (const title of ['A', 'B', 'C', 'D']) {
      const created = await service.createDocument(
        space.id,
        {
          expectedTreeVersion: treeVersion,
          parentId: null,
          beforeDocumentId: null,
          title,
          content: CONTENT,
        },
        actor,
      )
      treeVersion = created.treeVersion
      docs.push(created.document)
    }
    const moved = await service.moveDocument(
      docs[0]!.id,
      {
        sourceSpaceId: space.id,
        targetSpaceId: space.id,
        expectedVersion: docs[0]!.version,
        expectedSourceTreeVersion: treeVersion,
        expectedTargetTreeVersion: treeVersion,
        parentId: null,
        beforeDocumentId: docs[3]!.id,
      },
      actor,
    )
    const page = await service.getTree(space.id, {})
    expect(page.items.map((row) => [row.title, row.position, row.version])).toEqual([
      ['B', 0, 2],
      ['C', 1, 2],
      ['A', 2, 2],
      ['D', 3, 1],
    ])
    expect(moved.version).toBe(2)
    expect(moved.affectedCount).toBe(3)
    expect(moved.source.treeVersion).toBe(treeVersion + 1)
    expect(moved.target.treeVersion).toBe(treeVersion + 1)
  })

  it('moves backward and preserves unchanged sibling versions on a no-op placement', async () => {
    const { service, actor } = await setup()
    const space = await service.createSpace({ name: 'Backward', description: '' }, actor)
    let treeVersion = 1
    const docs = []
    for (const title of ['A', 'B', 'C', 'D']) {
      const created = await service.createDocument(
        space.id,
        {
          expectedTreeVersion: treeVersion,
          parentId: null,
          beforeDocumentId: null,
          title,
          content: CONTENT,
        },
        actor,
      )
      treeVersion = created.treeVersion
      docs.push(created.document)
    }
    const moved = await service.moveDocument(
      docs[3]!.id,
      {
        sourceSpaceId: space.id,
        targetSpaceId: space.id,
        expectedVersion: 1,
        expectedSourceTreeVersion: treeVersion,
        expectedTargetTreeVersion: treeVersion,
        parentId: null,
        beforeDocumentId: docs[1]!.id,
      },
      actor,
    )
    expect(moved.version).toBe(2)
    expect(moved.affectedCount).toBe(3)
    const noop = await service.moveDocument(
      docs[0]!.id,
      {
        sourceSpaceId: space.id,
        targetSpaceId: space.id,
        expectedVersion: 1,
        expectedSourceTreeVersion: moved.source.treeVersion,
        expectedTargetTreeVersion: moved.target.treeVersion,
        parentId: null,
        beforeDocumentId: docs[3]!.id,
      },
      actor,
    )
    expect(noop.version).toBe(2)
    expect(noop.affectedCount).toBe(1)
    expect(noop.source.treeVersion).toBe(moved.source.treeVersion + 1)
    expect(
      (await service.getTree(space.id, {})).items.map((row) => [
        row.title,
        row.position,
        row.version,
      ]),
    ).toEqual([
      ['A', 0, 2],
      ['D', 1, 2],
      ['B', 2, 2],
      ['C', 3, 2],
    ])
  })

  it('changes a root position across parents and spaces only once per command', async () => {
    const { service, actor } = await setup()
    const source = await service.createSpace({ name: 'From', description: '' }, actor)
    const target = await service.createSpace({ name: 'To', description: '' }, actor)
    let sourceVersion = 1
    const sourceDocs = []
    for (const title of ['Parent', 'Move', 'Sibling']) {
      const created = await service.createDocument(
        source.id,
        {
          expectedTreeVersion: sourceVersion,
          parentId: null,
          beforeDocumentId: null,
          title,
          content: CONTENT,
        },
        actor,
      )
      sourceVersion = created.treeVersion
      sourceDocs.push(created.document)
    }
    const targetDoc = await service.createDocument(
      target.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Target',
        content: CONTENT,
      },
      actor,
    )
    const within = await service.moveDocument(
      sourceDocs[1]!.id,
      {
        sourceSpaceId: source.id,
        targetSpaceId: source.id,
        expectedVersion: 1,
        expectedSourceTreeVersion: sourceVersion,
        expectedTargetTreeVersion: sourceVersion,
        parentId: sourceDocs[0]!.id,
        beforeDocumentId: null,
      },
      actor,
    )
    expect(within.version).toBe(2)
    expect(
      (await service.getTree(source.id, { parentId: sourceDocs[0]!.id })).items[0],
    ).toMatchObject({ position: 0, version: 2 })
    const across = await service.moveDocument(
      sourceDocs[1]!.id,
      {
        sourceSpaceId: source.id,
        targetSpaceId: target.id,
        expectedVersion: within.version,
        expectedSourceTreeVersion: within.source.treeVersion,
        expectedTargetTreeVersion: targetDoc.treeVersion,
        parentId: null,
        beforeDocumentId: null,
      },
      actor,
    )
    expect(across.version).toBe(3)
    expect(across.source.treeVersion).toBe(within.source.treeVersion + 1)
    expect(across.target.treeVersion).toBe(targetDoc.treeVersion + 1)
    expect(
      (await service.getTree(target.id, {})).items.map((row) => [
        row.title,
        row.position,
        row.version,
      ]),
    ).toEqual([
      ['Target', 0, 1],
      ['Move', 1, 3],
    ])
  })

  it('restores an appended root with the reported version equal to stored version', async () => {
    const { service, actor } = await setup()
    const space = await service.createSpace({ name: 'Restore', description: '' }, actor)
    const first = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'First',
        content: CONTENT,
      },
      actor,
    )
    const second = await service.createDocument(
      space.id,
      {
        expectedTreeVersion: 2,
        parentId: null,
        beforeDocumentId: null,
        title: 'Second',
        content: CONTENT,
      },
      actor,
    )
    const trashed = await service.trashDocument(
      first.document.id,
      {
        expectedSpaceId: space.id,
        expectedVersion: 1,
        expectedTreeVersion: 3,
      },
      actor,
    )
    const restored = await service.restoreDocument(
      first.document.id,
      {
        expectedSpaceId: space.id,
        expectedVersion: 2,
        expectedTreeVersion: trashed.treeVersion,
        deletionBatchId: trashed.deletionBatchId,
      },
      actor,
    )
    const page = await service.getTree(space.id, {})
    expect(page.items.map((row) => [row.title, row.version, row.position])).toEqual([
      ['Second', second.document.version + 1, 0],
      ['First', restored.version, 1],
    ])
    expect(restored.version).toBe(3)
  })
})

describe('Docs content depth', () => {
  it('accepts marked and unmarked depth-32 HTTP content and rejects depth 33', async () => {
    const { fixture, service, actor } = await setup()
    const space = await service.createSpace({ name: 'Deep content', description: '' }, actor)
    const app = createApp({ ...fixture })
    apps.push(app)
    await app.ready()
    const { token } = await fixture.authServices.login({
      email: 'docs-review@example.com',
      password: 'valid password',
    })
    const content = (quoteCount: number, marked: boolean) => {
      let node: Record<string, unknown> = {
        type: 'text',
        text: 'x',
        ...(marked ? { marks: [{ type: 'bold' }] } : {}),
      }
      node = { type: 'paragraph', content: [node] }
      for (let i = 0; i < quoteCount; i += 1) node = { type: 'blockquote', content: [node] }
      return { type: 'doc', content: [node] }
    }
    for (const [index, marked] of [false, true].entries()) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/docs/spaces/${space.id}/documents`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          expectedTreeVersion: index + 1,
          parentId: null,
          beforeDocumentId: null,
          title: `Deep ${index}`,
          contentSchemaVersion: 1,
          content: content(30, marked),
        },
      })
      expect(response.statusCode, response.body).toBe(201)
    }
    const over = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        expectedTreeVersion: 3,
        parentId: null,
        beforeDocumentId: null,
        title: 'Too deep',
        contentSchemaVersion: 1,
        content: content(31, true),
      },
    })
    expect(over.statusCode, over.body).toBe(413)
    expect(over.json().error.code).toBe('DOCS_LIMIT_EXCEEDED')
  })

  it('counts content nodes through depth 32 and does not count a mark as a node', () => {
    const deep = (marked: boolean) => {
      let node: Record<string, unknown> = { type: 'text', text: 'x' }
      if (marked) node = { ...node, marks: [{ type: 'bold' }] }
      node = { type: 'paragraph', content: [node] }
      for (let i = 0; i < 30; i += 1) node = { type: 'blockquote', content: [node] }
      return { type: 'doc', content: [node] }
    }
    expect(() => assertKnownContentShape(deep(false))).not.toThrow()
    expect(() => assertKnownContentShape(deep(true))).not.toThrow()
    const beyond = { type: 'doc', content: [{ type: 'blockquote', content: deep(true).content }] }
    expect(() => assertKnownContentShape(beyond)).toThrowError(
      expect.objectContaining({ code: 'DOCS_LIMIT_EXCEEDED' }),
    )
  })
})
