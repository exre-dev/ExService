import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance, RouteOptions } from 'fastify'
import { createApp } from '@server/src/app'
import {
  DOCS_GET_OPERATION_IDS,
  DOCS_OPERATION_IDS,
  DOCS_PUBLIC_OPERATION_IDS,
  readDocsConfig,
} from '@server/src/domains/docs/api/transport'
import { listOperations, readContract, type ContractDocument } from '@server/src/contract/document'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'

/**
 * S4-1 剩余两项：G-1 的"逐个 operation 恰有一个匹配类别、无配置不静默降级"，
 * 以及 `wireBytes` → `route.bodyLimit` 的门禁。
 *
 * nginx 的 `docsWireBytes()` 按"`x-fastify-config.docs` 是否存在"判定，因此某个 Docs
 * operation 整体丢掉该配置时会被当作非 Docs operation 跳过。G-1 认定的补偿控制是
 * Server transport 在 boot 期承担这道门禁：注册期拒绝见 `apps/server/src/domains/docs/api/
 * transport-boot.test.ts`（真实 Fastify 实例），本文件负责 Contract 派生与纯函数门禁。
 *
 * 类别划分与 wireBytes 全部从生成 Contract 派生，不在本文件复制第二份预算。
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

async function bearer(fixture: TestAuth, email = 'docs-config@example.com'): Promise<string> {
  await fixture.seedUser({ email, nickname: 'Docs', password: 'valid password' })
  const { token } = await fixture.authServices.login({ email, password: 'valid password' })
  return `Bearer ${token}`
}

interface DocsEntry {
  kind?: string
  wireBytes?: number
}

interface DocsOperationCase {
  operationId: string
  method: string
  location: string
  docs: DocsEntry
  hasBody: boolean
  public: boolean
}

function docsOperations(document: ContractDocument): DocsOperationCase[] {
  const result: DocsOperationCase[] = []
  for (const { operationId, method, location, operation } of listOperations(document)) {
    const tags = operation.tags as string[] | undefined
    if (!tags?.includes('docs')) continue
    const config = (operation['x-fastify-config'] as { docs?: DocsEntry } | undefined)?.docs
    if (!config) throw new Error(`Docs operation ${operationId} has no x-fastify-config.docs entry`)
    result.push({
      operationId,
      method: method.toUpperCase(),
      location,
      docs: config,
      hasBody: Object.hasOwn(operation, 'requestBody'),
      public: Array.isArray(operation.security) && operation.security.length === 0,
    })
  }
  return result
}

/** `readDocsConfig` 只读 config/method/schema.body 并写 bodyLimit，因此最小假路由足够。 */
function fakeRoute(options: {
  method: string
  config?: unknown
  body?: unknown
}): RouteOptions & { bodyLimit?: number } {
  const route: Record<string, unknown> = {
    method: options.method,
    url: '/probe',
    handler: () => undefined,
  }
  if ('config' in options) route.config = options.config
  if ('body' in options) route.schema = { body: options.body }
  return route as unknown as RouteOptions & { bodyLimit?: number }
}

describe('Docs G-1：operation 与类别一一对应', () => {
  it('keeps the transport allow-lists identical to the generated contract', () => {
    const operations = docsOperations(readContract())
    expect(operations).toHaveLength(30)
    expect(operations.map((entry) => entry.operationId).sort()).toEqual(
      [...DOCS_OPERATION_IDS].sort(),
    )

    const gets = operations.filter((entry) => entry.method === 'GET')
    expect(gets.map((entry) => entry.operationId).sort()).toEqual(
      [...DOCS_GET_OPERATION_IDS].sort(),
    )

    const publics = operations.filter((entry) => entry.public)
    expect(publics.map((entry) => entry.operationId).sort()).toEqual(
      [...DOCS_PUBLIC_OPERATION_IDS].sort(),
    )

    const kinds = operations.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.docs.kind ?? 'unknown'] =
        (accumulator[entry.docs.kind ?? 'unknown'] ?? 0) + 1
      return accumulator
    }, {})
    expect(kinds).toEqual({ read: 12, content: 4, command: 13, 'reserved-upload': 1 })
    // 每个 operation 只能落在一个类别里；read 之外都必须声明 wireBytes，read 一律不声明。
    for (const entry of operations) {
      const wire = entry.docs.wireBytes
      if (entry.docs.kind === 'read' || entry.docs.kind === 'reserved-upload')
        expect(wire, entry.location).toBeUndefined()
      else expect(typeof wire, entry.location).toBe('number')
    }
  })

  it('accepts every declared Docs operation and wires only content/command to a body limit', () => {
    for (const entry of docsOperations(readContract())) {
      const route = fakeRoute({
        method: entry.method,
        config: { docs: entry.docs },
        body: entry.hasBody ? {} : undefined,
      })
      const config = readDocsConfig(route, entry.operationId)
      if (config.kind === 'content' || config.kind === 'command') {
        expect(route.bodyLimit, entry.location).toBe(entry.docs.wireBytes)
        expect(config.wireBytes, entry.location).toBe(entry.docs.wireBytes)
      } else {
        // read 与 reserved-upload 不参与 wire 预算，必须保留 Fastify 的默认 bodyLimit。
        expect(route.bodyLimit, entry.location).toBeUndefined()
      }
    }
  })
})

describe('Docs G-1：无配置不静默降级', () => {
  it('rejects a missing, malformed or mismatched docs config instead of falling back', () => {
    const cases: Array<{ name: string; route: RouteOptions; head?: boolean; pattern: RegExp }> = [
      {
        name: 'config 缺失',
        route: fakeRoute({ method: 'GET' }),
        pattern: /missing its x-fastify-config/,
      },
      {
        name: 'config 为 null',
        route: fakeRoute({ method: 'GET', config: { docs: null } }),
        pattern: /missing its x-fastify-config/,
      },
      {
        name: 'config 为数组',
        route: fakeRoute({ method: 'GET', config: { docs: [] } }),
        pattern: /missing its x-fastify-config/,
      },
      {
        name: 'config 为字符串',
        route: fakeRoute({ method: 'GET', config: { docs: 'read' } }),
        pattern: /missing its x-fastify-config/,
      },
      {
        name: '未知 kind',
        route: fakeRoute({ method: 'GET', config: { docs: { kind: 'mystery' } } }),
        pattern: /unknown docs kind/,
      },
      {
        name: 'read 带额外键',
        route: fakeRoute({ method: 'GET', config: { docs: { kind: 'read', wireBytes: 1 } } }),
        pattern: /extra read keys/,
      },
      {
        name: 'read 注册成 POST',
        route: fakeRoute({ method: 'POST', config: { docs: { kind: 'read' } } }),
        pattern: /declares read but registers POST/,
      },
      {
        name: 'content 缺少 wireBytes',
        route: fakeRoute({ method: 'POST', config: { docs: { kind: 'content' } }, body: {} }),
        pattern: /unexpected content keys/,
      },
      {
        name: 'content 的 wireBytes 为 0',
        route: fakeRoute({
          method: 'POST',
          config: { docs: { kind: 'content', wireBytes: 0 } },
          body: {},
        }),
        pattern: /invalid wireBytes/,
      },
      {
        name: 'content 的 wireBytes 为小数',
        route: fakeRoute({
          method: 'POST',
          config: { docs: { kind: 'content', wireBytes: 1.5 } },
          body: {},
        }),
        pattern: /invalid wireBytes/,
      },
      {
        name: 'content 的 wireBytes 为字符串',
        route: fakeRoute({
          method: 'POST',
          config: { docs: { kind: 'content', wireBytes: '9437184' } },
          body: {},
        }),
        pattern: /invalid wireBytes/,
      },
      {
        name: 'content 注册成 GET',
        route: fakeRoute({ method: 'GET', config: { docs: { kind: 'content', wireBytes: 64 } } }),
        pattern: /declares content but registers GET/,
      },
      {
        name: 'content 没有请求体',
        route: fakeRoute({ method: 'POST', config: { docs: { kind: 'content', wireBytes: 64 } } }),
        pattern: /without a request body/,
      },
      {
        name: 'reserved-upload 带额外键',
        route: fakeRoute({
          method: 'POST',
          config: { docs: { kind: 'reserved-upload', wireBytes: 1 } },
        }),
        pattern: /extra reserved-upload keys/,
      },
      {
        name: 'reserved-upload 注册成 PUT',
        route: fakeRoute({ method: 'PUT', config: { docs: { kind: 'reserved-upload' } } }),
        pattern: /declares reserved-upload but registers PUT/,
      },
      {
        name: 'HEAD 分支复用了 command 配置',
        route: fakeRoute({
          method: 'HEAD',
          config: { docs: { kind: 'command', wireBytes: 64 } },
          body: {},
        }),
        head: true,
        pattern: /must reuse the read config/,
      },
    ]
    for (const entry of cases) {
      expect(
        () => readDocsConfig(entry.route, 'listDocsSpaces', entry.head ?? false),
        entry.name,
      ).toThrow(entry.pattern)
    }
  })

  it('accepts the read config on a HEAD branch and rejects every non-read kind there', () => {
    const head = fakeRoute({ method: 'HEAD', config: { docs: { kind: 'read' } } })
    expect(readDocsConfig(head, 'listDocsSpaces', true)).toEqual({ kind: 'read' })
    expect(head.bodyLimit).toBeUndefined()
  })
})

describe('Docs route.bodyLimit 门禁', () => {
  it('lets a content body through the 4 MiB app default but stops a command body at 64 KiB', async () => {
    const { fixture, app } = await setup()
    const authorization = await bearer(fixture)
    const space = (
      await app.inject({
        method: 'POST',
        url: '/api/docs/spaces',
        headers: { authorization },
        payload: { name: 'BodyLimit', description: '' },
      })
    ).json<{ id: string }>()

    // 应用的全局 bodyLimit 是 4 MiB；Docs content 的 9 MiB 必须来自 Contract 派生的
    // route.bodyLimit，否则这条 5 MiB 正文会被全局默认值拦成 413。
    const oversized = await app.inject({
      method: 'POST',
      url: `/api/docs/spaces/${space.id}/documents`,
      headers: { authorization },
      payload: {
        expectedTreeVersion: 1,
        parentId: null,
        beforeDocumentId: null,
        title: 'Big',
        contentSchemaVersion: 1,
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(5 * 1024 * 1024) }] },
          ],
        },
      },
    })
    expect(oversized.statusCode, oversized.body).toBe(201)

    // 反向对照：command 预算只有 64 KiB，远小于全局默认值，只能由 route.bodyLimit 生效。
    const command = await app.inject({
      method: 'POST',
      url: '/api/docs/spaces',
      headers: { authorization },
      payload: { name: 'n'.repeat(65_536 + 1), description: '' },
    })
    expect(command.statusCode).toBe(413)
    expect(command.json().error.code).toBe('DOCS_LIMIT_EXCEEDED')
  })
})
