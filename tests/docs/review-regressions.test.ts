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
