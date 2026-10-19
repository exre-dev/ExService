import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import { DocsError } from '../errors.js'
import { authenticateBearer } from '@server/src/modules/auth/api/security.js'
import { assertJsonShape, assertKnownContentShape } from '../content/validation.js'

/** 30 个正式 operation；自动 HEAD 分支不属于正式 operation。 */
export const DOCS_OPERATION_IDS: readonly string[] = Object.freeze([
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
])

/** 12 个 GET operation；Docs 对外不支持 HEAD，这些自动分支统一 404。 */
export const DOCS_GET_OPERATION_IDS: readonly string[] = Object.freeze([
  'listDocsSpaces',
  'getDocsSpace',
  'getDocsTree',
  'getDocsDocument',
  'listDocsTrash',
  'getDocsTrashedDocument',
  'searchDocsDocuments',
  'listDocsTemplates',
  'getDocsTemplate',
  'listDocsAttachments',
  'getDocsAttachment',
  'listDocsComments',
])

export const DOCS_PUBLIC_OPERATION_IDS: readonly string[] = Object.freeze([
  'listDocsSpaces',
  'getDocsSpace',
  'getDocsTree',
  'getDocsDocument',
  'searchDocsDocuments',
  'listDocsAttachments',
  'getDocsAttachment',
  'listDocsComments',
])

export type DocsOperationKind = 'read' | 'content' | 'command' | 'reserved-upload'

export interface DocsRouteConfig {
  kind: DocsOperationKind
  wireBytes?: number
}

type HookKey = 'onRequest' | 'preValidation'

/**
 * Docs 内部最小 hook 组合函数。
 *
 * 未定义形成单元素数组，函数形成 `[existing, added]`，数组形成 `[...existing, added]`；
 * 始终创建新数组，不 push 共享数组、不修改共享 schema/config，保留原有 hook 顺序。
 */
function appendHook<K extends HookKey>(
  route: RouteOptions,
  key: K,
  hook: NonNullable<RouteOptions[K]>,
): void {
  const previous = route[key] as unknown
  const next =
    previous === undefined
      ? [hook]
      : Array.isArray(previous)
        ? [...previous, hook]
        : [previous, hook]
  Object.assign(route, { [key]: next })
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/**
 * 校验 operation 的 `x-fastify-config.docs` 封闭形状。
 *
 * kind 缺失/未知、额外键、错误值、以及正式 operation 的 method/body media 与类别不匹配
 * 都在注册时固定错误拒绝 boot，不能把无配置的 Docs 路由静默降为全局默认。
 */
export function readDocsConfig(
  route: RouteOptions,
  operationId: string,
  headBranch = false,
): DocsRouteConfig {
  const raw = (route.config as { docs?: unknown } | undefined)?.docs
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Docs operation ${operationId} is missing its x-fastify-config.docs entry.`)
  }
  const entry = raw as Record<string, unknown>
  const kind = entry.kind
  const keys = Object.keys(entry)
  const method = Array.isArray(route.method) ? route.method[0] : route.method
  const upper = typeof method === 'string' ? method.toUpperCase() : ''
  const body = (route.schema as { body?: unknown } | undefined)?.body

  if (kind === 'read') {
    if (keys.length !== 1)
      throw new Error(`Docs operation ${operationId} has extra read keys: ${keys.join(', ')}`)
    // 自动 HEAD 分支保留 GET 的 schema/operationId/config，因此只读配置在 HEAD 上也合法；
    // 其他类别不允许出现在 HEAD 分支上。
    if (upper !== 'GET' && !(headBranch && upper === 'HEAD')) {
      throw new Error(`Docs operation ${operationId} declares read but registers ${upper}.`)
    }
    return { kind }
  }
  if (headBranch) {
    throw new Error(`Docs HEAD branch ${operationId} must reuse the read config.`)
  }
  if (kind === 'content' || kind === 'command') {
    if (keys.length !== 2 || !keys.includes('wireBytes')) {
      throw new Error(
        `Docs operation ${operationId} has unexpected ${kind} keys: ${keys.join(', ')}`,
      )
    }
    const wireBytes = safeInteger(entry.wireBytes)
    if (wireBytes === undefined)
      throw new Error(`Docs operation ${operationId} has an invalid wireBytes value.`)
    if (!['POST', 'PUT', 'PATCH'].includes(upper)) {
      throw new Error(`Docs operation ${operationId} declares ${kind} but registers ${upper}.`)
    }
    if (body === undefined)
      throw new Error(`Docs operation ${operationId} declares ${kind} without a request body.`)
    // 不能误以为 config 自动改变默认 JSON parser：wireBytes 必须显式写入 route.bodyLimit。
    route.bodyLimit = wireBytes
    return { kind, wireBytes }
  }
  if (kind === 'reserved-upload') {
    if (keys.length !== 1)
      throw new Error(
        `Docs operation ${operationId} has extra reserved-upload keys: ${keys.join(', ')}`,
      )
    if (upper !== 'POST')
      throw new Error(
        `Docs operation ${operationId} declares reserved-upload but registers ${upper}.`,
      )
    return { kind }
  }
  throw new Error(`Docs operation ${operationId} declares an unknown docs kind: ${String(kind)}`)
}

/** 只接受 `Content-Encoding` 缺省或 identity。 */
function assertIdentityEncoding(request: FastifyRequest): void {
  const encoding = request.headers['content-encoding']
  if (encoding === undefined || encoding === 'identity') return
  throw new DocsError('DOCS_UNSUPPORTED_MEDIA_TYPE')
}

/**
 * 已解析内容的有界预检：在默认递归 AJV 之前迭代检查 JSON 容器深度与循环引用。
 * 深对象的递归 stringify 会先抛错或压爆调用栈，因此这一步必须前置于 AJV。
 */
function precheckBody(request: FastifyRequest): void {
  if (request.body === undefined || request.body === null) return
  assertJsonShape(request.body)
  // 未知节点/Mark/属性在进入 AJV 之前识别，返回 DOCS_UNSUPPORTED_CONTENT 而不是通用 400。
  const content = (request.body as { content?: unknown }).content
  if (content !== undefined) assertKnownContentShape(content)
}

const JSON_MEDIA_TYPE = 'application/json'

/**
 * content/command 类别的正式 operation 只接受 `application/json`。
 *
 * Fastify 只对未注册的媒体类型抛 `FST_ERR_CTP_INVALID_MEDIA_TYPE`（415），
 * 而 `text/plain` 有内置解析器，会把正文解析成字符串后再进入内容校验并报 400。
 * Contract 只声明了 JSON 请求体，因此在 onRequest 阶段就按不支持的媒体类型拒绝。
 */
function assertJsonContentType(request: FastifyRequest): void {
  const contentType = request.headers['content-type']
  if (typeof contentType !== 'string') throw new DocsError('DOCS_UNSUPPORTED_MEDIA_TYPE')
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase()
  if (mediaType !== JSON_MEDIA_TYPE) throw new DocsError('DOCS_UNSUPPORTED_MEDIA_TYPE')
}

export interface RegisterDocsTransportOptions {
  /** HTTP foundation 已安装的统一错误出口；由 `dependencies: ['http-foundation']` 保证先注册。 */
  unifiedErrorHandler: (error: unknown, request: FastifyRequest, reply: FastifyReply) => void
}

const observedHeadBranches = new Set<string>()

/** 供 boot 守卫与测试读取；每次注册清空，避免跨实例残留。 */
export function resetDocsHeadObservation(): void {
  observedHeadBranches.clear()
}

export function observedDocsHeadBranches(): readonly string[] {
  return [...observedHeadBranches]
}

export function registerDocsTransport(
  app: FastifyInstance,
  options: RegisterDocsTransportOptions,
): void {
  resetDocsHeadObservation()
  app.addHook('onRoute', (route) => {
    const operationId = (route.schema as { operationId?: unknown } | undefined)?.operationId
    if (typeof operationId !== 'string' || !DOCS_OPERATION_IDS.includes(operationId)) return

    const method = Array.isArray(route.method) ? route.method[0] : route.method
    const isHead = method === 'HEAD'

    if (isHead) {
      // 自动 HEAD 分支：先分流，只复核对应 GET 的只读配置，再追加统一 404，随后结束安装。
      if (!DOCS_GET_OPERATION_IDS.includes(operationId)) {
        throw new Error(`Docs HEAD branch ${operationId} is not a declared GET operation.`)
      }
      const config = readDocsConfig(route, operationId, true)
      if (config.kind !== 'read')
        throw new Error(`Docs HEAD branch ${operationId} must reuse the read config.`)
      observedHeadBranches.add(operationId)
      appendHook(route, 'onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        void reply.header('Cache-Control', 'no-store')
        // 复用已安装的 setNotFoundHandler，不抛 DocsError，不进入 Docs/DB/存储服务。
        return reply.callNotFound()
      })
      return
    }

    const config = readDocsConfig(route, operationId)
    const protectedOperation = !DOCS_PUBLIC_OPERATION_IDS.includes(operationId)

    appendHook(route, 'onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      void reply.header('Cache-Control', 'no-store')
      if (config.kind === 'reserved-upload') void reply.header('Connection', 'close')
      assertIdentityEncoding(request)
      if (config.kind === 'content' || config.kind === 'command') assertJsonContentType(request)
      // 匿名请求优先得到 401；受保护的 B operation 因此在 501 之前被拒绝。
      if (protectedOperation) await authenticateBearer(request, request.server.authServices)
    })

    if (config.kind === 'content' || config.kind === 'command') {
      appendHook(route, 'preValidation', (request: FastifyRequest, _reply: FastifyReply, done) => {
        precheckBody(request)
        done()
      })
    }

    if (config.kind === 'reserved-upload') {
      // 预留上传本期不读取或验证 multipart 正文：认证通过后立即 501。
      // Contract 仍声明封闭 multipart schema，供生成 Client 与后续实现使用；
      // 这里只移除路由的 body schema，让 501 在正文解析与校验之前可达。
      // 调用方提交的 medium/key/url/ticket 不可信，是后续实现必须遵守的接缝。
      const schema = route.schema as Record<string, unknown> | undefined
      if (schema && 'body' in schema) delete schema.body
    }

    // 解析期 413/415 先于 preValidation，只能由路由 errorHandler 分类后委托统一出口。
    const unified = options.unifiedErrorHandler
    route.errorHandler = (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
      const code = (error as { code?: unknown } | null | undefined)?.code
      if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        unified(new DocsError('DOCS_LIMIT_EXCEEDED'), request, reply)
        return
      }
      if (code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
        unified(new DocsError('DOCS_UNSUPPORTED_MEDIA_TYPE'), request, reply)
        return
      }
      unified(error, request, reply)
    }
  })

  // N-05 boot 守卫：HEAD 分流依赖 Fastify 的内部继承行为，升级后可能静默失效。
  // 这里在 boot 期断言 12 个 GET 标识各观察到一个 HEAD 分支，把该假设变成显式门禁。
  app.addHook('onReady', async () => {
    const missing = DOCS_GET_OPERATION_IDS.filter((id) => !observedHeadBranches.has(id))
    if (missing.length > 0) {
      throw new Error(
        `Docs HEAD branches were not registered for: ${missing.join(', ')}. The Fastify HEAD inheritance contract changed.`,
      )
    }
  })
}
