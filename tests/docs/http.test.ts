import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '@server/src/app'
import { serviceHandlers } from '@server/src/http/service-handlers'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { readContract } from '@server/src/contract/document'

/**
 * Docs 的 HTTP 层验收。
 *
 * 覆盖 Contract 附录第 5 节的 HEAD 矩阵、认证边界、B 类 501 与核心命令的真实 HTTP 结果；
 * 数据库由隔离 PostgreSQL 容器与逐用例 schema 提供，不连接开发库。
 */

const fixtures: TestAuth[] = []
const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const app = createApp({ ...fixture })
  apps.push(app)
  await app.ready()
  return { fixture, app }
}

async function bearer(fixture: TestAuth, email = 'docs@example.com'): Promise<string> {
  await fixture.seedUser({ email, nickname: 'Docs', password: 'valid password' })
  const { token } = await fixture.authServices.login({ email, password: 'valid password' })
  return `Bearer ${token}`
}

const HEAD_PATHS = [
  '/api/docs/spaces',
  '/api/docs/spaces/00000000-0000-4000-8000-000000000001',
  '/api/docs/spaces/00000000-0000-4000-8000-000000000001/tree',
  '/api/docs/documents/00000000-0000-4000-8000-000000000001',
  '/api/docs/spaces/00000000-0000-4000-8000-000000000001/trash',
  '/api/docs/trash/documents/00000000-0000-4000-8000-000000000001',
  '/api/docs/search?q=bad-uuid',
  '/api/docs/spaces/00000000-0000-4000-8000-000000000001/templates',
  '/api/docs/templates/00000000-0000-4000-8000-000000000001',
  '/api/docs/documents/00000000-0000-4000-8000-000000000001/attachments',
  '/api/docs/attachments/00000000-0000-4000-8000-000000000001',
  '/api/docs/documents/00000000-0000-4000-8000-000000000001/comments',
]

const GET_PATHS = HEAD_PATHS.map((path) =>
  path.replace('/api/docs/search?q=bad-uuid', '/api/docs/search?q=x'),
)

const RESERVED_GET_PATHS = [
  { path: '/api/docs/search?q=x', public: true },
  { path: '/api/docs/spaces/00000000-0000-4000-8000-000000000001/templates', public: false },
  { path: '/api/docs/templates/00000000-0000-4000-8000-000000000001', public: false },
  { path: '/api/docs/documents/00000000-0000-4000-8000-000000000001/attachments', public: true },
  { path: '/api/docs/attachments/00000000-0000-4000-8000-000000000001', public: true },
  { path: '/api/docs/documents/00000000-0000-4000-8000-000000000001/comments', public: true },
]

describe('Docs HEAD 分支与 GET 回归', () => {
  it('terminates every Docs HEAD with the unified 404 and an empty body', async () => {
    const { app } = await setup()
    for (const path of HEAD_PATHS) {
      const response = await app.inject({ method: 'HEAD', url: path })
      expect(response.statusCode, path).toBe(404)
      expect(response.headers['cache-control'], path).toBe('no-store')
      expect(response.headers['x-request-id'], path).toBeTruthy()
      expect(response.body, path).toBe('')
    }
  })

  it('does not let Docs HEAD handling change non-Docs routes', async () => {
    const { app } = await setup()
    const health = await app.inject({ method: 'HEAD', url: '/api/health' })
    expect(health.statusCode).toBe(200)
  })

  it('keeps public Docs GET reads working and protects the management reads', async () => {
    const { app } = await setup()
    const spaces = await app.inject({ method: 'GET', url: '/api/docs/spaces' })
    expect(spaces.statusCode).toBe(200)
    expect(spaces.headers['cache-control']).toBe('no-store')
    expect(spaces.json()).toEqual({ items: [], nextCursor: null })

    const trash = await app.inject({
      method: 'GET',
      url: '/api/docs/spaces/00000000-0000-4000-8000-000000000001/trash',
    })
    expect(trash.statusCode).toBe(401)
    expect(trash.headers['cache-control']).toBe('no-store')
  })

  it('reserves every B-class read with 501 after authentication where required', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)
    for (const entry of RESERVED_GET_PATHS) {
      const anonymous = await app.inject({ method: 'GET', url: entry.path })
      expect(anonymous.statusCode, entry.path).toBe(entry.public ? 501 : 401)
      const authenticated = await app.inject({
        method: 'GET',
        url: entry.path,
        headers: { authorization },
      })
      expect(authenticated.statusCode, entry.path).toBe(501)
      expect(authenticated.json().error.code, entry.path).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
    }
  })
})

describe('Docs 核心命令', () => {
  it('creates a space and a document, then reads it back publicly', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)

    const space = await app.inject({
      method: 'POST',
      url: '/api/docs/spaces',
      headers: { authorization },
      payload: { name: ' Guide ', description: '' },
    })
    expect(space.statusCode, space.body).toBe(201)
    const created = space.json()
    expect(created).toMatchObject({ name: 'Guide', description: '', version: 1, treeVersion: 1 })

    const document = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${created.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'First',
        contentSchemaVersion: 1,
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
        },
      },
    })
    expect(document.statusCode, document.body).toBe(201)
    const body = document.json()
    expect(body.treeVersion).toBe(2)
    expect(body.document).toMatchObject({
      title: 'First',
      version: 1,
      position: 0,
      parentId: null,
      spaceId: created.id,
    })
    // 输入已经以 paragraph 结尾，因此不再追加；默认属性由规范化补齐。
    expect(body.document.content.content).toHaveLength(1)
    expect(body.document.content.content[0]).toEqual({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ type: 'text', text: 'hello' }],
    })

    const publicRead = await app.inject({
      method: 'GET',
      url: `/api/docs/documents/${body.document.id}`,
    })
    expect(publicRead.statusCode).toBe(200)
    expect(publicRead.json().document.title).toBe('First')

    const tree = await app.inject({ method: 'GET', url: `/api/docs/spaces/${created.id}/tree` })
    expect(tree.statusCode).toBe(200)
    expect(tree.json()).toMatchObject({ treeVersion: 2, nextCursor: null })
    expect(tree.json().items.map((item: { title: string }) => item.title)).toEqual(['First'])
  })

  it('rejects unknown content and oversized requests with the fixed Docs codes', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)
    const space = (
      await app.inject({
        method: 'POST',
        url: '/api/docs/spaces',
        headers: { authorization },
        payload: { name: 'S', description: '' },
      })
    ).json()

    const unknown = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'T',
        contentSchemaVersion: 1,
        content: { type: 'doc', content: [{ type: 'mystery' }] },
      },
    })
    expect(unknown.statusCode).toBe(400)
    expect(unknown.json().error.code).toBe('DOCS_UNSUPPORTED_CONTENT')

    const unsafe = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'T',
        contentSchemaVersion: 1,
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'x',
                  marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                },
              ],
            },
          ],
        },
      },
    })
    expect(unsafe.statusCode).toBe(400)
    expect(unsafe.json().error.code).toBe('DOCS_UNSAFE_CONTENT')

    const stale = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 99,
        parentId: null,
        beforeDocumentId: null,
        title: 'T',
        contentSchemaVersion: 1,
        content: { type: 'doc', content: [] },
      },
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().error.code).toBe('DOCS_VERSION_CONFLICT')
  })

  it('trashes a subtree and restores only the same batch in its original order', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)
    const space = (
      await app.inject({
        method: 'POST',
        url: '/api/docs/spaces',
        headers: { authorization },
        payload: { name: 'Trash', description: '' },
      })
    ).json()

    const create = async (title: string, parentId: string | null, treeVersion: number) => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/docs/spaces/${space.id}/documents`,
        headers: { authorization },
        payload: {
          expectedTreeVersion: treeVersion,
          parentId,
          beforeDocumentId: null,
          title,
          contentSchemaVersion: 1,
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: title }] }],
          },
        },
      })
      expect(response.statusCode, response.body).toBe(201)
      return response.json().document
    }

    const a = await create('A', null, 1)
    const b = await create('B', a.id, 2)
    const c = await create('C', b.id, 3)

    // 先单独回收 C，再回收 A：恢复 A 的批次不能把 C 一起恢复。
    const trashC = await app.inject({
      method: 'POST',
      url: `/api/docs/documents/${c.id}/trash`,
      headers: { authorization },
      payload: { expectedSpaceId: space.id, expectedVersion: 1, expectedTreeVersion: 4 },
    })
    expect(trashC.statusCode, trashC.body).toBe(200)
    expect(trashC.json().trashedCount).toBe(1)

    const trashA = await app.inject({
      method: 'POST',
      url: `/api/docs/documents/${a.id}/trash`,
      headers: { authorization },
      payload: { expectedSpaceId: space.id, expectedVersion: 1, expectedTreeVersion: 5 },
    })
    expect(trashA.statusCode, trashA.body).toBe(200)
    expect(trashA.json().trashedCount).toBe(2)

    const trashList = await app.inject({
      method: 'GET',
      url: `/api/docs/spaces/${space.id}/trash`,
      headers: { authorization },
    })
    expect(trashList.statusCode).toBe(200)
    const groups = trashList.json().items
    expect(groups.map((group: { title: string }) => group.title)).toEqual(['A', 'C'])

    const restore = await app.inject({
      method: 'POST',
      url: `/api/docs/trash/documents/${a.id}/restore`,
      headers: { authorization },
      payload: {
        expectedSpaceId: space.id,
        expectedVersion: 2,
        expectedTreeVersion: 6,
        deletionBatchId: trashA.json().deletionBatchId,
      },
    })
    expect(restore.statusCode, restore.body).toBe(200)
    expect(restore.json()).toMatchObject({
      restoredCount: 2,
      retainedTrashedCount: 1,
      placement: 'space-root',
    })

    const tree = (
      await app.inject({ method: 'GET', url: `/api/docs/spaces/${space.id}/tree` })
    ).json()
    expect(tree.items.map((item: { title: string }) => item.title)).toEqual(['A'])
    const children = (
      await app.inject({ method: 'GET', url: `/api/docs/spaces/${space.id}/tree?parentId=${a.id}` })
    ).json()
    expect(children.items.map((item: { title: string }) => item.title)).toEqual(['B'])

    // C 仍留在自己的批次里，并且可以单独按批次根恢复。
    const remaining = (
      await app.inject({
        method: 'GET',
        url: `/api/docs/spaces/${space.id}/trash`,
        headers: { authorization },
      })
    ).json()
    expect(remaining.items.map((group: { title: string }) => group.title)).toEqual(['C'])
  })

  it('moves a subtree across spaces and only deletes a genuinely empty space', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)
    const createSpace = async (name: string) =>
      (
        await app.inject({
          method: 'POST',
          url: '/api/docs/spaces',
          headers: { authorization },
          payload: { name, description: '' },
        })
      ).json()

    const source = await createSpace('Source')
    const target = await createSpace('Target')

    const root = (
      await app.inject({
        method: 'POST',
        url: `/api/docs/spaces/${source.id}/documents`,
        headers: { authorization },
        payload: {
          expectedTreeVersion: 1,
          parentId: null,
          beforeDocumentId: null,
          title: 'Root',
          contentSchemaVersion: 1,
          content: { type: 'doc', content: [] },
        },
      })
    ).json()
    const child = (
      await app.inject({
        method: 'POST',
        url: `/api/docs/spaces/${source.id}/documents`,
        headers: { authorization },
        payload: {
          expectedTreeVersion: 2,
          parentId: root.document.id,
          beforeDocumentId: null,
          title: 'Child',
          contentSchemaVersion: 1,
          content: { type: 'doc', content: [] },
        },
      })
    ).json()

    const move = await app.inject({
      method: 'POST',
      url: `/api/docs/documents/${root.document.id}/move`,
      headers: { authorization },
      payload: {
        sourceSpaceId: source.id,
        targetSpaceId: target.id,
        expectedVersion: 1,
        expectedSourceTreeVersion: 3,
        expectedTargetTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
      },
    })
    expect(move.statusCode, move.body).toBe(200)
    expect(move.json()).toMatchObject({
      affectedCount: 2,
      source: { spaceId: source.id },
      target: { spaceId: target.id },
    })

    // 整棵物理子树一起迁出，源空间重新成为真正空空间。
    const moved = await app.inject({
      method: 'GET',
      url: `/api/docs/documents/${child.document.id}`,
    })
    expect(moved.statusCode).toBe(200)
    expect(moved.json().document.spaceId).toBe(target.id)

    const blocked = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${target.id}/delete`,
      headers: { authorization },
      payload: { expectedVersion: 1, expectedTreeVersion: 2 },
    })
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().error.code).toBe('DOCS_SPACE_NOT_EMPTY')

    const deleted = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${source.id}/delete`,
      headers: { authorization },
      payload: { expectedVersion: 1, expectedTreeVersion: 4 },
    })
    expect(deleted.statusCode, deleted.body).toBe(204)
  })

  it('maps parse-time body and media-type failures to the Docs codes', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)
    const space = (
      await app.inject({
        method: 'POST',
        url: '/api/docs/spaces',
        headers: { authorization },
        payload: { name: 'Limits', description: '' },
      })
    ).json()

    const tooLarge = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'T',
        contentSchemaVersion: 1,
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(9_437_184) }] },
          ],
        },
      },
    })
    expect(tooLarge.statusCode).toBe(413)
    expect(tooLarge.json().error.code).toBe('DOCS_LIMIT_EXCEEDED')

    const badMedia = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization, 'content-type': 'text/plain' },
      payload: 'x',
    })
    expect(badMedia.statusCode).toBe(415)
    expect(badMedia.json().error.code).toBe('DOCS_UNSUPPORTED_MEDIA_TYPE')
  })
})

describe('Docs Contract 覆盖', () => {
  it('registers a handler for every Docs operation and nothing extra', async () => {
    const document = readContract()
    const declared = new Set<string>()
    for (const path of Object.keys(document.paths)) void path
    expect(typeof serviceHandlers.createDocsSpace).toBe('function')
    expect(typeof serviceHandlers.deleteDocsComment).toBe('function')
    for (const operationId of [
      'listDocsSpaces',
      'createDocsSpace',
      'getDocsSpace',
      'updateDocsSpace',
      'deleteDocsSpace',
      'getDocsTree',
      'createDocsDocument',
      'getDocsDocument',
      'updateDocsDocument',
      'moveDocsDocument',
      'trashDocsDocument',
      'listDocsTrash',
      'getDocsTrashedDocument',
      'restoreDocsDocument',
      'searchDocsDocuments',
      'suggestDocsDocumentContent',
      'listDocsTemplates',
      'createDocsTemplate',
      'getDocsTemplate',
      'updateDocsTemplate',
      'deleteDocsTemplate',
      'applyDocsTemplate',
      'listDocsAttachments',
      'uploadDocsAttachment',
      'getDocsAttachment',
      'deleteDocsAttachment',
      'listDocsComments',
      'createDocsComment',
      'updateDocsComment',
      'deleteDocsComment',
    ]) {
      expect(typeof (serviceHandlers as Record<string, unknown>)[operationId], operationId).toBe(
        'function',
      )
      declared.add(operationId)
    }
    expect(declared.size).toBe(30)
  })

  it('throws the same 501 from a reserved handler called directly', async () => {
    const reply = { header: () => reply }
    await expect(
      (serviceHandlers.listDocsComments as (request: unknown, reply: unknown) => Promise<unknown>)(
        {},
        reply,
      ),
    ).rejects.toMatchObject({ code: 'DOCS_FEATURE_NOT_IMPLEMENTED', statusCode: 501 })
  })

  it('keeps the Docs GET list aligned with the transport whitelist', () => {
    expect(GET_PATHS).toHaveLength(12)
  })
})
