import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import {
  API_PREFIX,
  listOperations,
  readContract,
  type ContractDocument,
} from '@server/src/contract/document'
import { createApp } from '@server/src/app'
import { DOCS_GET_OPERATION_IDS } from '@server/src/domains/docs/api/transport'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

/**
 * Contract 附录 §5 的 HEAD/GET 验收矩阵。
 *
 * S4-1 的缺口是原矩阵只跑了"匿名"一列。无效 Bearer 列是关键判别式：一旦认证 hook
 * 泄漏到 HEAD 分支，受保护 operation 的 HEAD 会变成 401、公开 operation 带坏 token 的
 * HEAD/GET 也会变成 401。因此 12 条路径 × HEAD/GET × 匿名/有效 Bearer/无效 Bearer 全部断言。
 *
 * 路径与公开/受保护的划分从生成 Contract 派生，不是抄一份常量；有效 Bearer 列的预期状态码
 * 是显式表，新增第 13 个 Docs GET operation 会让本文件直接失败。
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

async function validBearer(fixture: TestAuth, email = 'docs-matrix@example.com'): Promise<string> {
  await fixture.seedUser({ email, nickname: 'Docs', password: 'valid password' })
  const { token } = await fixture.authServices.login({ email, password: 'valid password' })
  return `Bearer ${token}`
}

/** 无效 Bearer：格式合法、签名与会话都不可解析。 */
const INVALID_BEARER =
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJub3QtYS1zZXNzaW9uIn0.not-a-valid-signature'

type AuthColumn = 'anonymous' | 'valid' | 'invalid'

const AUTH_COLUMNS: readonly AuthColumn[] = ['anonymous', 'valid', 'invalid']

const UUID = '00000000-0000-4000-8000-000000000001'

/**
 * 有效 Bearer 列下每个 Docs GET operation 的预期状态码。
 *
 * 501 表示 B 类预留；200/404 是核心读（UUID 不存在，因此单资源读为 404）。
 */
const AUTHENTICATED_GET_STATUS: Readonly<Record<string, number>> = Object.freeze({
  listDocsSpaces: 200,
  getDocsSpace: 404,
  getDocsTree: 404,
  getDocsDocument: 404,
  // UUID 不存在：集合读先解析所属空间，因此同样是 404，而不是空列表 200。
  listDocsTrash: 404,
  getDocsTrashedDocument: 404,
  listDocsTemplates: 501,
  getDocsTemplate: 501,
  listDocsAttachments: 501,
  getDocsAttachment: 501,
  listDocsComments: 501,
  searchDocsDocuments: 501,
})

interface DocsGetCase {
  operationId: string
  url: string
  public: boolean
  reserved: boolean
  authenticatedStatus: number
}

interface ContractParameter {
  in?: string
  name?: string
  required?: boolean
}

/** 从生成 Contract 派生 12 条 GET 路径；公开性取自 operation 的 `security`。 */
function docsGetCases(document: ContractDocument): DocsGetCase[] {
  const cases: DocsGetCase[] = []
  for (const { operationId, method, path, operation } of listOperations(document)) {
    const tags = operation.tags as string[] | undefined
    if (method !== 'get' || !tags?.includes('docs')) continue
    const authenticatedStatus = AUTHENTICATED_GET_STATUS[operationId]
    if (typeof authenticatedStatus !== 'number') {
      throw new Error(`Docs GET ${operationId} is missing its expected authenticated status`)
    }
    const parameters = (operation.parameters as ContractParameter[] | undefined) ?? []
    const requiredQuery = parameters.filter(
      (entry) => entry.in === 'query' && entry.required === true,
    )
    const query =
      requiredQuery.length === 0
        ? ''
        : `?${requiredQuery.map((entry) => `${entry.name}=x`).join('&')}`
    const responses = (operation.responses as Record<string, unknown> | undefined) ?? {}
    cases.push({
      operationId,
      url: `${API_PREFIX}${path.replace(/\{[^}]+\}/g, UUID)}${query}`,
      public: Array.isArray(operation.security) && operation.security.length === 0,
      reserved: Object.hasOwn(responses, '501'),
      authenticatedStatus,
    })
  }
  return cases
}

function headersFor(column: AuthColumn, valid: string): Record<string, string> {
  if (column === 'anonymous') return {}
  return { authorization: column === 'valid' ? valid : INVALID_BEARER }
}

/** 受保护 operation 无有效会话时一律 401；公开 operation 的三列必须完全一致。 */
function expectedGetStatus(entry: DocsGetCase, column: AuthColumn): number {
  if (!entry.public && column !== 'valid') return 401
  return entry.authenticatedStatus
}

describe('Docs HEAD/GET 认证矩阵（Contract §5）', () => {
  it('keeps every Docs HEAD at 404 for all three auth columns while GET follows each operation rule', async () => {
    const { fixture, app } = await setup()
    const valid = await validBearer(fixture)
    const cases = docsGetCases(readContract())

    expect(cases.map((entry) => entry.operationId).sort()).toEqual(
      [...DOCS_GET_OPERATION_IDS].sort(),
    )
    expect(cases.filter((entry) => entry.public)).toHaveLength(8)
    expect(cases.filter((entry) => entry.reserved)).toHaveLength(6)

    for (const entry of cases) {
      for (const column of AUTH_COLUMNS) {
        const label = `${entry.operationId} ${column}`
        const headers = headersFor(column, valid)

        // HEAD：三类认证列统一 404，认证 hook 不得泄漏到 HEAD 分支。
        const head = await app.inject({ method: 'HEAD', url: entry.url, headers })
        expect(head.statusCode, `HEAD ${label} -> ${entry.url}`).toBe(404)
        expect(head.headers['cache-control'], `HEAD ${label}`).toBe('no-store')
        expect(head.headers['x-request-id'], `HEAD ${label}`).toBeTruthy()
        expect(head.body, `HEAD ${label}`).toBe('')

        // GET：按各 operation 的认证要求断言。
        const get = await app.inject({ method: 'GET', url: entry.url, headers })
        expect(get.statusCode, `GET ${label} -> ${entry.url}`).toBe(
          expectedGetStatus(entry, column),
        )
        expect(get.headers['cache-control'], `GET ${label}`).toBe('no-store')
        expect(get.headers['x-request-id'], `GET ${label}`).toBeTruthy()
        if (get.statusCode === 501) {
          expect(get.json().error.code, `GET ${label}`).toBe('DOCS_FEATURE_NOT_IMPLEMENTED')
        }
      }
    }
  })

  it('never lets an invalid Bearer change a public Docs GET result', async () => {
    const { fixture, app } = await setup()
    const valid = await validBearer(fixture)
    for (const entry of docsGetCases(readContract()).filter((value) => value.public)) {
      const anonymous = await app.inject({ method: 'GET', url: entry.url })
      const invalid = await app.inject({
        method: 'GET',
        url: entry.url,
        headers: { authorization: INVALID_BEARER },
      })
      const authenticated = await app.inject({
        method: 'GET',
        url: entry.url,
        headers: { authorization: valid },
      })
      expect(invalid.statusCode, `invalid bearer ${entry.operationId}`).toBe(anonymous.statusCode)
      expect(authenticated.statusCode, `valid bearer ${entry.operationId}`).toBe(
        anonymous.statusCode,
      )
      if (anonymous.statusCode === 501) {
        expect(invalid.json().error.code, `invalid bearer ${entry.operationId}`).toBe(
          'DOCS_FEATURE_NOT_IMPLEMENTED',
        )
      }
    }
  })
})

/**
 * HEAD 短路反例：这些请求在 GET 上会被校验拒绝，在 HEAD 上必须仍然是统一 404，
 * 证明 HEAD 分支在 params/query/编码校验之前就结束，不受 GET 校验影响。
 */
const SHORTCUT_PROBES = [
  { name: '坏 UUID', url: `${API_PREFIX}/docs/spaces/not-a-uuid`, headers: {}, getStatus: 400 },
  {
    name: '额外 query',
    url: `${API_PREFIX}/docs/spaces?limit=999&cursor=x`,
    headers: {},
    getStatus: 400,
  },
  {
    name: '非 identity 编码',
    url: `${API_PREFIX}/docs/spaces`,
    headers: { 'content-encoding': 'gzip' },
    getStatus: 415,
  },
] as const

describe('Docs HEAD 短路不受 GET 校验影响', () => {
  it('answers the shortcut counterexamples with 404 on HEAD while GET rejects them', async () => {
    const { fixture, app } = await setup()
    const valid = await validBearer(fixture)

    for (const probe of SHORTCUT_PROBES) {
      for (const column of AUTH_COLUMNS) {
        const label = `${probe.name} ${column}`
        const headers = { ...probe.headers, ...headersFor(column, valid) }

        const head = await app.inject({ method: 'HEAD', url: probe.url, headers })
        expect(head.statusCode, `HEAD ${label} -> ${probe.url}`).toBe(404)
        expect(head.headers['cache-control'], `HEAD ${label}`).toBe('no-store')
        expect(head.headers['x-request-id'], `HEAD ${label}`).toBeTruthy()
        expect(head.body, `HEAD ${label}`).toBe('')

        // 对照列：同一 URL 与请求头在 GET 上必须被校验拒绝，否则这条反例什么也没证明。
        const get = await app.inject({ method: 'GET', url: probe.url, headers })
        expect(get.statusCode, `GET ${label} -> ${probe.url}`).toBe(probe.getStatus)
      }
    }
  })
})
