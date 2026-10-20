import { readdirSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '@server/src/app'
import { serviceHandlers } from '@server/src/http/service-handlers'
import { readContract } from '@server/src/contract/document'
import { validateDocsContent } from '@server/src/domains/docs/content/validation'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { multipartBody, type TestPart } from '@tests/helpers/multipart'
import {
  createAppWithStorage,
  fileStorageFixture,
  type StorageTestFixture,
} from '@tests/helpers/storage'

/**
 * Docs B 类预留（Stage 3）的验收。
 *
 * B 类 operation 全部登记在唯一 Contract 上并带有真实 handler，合法请求一律返回
 * 501 `DOCS_FEATURE_NOT_IMPLEMENTED`：不返回空列表、假成功写入或模拟 AI 建议。
 * 本文件证明三件事——预留集合由 Contract 自身界定、每个预留都走统一 envelope 与
 * no-store、以及调用它们不产生任何业务写入。
 */

const fixtures: TestAuth[] = []
const apps: FastifyInstance[] = []
const storages: StorageTestFixture[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
  for (const storage of storages.splice(0)) storage.cleanup()
})

const CONTENT = validateDocsContent({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
}).content

const SPACE_ID = '00000000-0000-4000-8000-000000000001'
const DOCUMENT_ID = '00000000-0000-4000-8000-000000000002'
const TEMPLATE_ID = '00000000-0000-4000-8000-000000000003'
const ATTACHMENT_ID = '00000000-0000-4000-8000-000000000004'
const COMMENT_ID = '00000000-0000-4000-8000-000000000005'

interface ReservedCase {
  operationId: string
  method: 'GET' | 'POST' | 'PUT'
  url: string
  /** 合法请求体；`undefined` 表示不接受请求体。 */
  payload?: Record<string, unknown>
  /** 公开 operation：匿名也走 501，不要求会话。 */
  public?: boolean
  /** multipart 请求；上传入口不消费正文，但仍要按封闭 schema 校验。 */
  multipart?: TestPart[]
}

const attachmentParts = (extra: TestPart[] = []): TestPart[] => [
  { name: 'fileName', contentType: 'text/plain', bytes: Buffer.from('note.txt') },
  { name: 'contentType', contentType: 'text/plain', bytes: Buffer.from('text/plain') },
  { name: 'expectedSpaceId', contentType: 'text/plain', bytes: Buffer.from(SPACE_ID) },
  { name: 'expectedDocumentVersion', contentType: 'text/plain', bytes: Buffer.from('1') },
  {
    name: 'data',
    contentType: 'application/octet-stream',
    filename: 'note.txt',
    bytes: Buffer.from('hello'),
  },
  ...extra,
]

/** 16 个 B 类 operation；`public` 与传输层的公开清单一致。 */
const RESERVED: ReservedCase[] = [
  { operationId: 'searchDocsDocuments', method: 'GET', url: '/api/docs/search?q=x', public: true },
  {
    operationId: 'suggestDocsDocumentContent',
    method: 'POST',
    url: `/api/docs/documents/${DOCUMENT_ID}/ai-suggestions`,
    payload: { expectedSpaceId: SPACE_ID, baseVersion: 1, instruction: 'tighten the wording' },
  },
  {
    operationId: 'listDocsTemplates',
    method: 'GET',
    url: `/api/docs/spaces/${SPACE_ID}/templates`,
  },
  {
    operationId: 'createDocsTemplate',
    method: 'POST',
    url: `/api/docs/spaces/${SPACE_ID}/templates`,
    payload: { name: 'Template', contentSchemaVersion: 1, content: CONTENT },
  },
  { operationId: 'getDocsTemplate', method: 'GET', url: `/api/docs/templates/${TEMPLATE_ID}` },
  {
    operationId: 'updateDocsTemplate',
    method: 'PUT',
    url: `/api/docs/templates/${TEMPLATE_ID}`,
    payload: {
      expectedSpaceId: SPACE_ID,
      expectedVersion: 1,
      name: 'Template',
      contentSchemaVersion: 1,
      content: CONTENT,
    },
  },
  {
    operationId: 'deleteDocsTemplate',
    method: 'POST',
    url: `/api/docs/templates/${TEMPLATE_ID}/delete`,
    payload: { expectedSpaceId: SPACE_ID, expectedVersion: 1 },
  },
  {
    operationId: 'applyDocsTemplate',
    method: 'POST',
    url: `/api/docs/documents/${DOCUMENT_ID}/apply-template`,
    payload: {
      expectedSpaceId: SPACE_ID,
      expectedVersion: 1,
      templateId: TEMPLATE_ID,
      expectedTemplateVersion: 1,
    },
  },
  {
    operationId: 'listDocsAttachments',
    method: 'GET',
    url: `/api/docs/documents/${DOCUMENT_ID}/attachments`,
    public: true,
  },
  {
    operationId: 'uploadDocsAttachment',
    method: 'POST',
    url: `/api/docs/documents/${DOCUMENT_ID}/attachments`,
    multipart: attachmentParts(),
  },
  {
    operationId: 'getDocsAttachment',
    method: 'GET',
    url: `/api/docs/attachments/${ATTACHMENT_ID}`,
    public: true,
  },
  {
    operationId: 'deleteDocsAttachment',
    method: 'POST',
    url: `/api/docs/attachments/${ATTACHMENT_ID}/delete`,
    payload: { expectedSpaceId: SPACE_ID, expectedDocumentVersion: 1 },
  },
  {
    operationId: 'listDocsComments',
    method: 'GET',
    url: `/api/docs/documents/${DOCUMENT_ID}/comments`,
    public: true,
  },
  {
    operationId: 'createDocsComment',
    method: 'POST',
    url: `/api/docs/documents/${DOCUMENT_ID}/comments`,
    payload: { expectedSpaceId: SPACE_ID, body: 'A whole-document note.' },
  },
  {
    operationId: 'updateDocsComment',
    method: 'PUT',
    url: `/api/docs/comments/${COMMENT_ID}`,
    payload: { expectedSpaceId: SPACE_ID, expectedVersion: 1, body: 'Revised note.' },
  },
  {
    operationId: 'deleteDocsComment',
    method: 'POST',
    url: `/api/docs/comments/${COMMENT_ID}/delete`,
    payload: { expectedSpaceId: SPACE_ID, expectedVersion: 1 },
  },
]

interface ContractDocument {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId?: string
        responses?: Record<string, unknown>
        'x-fastify-config'?: { docs?: { kind?: string } }
      }
    >
  >
}

/** 预留集合由 Contract 自身界定：只有 B 类声明了 501 响应。 */
function reservedOperationIds(): string[] {
  const contract = readContract() as unknown as ContractDocument
  const reserved: string[] = []
  for (const path of Object.keys(contract.paths).filter((name) => name.startsWith('/docs'))) {
    for (const operation of Object.values(contract.paths[path]!)) {
      if (!operation?.operationId) continue
      if (Object.hasOwn(operation.responses ?? {}, '501')) reserved.push(operation.operationId)
    }
  }
  return reserved.sort()
}

async function setup() {
  const fixture = await createTestAuth()
  fixtures.push(fixture)
  const storage = fileStorageFixture()
  storages.push(storage)
  const app = createAppWithStorage(fixture, storage.storage)
  apps.push(app)
  await app.ready()
  await fixture.seedUser({
    email: 'docs-reserved@example.com',
    nickname: 'Reserved',
    password: 'valid password',
  })
  const { token } = await fixture.authServices.login({
    email: 'docs-reserved@example.com',
    password: 'valid password',
  })
  return { app, authorization: `Bearer ${token}`, storage }
}

const DOCS_TABLES = [
  'docs_spaces',
  'docs_documents',
  'docs_templates',
  'docs_attachments',
  'docs_comments',
] as const

describe('Docs B 类预留集合由 Contract 界定', () => {
  it('is exactly the 16 operations that declare a 501 response, with no core operation among them', () => {
    expect(reservedOperationIds()).toEqual(RESERVED.map((entry) => entry.operationId).sort())
    expect(reservedOperationIds()).toHaveLength(16)
  })

  it('registers a real handler for every reserved operation', () => {
    const handlers = serviceHandlers as Record<string, unknown>
    for (const { operationId } of RESERVED) {
      expect(typeof handlers[operationId], operationId).toBe('function')
    }
  })
})

describe('Docs B 类真实 HTTP：501、no-store 与认证', () => {
  it('answers every reserved operation with the fixed 501 and no-store', async () => {
    const { app, authorization } = await setup()
    for (const entry of RESERVED) {
      const body = entry.multipart
        ? multipartBody(entry.multipart)
        : { headers: {}, payload: entry.payload }
      const response = await app.inject({
        method: entry.method,
        url: entry.url,
        headers: { authorization, ...body.headers },
        ...(body.payload === undefined ? {} : { payload: body.payload }),
      })
      expect(response.statusCode, `${entry.operationId} ${response.body}`).toBe(501)
      expect(response.json().error.code, entry.operationId).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
      expect(response.headers['cache-control'], entry.operationId).toBe('no-store')
      // 501 不是空 body 的成功响应：统一 envelope 始终带 requestId。
      expect(response.json().error.requestId, entry.operationId).toBeTruthy()
    }
  })

  it('rejects anonymous callers with 401 before reaching the reservation', async () => {
    const { app } = await setup()
    for (const entry of RESERVED) {
      const body = entry.multipart
        ? multipartBody(entry.multipart)
        : { headers: {}, payload: entry.payload }
      const response = await app.inject({
        method: entry.method,
        url: entry.url,
        headers: body.headers,
        ...(body.payload === undefined ? {} : { payload: body.payload }),
      })
      // 公开 operation 匿名仍然 501；受保护的先被认证拦下。
      expect(response.statusCode, entry.operationId).toBe(entry.public ? 501 : 401)
    }
  })

  it('still validates the request schema before returning the reservation', async () => {
    const { app, authorization } = await setup()
    for (const entry of RESERVED) {
      if (entry.payload === undefined) continue
      const response = await app.inject({
        method: entry.method,
        url: entry.url,
        headers: { authorization },
        payload: { ...entry.payload, unexpectedField: 'x' },
      })
      // 预留不是兜底：额外字段由 Contract schema 拒绝，不会拿到 501。
      expect(response.statusCode, `${entry.operationId} ${response.body}`).toBe(400)
      expect(response.json().error.code, entry.operationId).toBe('BAD_REQUEST')
    }
  })
})

describe('Docs 评论与附件的字段边界', () => {
  it('rejects every selection, paragraph, anchor and thread field on comments', async () => {
    const { app, authorization } = await setup()
    const rejected = ['selection', 'range', 'paragraphId', 'anchor', 'position', 'parentCommentId']
    for (const field of rejected) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/docs/documents/${DOCUMENT_ID}/comments`,
        headers: { authorization },
        payload: { expectedSpaceId: SPACE_ID, body: 'note', [field]: 'from-0-to-10' },
      })
      expect(response.statusCode, `${field} ${response.body}`).toBe(400)
      expect(response.json().error.code).toBe('BAD_REQUEST')
    }
    // 纯文本正文仍然保留字面内容，不作为 HTML。
    const valid = await app.inject({
      method: 'POST',
      url: `/api/docs/documents/${DOCUMENT_ID}/comments`,
      headers: { authorization },
      payload: { expectedSpaceId: SPACE_ID, body: '<b>not html</b>' },
    })
    expect(valid.statusCode, valid.body).toBe(501)
  })

  it('closes the attachment upload schema against caller-supplied storage identity', () => {
    // 预留上传本期刻意不读取或验证 multipart 正文，因此"调用方不能提交 medium/key/url/ticket"
    // 由 Contract 的封闭 schema 界定，是后续实现必须遵守的接缝，不是本期运行时拒绝。
    const contract = readContract() as unknown as {
      components: {
        schemas: Record<
          string,
          {
            additionalProperties?: boolean
            required?: string[]
            properties?: Record<string, unknown>
          }
        >
      }
    }
    const schema = contract.components.schemas.DocsAttachmentUploadRequest!
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual([
      'data',
      'fileName',
      'contentType',
      'expectedSpaceId',
      'expectedDocumentVersion',
    ])
    for (const forbidden of ['medium', 'key', 'url', 'ticket']) {
      expect(Object.hasOwn(schema.properties ?? {}), forbidden).toBe(false)
    }
  })

  it('never inspects the upload payload, so extra parts cannot change the reservation', async () => {
    const { app, authorization } = await setup()
    for (const field of ['medium', 'key', 'url', 'ticket']) {
      const body = multipartBody(
        attachmentParts([
          { name: field, contentType: 'text/plain', bytes: Buffer.from('attacker-supplied') },
        ]),
      )
      const response = await app.inject({
        method: 'POST',
        url: `/api/docs/documents/${DOCUMENT_ID}/attachments`,
        headers: { authorization, ...body.headers },
        payload: body.payload,
      })
      // 正文没有被读取：多出来的 part 既不会被接受为归属证明，也拿不到别的响应。
      expect(response.statusCode, `${field} ${response.body}`).toBe(501)
      expect(response.json().error.code).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
    }
  })

  it('closes the connection on the reserved upload without consuming the payload', async () => {
    const { app, authorization } = await setup()
    const body = multipartBody(attachmentParts())
    const response = await app.inject({
      method: 'POST',
      url: `/api/docs/documents/${DOCUMENT_ID}/attachments`,
      headers: { authorization, ...body.headers },
      payload: body.payload,
    })
    expect(response.statusCode, response.body).toBe(501)
    expect(response.headers.connection).toBe('close')
    expect(response.headers['cache-control']).toBe('no-store')
  })
})

describe('Docs 预留不产生任何副作用', () => {
  it('writes no Docs row and no storage object while exercising every reserved operation', async () => {
    const fixture = await createTestAuth()
    fixtures.push(fixture)
    const storage = fileStorageFixture()
    storages.push(storage)
    const app = createAppWithStorage(fixture, storage.storage)
    apps.push(app)
    await app.ready()
    await fixture.seedUser({
      email: 'docs-noeffect@example.com',
      nickname: 'NoEffect',
      password: 'valid password',
    })
    const { token } = await fixture.authServices.login({
      email: 'docs-noeffect@example.com',
      password: 'valid password',
    })
    const authorization = `Bearer ${token}`

    const before: Record<string, number> = {}
    for (const table of DOCS_TABLES)
      before[table] = Number(
        (await fixture.db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0]!.n,
      )

    for (const entry of RESERVED) {
      const body = entry.multipart
        ? multipartBody(entry.multipart)
        : { headers: {}, payload: entry.payload }
      await app.inject({
        method: entry.method,
        url: entry.url,
        headers: { authorization, ...body.headers },
        ...(body.payload === undefined ? {} : { payload: body.payload }),
      })
    }

    for (const table of DOCS_TABLES) {
      const after = Number(
        (await fixture.db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0]!.n,
      )
      expect(after, table).toBe(before[table])
    }
    // 存储介质上没有留下任何对象：上传入口不写字节（模块自建的目录不算对象）。
    const written = readdirSync(storage.dataRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
    expect(written).toEqual([])
  })

  it('throws the same reservation from every raw handler without touching the database', async () => {
    const fixture = await createTestAuth()
    fixtures.push(fixture)
    for (const entry of RESERVED) {
      const headers: Record<string, string> = {}
      const reply = {
        header(name: string, value: string) {
          headers[name.toLowerCase()] = value
          return reply
        },
      }
      // 受保护的 operation 需要传输层已经挂上的会话；这里直接给出，绕过 HTTP 层。
      const request = entry.public ? {} : { authSession: { userId: 'raw' } }
      await expect(
        (serviceHandlers as Record<string, (request: unknown, reply: unknown) => Promise<unknown>>)[
          entry.operationId
        ]!(request, reply),
        entry.operationId,
      ).rejects.toMatchObject({ code: 'DOCS_FEATURE_NOT_IMPLEMENTED', statusCode: 501 })
      expect(headers['cache-control'], entry.operationId).toBe('no-store')
    }
    for (const table of DOCS_TABLES) {
      const count = Number(
        (await fixture.db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0]!.n,
      )
      expect(count, table).toBe(0)
    }
  })
})
