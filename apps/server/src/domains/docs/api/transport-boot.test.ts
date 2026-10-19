import { describe, expect, it } from 'vitest'
import Fastify, { type RouteOptions } from 'fastify'
import { DOCS_GET_OPERATION_IDS, registerDocsTransport } from './transport.js'

/**
 * Docs transport 的 boot 期门禁（G-1 的补偿控制）。
 *
 * nginx 的 `docsWireBytes()` 按"`x-fastify-config.docs` 是否存在"判定：某个 Docs operation
 * 整体丢掉该配置时会被当作非 Docs operation 跳过。G-1 认定"无配置不静默降级"由 Server
 * transport 在 boot 期承担，本文件用真实 Fastify 实例把这条声明变成可执行的断言。
 *
 * 本文件位于 `apps/server` 且不带 DOM 标记：它同时证明 transport 不依赖 DOM 与数据库。
 */

/** 真实 Fastify 的路由注册；`schema.operationId` 由 openapi-glue 提供，此处显式构造。 */
function probeRoute(
  method: 'GET' | 'HEAD',
  url: string,
  operationId: string,
  config: unknown,
): RouteOptions {
  return {
    method,
    url,
    config,
    schema: { operationId },
    handler: async () => ({}),
  } as unknown as RouteOptions
}

const unifiedErrorHandler = (): void => undefined

describe('Docs transport boot 门禁', () => {
  it('refuses to register a Docs route whose config disappeared, rather than degrading to global defaults', async () => {
    const app = Fastify()
    registerDocsTransport(app, { unifiedErrorHandler })
    try {
      expect(() =>
        app.route(probeRoute('GET', '/probe-lost-config', 'listDocsSpaces', {})),
      ).toThrow(/missing its x-fastify-config/)
    } finally {
      await app.close()
    }
  })

  it('refuses to register a Docs route whose config is malformed', async () => {
    const app = Fastify()
    registerDocsTransport(app, { unifiedErrorHandler })
    try {
      expect(() =>
        app.route(
          probeRoute('GET', '/probe-bad-kind', 'listDocsSpaces', { docs: { kind: 'mystery' } }),
        ),
      ).toThrow(/unknown docs kind/)
    } finally {
      await app.close()
    }
  })

  it('fails boot when a Docs GET operation has no observed HEAD branch', async () => {
    const app = Fastify()
    registerDocsTransport(app, { unifiedErrorHandler })
    app.route(probeRoute('GET', '/probe-read', 'listDocsSpaces', { docs: { kind: 'read' } }))
    // N-05：HEAD 分流依赖 Fastify 的内部继承行为，缺分支必须在 boot 期失败而不是静默放行。
    await expect(app.ready()).rejects.toThrow(/HEAD branches were not registered/)
    await app.close()
  })

  it('boots only once all twelve Docs HEAD branches are observed', async () => {
    const app = Fastify()
    registerDocsTransport(app, { unifiedErrorHandler })
    for (const operationId of DOCS_GET_OPERATION_IDS) {
      app.route(
        probeRoute('HEAD', `/probe-head/${operationId}`, operationId, { docs: { kind: 'read' } }),
      )
    }
    // 断言 boot 完成而不是断言 ready() 的返回值：Fastify 实例不适合被序列化进失败信息。
    const booted = await app.ready().then(
      () => true,
      () => false,
    )
    expect(booted).toBe(true)
    await app.close()
  })
})
