import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Readable } from 'node:stream'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import {
  MultipartWireCounter,
  multipartBoundary,
  type MultipartWireErrors,
  type MultipartWireLimits,
} from './multipart-counter.js'
import { resolveErrorResponse, type ErrorCode, type SafeErrorLog } from '../../errors.js'

/**
 * 两条 multipart 上传路径共用的连接生命周期。
 *
 * 本 module 只拥有时序知识：wire 计数流的接入、`request.raw` 的临时替换与幂等还原、
 * deadline、abort/close、buffer 引用解除与单次槽位释放。它不 import 任何业务服务、
 * 错误类或 DTO；两种 payload 的规则、前置认证/限流与错误分类由调用方通过 `policy` 提供。
 *
 * 这不是可插拔上传框架：module 内部只有两类既有 payload 的参数化结果，没有扩展点。
 */

export interface MultipartUploadLimits extends MultipartWireLimits {
  /** 该 operation 独占的活动上传容量。 */
  slots: number
  /** 单次上传的期限；每次请求读取，便于测试覆盖 route config。 */
  deadlineMs: number
}

/** `request.parts()` 的限额；与 busboy 的字段一一对应，数值仍由调用方的 Contract 决定。 */
export interface MultipartPartsLimits {
  parts?: number
  files?: number
  fields?: number
  fieldSize?: number
  fileSize?: number
  fieldNameSize?: number
  headerPairs?: number
  headerSize?: number
}

export interface UploadFilePart {
  type: 'file'
  fieldname: string
  filename: string
  mimetype: string
  encoding: string
  file: Readable & { truncated?: boolean }
}

export interface UploadFieldPart {
  type: 'field'
  fieldname: string
  mimetype: string
  encoding: string
  value: unknown
  valueTruncated: boolean
  fieldnameTruncated: boolean
}

export type UploadPart = UploadFilePart | UploadFieldPart

/** 解析回调内可用的受控读取入口；不得捕获到后台任务或并行读取。 */
export interface MultipartUploadScope {
  /** 包装 `request.parts({ preservePath: true, limits })`，每次 next/read 检查取消。 */
  parts(limits: MultipartPartsLimits): AsyncIterableIterator<UploadPart>
  /** 按调用方给出的有效字节上限读取，并在结束时丢弃 chunks 引用。 */
  readFile(file: Readable & { truncated?: boolean }, maxBytes: number): Promise<Buffer>
}

export interface MultipartParseResult<T> {
  /** 交给 Contract validator 的 schema body；不含二进制字节。 */
  body: unknown
  /** 只经 `getParsed` 发布的可信结果。 */
  value: T
}

export interface MultipartUploadPolicy<T> {
  /** 活动限额；wireBytes 同时是 bodyLimit、Content-Length 与 counter 的同一预算。 */
  limits: MultipartUploadLimits
  /** Contract 为该 operation 声明的响应状态码。提前终结只能输出其中之一。 */
  declaredStatuses: readonly number[]
  /** wire/header 超限与结构非法的安全错误分类。 */
  errors: MultipartWireErrors
  /** 前置认证或限流；必须在消费任何请求体之前完成，且不得读取 body。 */
  admit(request: FastifyRequest, reply: FastifyReply): void | Promise<void>
  /** payload 规则；只能经由 `scope` 读取请求体。 */
  parse(request: FastifyRequest, scope: MultipartUploadScope): Promise<MultipartParseResult<T>>
  /** 把解析/流异常收敛为本 operation 的安全错误。 */
  classify(error: unknown): Error
  /** deadline 到期的错误分类。 */
  timedOut(): Error
  /** 容量耗尽的错误分类。 */
  busy(): Error
}

type SessionState = 'admitted' | 'wired' | 'parsing' | 'parsed' | 'terminating' | 'released'
type ResponseOwnership = 'undecided' | 'fastify' | 'external'
type TerminationReason = 'response' | 'error' | 'timeout' | 'abort' | 'close' | 'wire'

/**
 * 每请求私有会话。所有失败、超时与断开都汇入同一个幂等终结过程：
 * 先同步停止消费、还原 raw 并确定响应归属，再异步收束 parse，最后单次释放槽位。
 */
class UploadSession<T> {
  private state: SessionState = 'admitted'
  private ownership: ResponseOwnership = 'undecided'
  private failure: Error | undefined
  private timer: NodeJS.Timeout | undefined
  private source: Readable | undefined
  private counter: MultipartWireCounter | undefined
  private file: Readable | undefined
  private value: T | undefined
  private staged: MultipartParseResult<T> | undefined
  private parseStarted = false
  private parseSettled = false
  private parseWaiters: Array<() => void> = []
  private released = false
  private finished: Promise<void> | undefined
  private restoreRaw: () => void = () => {}
  private detach: () => void = () => {}

  constructor(
    private readonly controller: MultipartUploadController<T>,
    private readonly policy: MultipartUploadPolicy<T>,
    private readonly request: FastifyRequest,
    private readonly reply: FastifyReply,
  ) {}

  /** 占位成功后安装期限与连接监听；此时还没有消费任何请求体。 */
  start(boundary: string, original: IncomingMessage): void {
    const policy = this.policy
    this.timer = setTimeout(
      () => this.terminate('timeout', policy.timedOut()),
      policy.limits.deadlineMs,
    )
    this.timer.unref()
    // 监听挂在原连接上，不依赖被临时替换的 `request.raw`。
    const onAborted = (): void => {
      this.terminate('abort', policy.errors.malformed())
    }
    const onClose = (): void => {
      this.terminate('close', policy.errors.malformed())
    }
    original.once('aborted', onAborted)
    this.reply.raw.once('close', onClose)
    this.detach = () => {
      original.removeListener('aborted', onAborted)
      this.reply.raw.removeListener('close', onClose)
    }
    // counter 直接持有调用方的活动限额对象，测试对 route config 的覆盖仍然生效。
    this.counter = new MultipartWireCounter(boundary, policy.limits, policy.errors)
    this.counter.on('error', (error) => {
      this.terminate('wire', policy.classify(error))
    })
    this.controller.track(this.request, this)
  }

  /** preParsing：把实际计数流接入真实解析路径。 */
  wire(source: Readable): Readable {
    if (this.state !== 'admitted') return source
    this.source = source
    source.on('error', (error) => this.counter?.destroy(error))
    source.pipe(this.counter!)
    this.state = 'wired'
    return this.counter!
  }

  /** preValidation：临时替换 raw，运行调用方 parser，最后幂等还原并发布一次结果。 */
  async consume(): Promise<void> {
    if (this.state !== 'admitted' && this.state !== 'wired') {
      // 会话已被终结：不再消费请求体。外部已接管时直接返回，不向 Fastify 抛第二次。
      if (this.ownership === 'external') return
      throw this.failure ?? this.policy.errors.malformed()
    }
    const original = this.request.raw
    const counter = this.counter
    if (counter === undefined) throw this.policy.errors.malformed()
    // `@fastify/multipart` 直接读 `request.raw`；它在 `parts()` 调用时已捕获该对象，
    // 因此还原 `FastifyRequest.raw` 不会把插件的读取转回原连接。
    Object.assign(counter, { headers: original.headers })
    this.request.raw = counter as unknown as IncomingMessage
    this.restoreRaw = () => {
      if (this.request.raw !== original) this.request.raw = original
    }
    this.state = 'parsing'
    this.parseStarted = true
    let thrown: Error | undefined
    try {
      this.staged = await this.policy.parse(this.request, this.scope())
    } catch (error) {
      thrown = this.policy.classify(error)
      this.failure ??= thrown
      // 普通错误交还 Fastify：同步锁定归属并停自有 timer，避免后到的期限二次接管。
      this.lockFastify()
    } finally {
      this.restoreRaw()
      // 只有 raw 已还原且会话仍活跃时才发布一次 body 与可信结果。
      if (thrown === undefined && this.staged !== undefined && this.state === 'parsing') {
        this.value = this.staged.value
        this.request.body = this.staged.body
        this.state = 'parsed'
      }
      this.staged = undefined
      this.settleParse()
    }
    if (thrown !== undefined && this.ownership !== 'external') throw thrown
    // 外部已接管响应：吞掉这次 rejection，不让 wrap-thenable 把原始异常写进日志。
  }

  /** handler 包装：handler settle 后响应归属归 Fastify，迟到 rejection 由调用链正常处理。 */
  async invoke(run: () => unknown): Promise<unknown> {
    try {
      const result = await run()
      this.lockFastify()
      return result
    } catch (error) {
      this.lockFastify()
      throw error
    }
  }

  /**
   * 正常错误链（Contract 校验、Glue security、业务失败）在收束资源之前锁定响应归属：
   * 响应仍由既有 `setErrorHandler` 与发送 hooks 输出一次，本 module 不 hijack、不二次发送。
   */
  noteNormalError(): void {
    this.lockFastify()
  }

  /** 无 session 返回 undefined；失败/取消抛已分类失败；只有已解析且未终结才返回可信值。 */
  trusted(): T | undefined {
    if (this.failure !== undefined) throw this.failure
    if (this.state !== 'parsed' || this.value === undefined) return undefined
    return this.value
  }

  /**
   * 终结入口。前半段同步完成，保证响应归属在第一次输出前确定；
   * 清理的收尾由 `settled()` 暴露，不阻塞响应。
   */
  terminate(reason: TerminationReason, failure?: Error): void {
    if (this.state === 'terminating' || this.state === 'released') {
      if (failure !== undefined) this.failure ??= failure
      return
    }
    this.state = 'terminating'
    if (failure !== undefined) this.failure ??= failure

    // 1. 停 timer，禁止发布
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }

    // 2. 停止消费输入
    this.source?.unpipe(this.counter)
    this.source?.pause()

    // 3. 让等待中的 counter/file 带着首个失败退出；正常完成不注入失败
    if (this.failure !== undefined) {
      this.file?.destroy(this.failure)
      if (this.counter !== undefined && !this.counter.destroyed) this.counter.destroy(this.failure)
    }

    // 4. 立即还原 raw（幂等）
    this.restoreRaw()

    // 5. 确定响应归属：只有尚未被 Fastify 接管、且已有本 module 的已分类失败时才由本 module 输出
    if (this.ownership === 'undecided' && reason !== 'response' && this.failure !== undefined)
      this.ownership = 'external'
    if (this.ownership === 'external') {
      // 断开的连接不发送 JSON，但仍 hijack 以停止尚未开始的 Fastify 阶段。
      this.controller.takeOver(
        this.request,
        this.reply,
        this.failure,
        reason !== 'abort' && reason !== 'close',
        this.policy,
      )
    }

    this.finished ??= this.finish()
  }

  /** `onResponse` 用它等待清理真正结束。 */
  settled(): Promise<void> | undefined {
    return this.finished
  }

  private async finish(): Promise<void> {
    while (this.parseStarted && !this.parseSettled) {
      await new Promise<void>((resolve) => this.parseWaiters.push(resolve))
    }
    // 解除 transport 持有的 byte array 与流引用；不清零、不修改已交给业务服务的数组。
    this.value = undefined
    this.staged = undefined
    this.counter = undefined
    this.source = undefined
    this.file = undefined
    this.detach()
    if (!this.released) {
      this.released = true
      this.controller.releaseSlot(this.request)
    }
    this.state = 'released'
  }

  private lockFastify(): void {
    if (this.ownership !== 'undecided') return
    this.ownership = 'fastify'
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }

  private settleParse(): void {
    this.parseSettled = true
    const waiters = this.parseWaiters.splice(0)
    for (const waiter of waiters) waiter()
  }

  private scope(): MultipartUploadScope {
    return {
      parts: (limits) => this.iterate(limits),
      readFile: (file, maxBytes) => this.read(file, maxBytes),
    }
  }

  private async *iterate(limits: MultipartPartsLimits): AsyncIterableIterator<UploadPart> {
    // 解析期间被取消时，插件的迭代必须退出，而不是继续产出 part。
    for await (const part of this.request.parts({ preservePath: true, limits })) {
      this.assertActive()
      yield part as UploadPart
      if (this.state !== 'parsing') {
        // 取消后迟到的文件不再进入 buffer，也不继续业务校验。
        if (part.type === 'file') part.file.destroy()
        this.assertActive()
      }
    }
  }

  private async read(file: Readable & { truncated?: boolean }, maxBytes: number): Promise<Buffer> {
    this.assertActive()
    this.file = file
    const chunks: Buffer[] = []
    let bytes = 0
    try {
      for await (const chunk of file as AsyncIterable<Buffer>) {
        this.assertActive()
        bytes += chunk.length
        if (bytes > maxBytes) throw this.policy.errors.tooLarge()
        chunks.push(chunk)
      }
    } finally {
      if (this.file === file) this.file = undefined
    }
    this.assertActive()
    // 截断标记同样视为超限：绝不保存部分文件。
    if (file.truncated === true) throw this.policy.errors.tooLarge()
    return Buffer.concat(chunks, bytes)
  }

  private assertActive(): void {
    if (this.failure !== undefined) throw this.failure
    if (this.state !== 'parsing') throw this.policy.errors.malformed()
  }
}

/** 每次 transport 注册一个 controller：独立容量与私有请求 WeakMap，不是进程级 singleton。 */
class MultipartUploadController<T> {
  private active = 0

  constructor(private readonly sessions: WeakMap<FastifyRequest, UploadSession<T>>) {}

  /** 在已筛选出的上传 route 上追加既有 hook，并独占 bodyLimit 赋值。 */
  attach(route: RouteOptions, policy: MultipartUploadPolicy<T>): void {
    // bodyLimit 只在这里赋值一次；它是 Content-Length 预检与 counter 的同一预算。
    if (!Number.isSafeInteger(policy.limits.wireBytes) || policy.limits.wireBytes < 1) {
      throw new Error('Multipart upload wire budget is not a positive safe integer.')
    }
    route.bodyLimit = policy.limits.wireBytes

    appendHook(route, 'onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      void reply.header('Cache-Control', 'no-store')
      // 认证/限流先于任何请求体消费。
      await policy.admit(request, reply)
      const boundary = multipartBoundary(request.headers['content-type'], policy.errors)
      if (this.active >= policy.limits.slots) throw policy.busy()
      const length = request.headers['content-length']
      if (
        length !== undefined &&
        (!/^\d+$/.test(length) || Number(length) > policy.limits.wireBytes)
      ) {
        throw policy.errors.tooLarge()
      }
      this.active++
      new UploadSession<T>(this, policy, request, reply).start(boundary, request.raw)
    })
    appendHook(
      route,
      'preParsing',
      async (request: FastifyRequest, _reply: FastifyReply, payload: Readable) => {
        const session = this.sessions.get(request)
        return session === undefined ? payload : session.wire(payload)
      },
    )
    appendHook(route, 'preValidation', async (request: FastifyRequest) => {
      const session = this.sessions.get(request)
      if (session === undefined) throw policy.errors.malformed()
      await session.consume()
    })

    const sessions = this.sessions
    const handler = route.handler as (
      this: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => unknown
    route.handler = function wrappedHandler(
      this: unknown,
      request: FastifyRequest,
      reply: FastifyReply,
    ): unknown {
      const session = sessions.get(request)
      if (session === undefined) return handler.call(this, request, reply)
      return session.invoke(() => handler.call(this, request, reply))
    }

    appendHook(route, 'onResponse', async (request: FastifyRequest) => {
      const session = this.sessions.get(request)
      if (session === undefined) return
      session.terminate('response')
      await session.settled()
    })
    appendHook(route, 'onError', async (request: FastifyRequest, reply: FastifyReply) => {
      const session = this.sessions.get(request)
      if (session !== undefined) {
        // Contract 校验/Glue security/业务失败都仍由 Fastify 输出一次原错误 envelope。
        session.noteNormalError()
        session.terminate('error')
      }
      // Do not keep accepting the rest of an invalid body on a persistent socket.
      void reply.header('Connection', 'close')
    })
    appendHook(route, 'onRequestAbort', async (request: FastifyRequest) => {
      this.sessions.get(request)?.terminate('abort', policy.errors.malformed())
    })
  }

  /** 占位成功后登记会话；会话表由注册表共享，按请求键控。 */
  track(request: FastifyRequest, session: UploadSession<T>): void {
    this.sessions.set(request, session)
  }

  /** 单次递减容量：只在 parse unwind、raw 还原且引用解除之后发生。 */
  releaseSlot(request: FastifyRequest): void {
    this.active = Math.max(0, this.active - 1)
    this.sessions.delete(request)
  }

  /**
   * 外部提前终结：还原 raw 之后调用公开 `reply.hijack()` 停止尚未开始的 Fastify 阶段，
   * 再用显式状态码与媒体类型的公开 `serializeInput` 输出安全 envelope。
   *
   * `write` 为 false 时（连接已断开）只 hijack 并销毁，不发送 JSON。
   */
  takeOver(
    request: FastifyRequest,
    reply: FastifyReply,
    failure: Error | undefined,
    write: boolean,
    policy: MultipartUploadPolicy<T>,
  ): void {
    const raw = reply.raw
    if (raw.destroyed || raw.writableEnded) return
    const resolution = resolveErrorResponse(failure, request.log as SafeErrorLog, request.id)
    if (!policy.declaredStatuses.includes(resolution.statusCode)) {
      // 共享映射只能产出该 operation 在 Contract 已声明的状态码；未声明时只留安全分类。
      request.log.error(
        { code: resolution.code, statusCode: resolution.statusCode },
        'upload takeover status is not declared by the contract',
      )
      safeDestroy(raw)
      return
    }
    if (!write) {
      // hijack 同步置 reply.sent，使 hookIterator/preValidationCallback 停止后续阶段。
      void reply.hijack()
      safeDestroy(raw)
      return
    }
    if (raw.headersSent) {
      // 头已发出且未结束：只能终止连接，不能把 JSON 追加到半截字节后面。
      void reply.hijack()
      safeDestroy(raw)
      return
    }

    try {
      void reply.hijack()
      void reply.code(resolution.statusCode)
      const serialized = reply.serializeInput(
        resolution.envelope,
        String(resolution.statusCode),
        'application/json',
      )
      if (typeof serialized !== 'string')
        throw new Error('Contract serializer did not return a string')
      raw.writeHead(
        resolution.statusCode,
        takeoverHeaders(reply, resolution.retryAfterSeconds, Buffer.byteLength(serialized)),
      )
      raw.end(serialized)
    } catch {
      // 序列化或 raw 写入失败只记录安全分类并销毁，不回到 Fastify 再试一次发送。
      request.log.error(
        { code: resolution.code, statusCode: resolution.statusCode },
        'upload takeover failed',
      )
      safeDestroy(raw)
    }
  }
}

function takeoverHeaders(
  reply: FastifyReply,
  retryAfterSeconds: number | undefined,
  contentLength: number,
): Record<string, number | string | string[]> {
  // 键统一小写：`reply.getHeaders()` 混用原始与 Fastify 归一化的大小写，
  // 同一 header 以两种大小写传入 writeHead 会被写成两份值。
  const headers: Record<string, number | string | string[]> = {}
  // 保留 foundation onRequest 已设置的 X-Request-Id / CORS / Vary，以及 no-store。
  for (const [key, value] of Object.entries(reply.getHeaders())) {
    if (value === undefined) continue
    headers[key.toLowerCase()] = value as number | string | string[]
  }
  // 先前 payload 的长度/分块头必须清掉，才能建立这份精确长度。
  delete headers['content-length']
  delete headers['transfer-encoding']
  headers['cache-control'] = 'no-store'
  headers['content-type'] = 'application/json; charset=utf-8'
  headers['content-length'] = contentLength
  headers['connection'] = 'close'
  if (retryAfterSeconds !== undefined) headers['retry-after'] = String(retryAfterSeconds)
  return headers
}

function safeDestroy(raw: ServerResponse): void {
  try {
    raw.destroy()
  } catch {
    /* 连接已断开时无需处理 */
  }
}

function appendHook<
  K extends
    'onRequest' | 'preParsing' | 'preValidation' | 'onResponse' | 'onError' | 'onRequestAbort',
>(route: RouteOptions, key: K, hook: NonNullable<RouteOptions[K]>): void {
  const previous = route[key]
  // Each stage keeps existing Glue/consumer hooks in their declared order.
  Object.assign(route, {
    [key]: [
      ...(previous === undefined ? [] : Array.isArray(previous) ? previous : [previous]),
      hook,
    ],
  })
}

export interface MultipartUploadLifecycle<T> {
  /** 在已筛选出的上传 route 上追加生命周期 hook，并独占 bodyLimit 赋值。 */
  attach(route: RouteOptions, policy: MultipartUploadPolicy<T>): void
  /** 无 session 时返回 undefined；失败/取消抛已分类失败；只有已解析且未终结才返回可信结果。 */
  getParsed(request: FastifyRequest): T | undefined
}

/**
 * 一条 operation 的上传生命周期注册表。
 *
 * **容量必须按 transport 注册私有，不能是进程级 singleton。**
 * 同一进程里可以有多个 `createApp()` 实例（测试、后续嵌入都属此类），
 * 模块级 controller 会让它们共用同一组槽位；某个实例带着在途上传被关闭时，
 * 计数还可能永不回收，让后续实例收到假 503。
 *
 * 请求会话存在注册表共享的 WeakMap 里（按请求键控，天然跨实例无歧义），
 * 因此可信 getter 不需要解析 `request.server` —— Glue 会在自己的封装作用域里注册路由，
 * 那里的 `request.server` 与 transport 拿到的实例并不是同一个对象。
 */
export interface MultipartUploadRegistry<T> {
  /** 为一次 transport 注册创建 controller，返回给该注册的 `onRoute` 使用。 */
  create(app: FastifyInstance): Pick<MultipartUploadLifecycle<T>, 'attach'>
  /** 无 session 时返回 undefined；失败/取消抛已分类失败；只有已解析且未终结才返回可信结果。 */
  getParsed(request: FastifyRequest): T | undefined
}

export function createMultipartUploadRegistry<T>(): MultipartUploadRegistry<T> {
  const registered = new WeakSet<FastifyInstance>()
  const sessions = new WeakMap<FastifyRequest, UploadSession<T>>()
  return {
    create(app) {
      if (registered.has(app))
        throw new Error(
          'Multipart upload lifecycle is already registered for this Fastify instance.',
        )
      registered.add(app)
      const controller = new MultipartUploadController<T>(sessions)
      return { attach: (route, policy) => controller.attach(route, policy) }
    },
    getParsed(request) {
      return sessions.get(request)?.trusted()
    },
  }
}

/**
 * 从路由 schema 读出 Contract 为该 operation 声明的响应状态码。
 *
 * `fastify-openapi-glue` 把 Contract 的 `responses` 落成 route schema 的 `response`
 * （单数，按状态码再按媒体类型键控）。提前终结适配只能输出其中之一：共享错误映射是跨模块
 * 通用的，命中未声明状态码时 `serializeInput` 会抛异常而不是回退到默认 serializer。
 */
export function declaredResponseStatuses(route: RouteOptions): number[] {
  const response =
    (route.schema as { response?: Record<string, unknown> } | undefined)?.response ?? {}
  const statuses = Object.keys(response)
    .filter((key) => /^[1-9]\d{2}$/.test(key))
    .map(Number)
  if (statuses.length === 0) {
    const operationId =
      (route.schema as { operationId?: string } | undefined)?.operationId ?? route.url
    throw new Error(`No declared response status codes for operation ${operationId}`)
  }
  return statuses
}
