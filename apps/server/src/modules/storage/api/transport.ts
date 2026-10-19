import type { components } from '@workspace/sdk/types'
import type { Medium } from '../service.js'
import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import { authenticateBearer } from '@server/src/modules/auth/api/security.js'
import type { MultipartWireErrors } from '@server/src/http/shared/multipart-counter.js'
import {
  createMultipartUploadRegistry,
  declaredResponseStatuses,
  type MultipartParseResult,
  type MultipartUploadLimits,
  type MultipartUploadScope,
  type UploadFieldPart,
} from '@server/src/http/shared/multipart-upload-lifecycle.js'
import { StorageError, storageBusy } from '@server/src/modules/storage/errors.js'
import { assertStorageKey } from '@server/src/modules/storage/key.js'
import {
  FALLBACK_CONTENT_TYPE,
  assertContentType,
  resolveContentType,
  resolveMedium,
} from '@server/src/modules/storage/service.js'

interface UploadLimits {
  wireOverheadBytes: number
  fieldBytes: number
  fields: number
  files: number
  fieldNameBytes: number
  headerPairs: number
  headerBytes: number
  slots: number
  deadlineMs: number
}
interface DownloadLimits {
  deadlineMs: number
}

/**
 * 由解析器生成、写入 schema body 的 data 占位标识。
 * handler 必须核对可信解析上下文，伪造的 JSON 占位不能绕过真实解析。
 */
export const STORAGE_DATA_MARKER = 'storage-content'
export type StorageTransportBody = Omit<components['schemas']['StorageUploadRequest'], 'data'> & {
  data: typeof STORAGE_DATA_MARKER
}

export interface ParsedStorageUpload {
  key: string
  bytes: Uint8Array
  medium?: Medium
  contentType?: string
}

const STORAGE_WIRE_ERRORS: MultipartWireErrors = {
  tooLarge: () => new StorageError('STORAGE_TOO_LARGE'),
  malformed: () => new StorageError('STORAGE_INVALID_INPUT'),
  unsupportedMediaType: () => new StorageError('STORAGE_UNSUPPORTED_MEDIA_TYPE'),
}

/**
 * 存储上传的生命周期注册表。
 *
 * 连接时序（raw 适配、流接入、deadline、abort、buffer 与单次槽位释放）由共用 module 拥有；
 * 这里只保留配置核验、前置 Bearer 认证、key/字段/介质规则、错误分类与可信 getter。
 * controller 按 transport 注册创建：容量与加入申请彼此独立，也不与其他 Fastify 实例共享。
 */
const storageUploads = createMultipartUploadRegistry<ParsedStorageUpload>()

function config<T extends object>(value: unknown, keys: readonly string[]): T {
  if (value === null || typeof value !== 'object')
    throw new Error('Missing storage transport limits in API contract.')
  const limits = value as Record<string, unknown>
  for (const key of keys) {
    if (
      typeof limits[key] !== 'number' ||
      !Number.isSafeInteger(limits[key]) ||
      (limits[key] as number) < 1
    ) {
      throw new Error(`Invalid storage transport limit: ${key}`)
    }
  }
  return value as T
}

function appendHook<K extends 'preValidation' | 'onRequest' | 'onResponse' | 'onError'>(
  route: RouteOptions,
  key: K,
  hook: NonNullable<RouteOptions[K]>,
): void {
  const previous = route[key]
  // Each stage keeps existing Glue/consumer hooks in their declared order.
  Object.assign(route, {
    [key]: [
      ...(previous === undefined ? [] : Array.isArray(previous) ? previous : [previous]),
      hook,
    ],
  })
}

/** 文本字段：重复、未知、截断都明确失败。 */
function readTextField(part: UploadFieldPart, limits: UploadLimits): string {
  if (part.fieldnameTruncated || part.valueTruncated) throw new StorageError('STORAGE_TOO_LARGE')
  if (typeof part.value !== 'string' || Buffer.byteLength(part.value, 'utf8') > limits.fieldBytes) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  return part.value
}

/** `key/medium/contentType` 文本字段任意顺序，恰好一个 `data` 文件；未知/重复/多文件拒绝。 */
async function parseStorageUpload(
  _request: FastifyRequest,
  scope: MultipartUploadScope,
  budget: UploadLimits,
  maxBytes: number,
): Promise<MultipartParseResult<ParsedStorageUpload>> {
  let key: string | undefined, medium: string | undefined, contentType: string | undefined
  let data: Uint8Array | undefined,
    dataMediaType: string | undefined,
    textParts = 0
  for await (const part of scope.parts({
    parts: budget.fields + budget.files + 1,
    // busboy 的 files 限制会把第二个文件报成 413；这里让它多放行一个，
    // 由下面的显式检查把「多文件」归到结构错误 400。总 part 数仍受 parts 上限约束。
    files: budget.files + 1,
    fields: budget.fields,
    fieldSize: budget.fieldBytes,
    fileSize: maxBytes,
    fieldNameSize: budget.fieldNameBytes,
    headerPairs: budget.headerPairs,
    headerSize: budget.headerBytes,
  })) {
    // 字段名按 UTF-8 字节数显式复核，不能只信任 busboy 的 fieldNameSize。
    if (Buffer.byteLength(part.fieldname, 'utf8') > budget.fieldNameBytes)
      throw new StorageError('STORAGE_TOO_LARGE')

    if (part.type !== 'file') {
      if (++textParts > budget.fields) throw new StorageError('STORAGE_INVALID_INPUT')
      const value = readTextField(part, budget)
      if (part.fieldname === 'key') {
        if (key !== undefined) throw new StorageError('STORAGE_INVALID_INPUT')
        key = value
      } else if (part.fieldname === 'medium') {
        if (medium !== undefined) throw new StorageError('STORAGE_INVALID_INPUT')
        medium = value
      } else if (part.fieldname === 'contentType') {
        if (contentType !== undefined) throw new StorageError('STORAGE_INVALID_INPUT')
        contentType = value
      } else {
        throw new StorageError('STORAGE_INVALID_INPUT')
      }
      continue
    }

    if (part.fieldname !== 'data' || data !== undefined)
      throw new StorageError('STORAGE_INVALID_INPUT')
    // readFile 同时处理截断标记：绝不保存部分文件。
    data = new Uint8Array(await scope.readFile(part.file, maxBytes))
    dataMediaType = part.mimetype
  }

  if (key === undefined || data === undefined) throw new StorageError('STORAGE_INVALID_INPUT')
  const validatedKey = assertStorageKey(key)
  const resolvedMedium = medium === undefined ? undefined : resolveMedium(medium, 'file')
  // 显式 contentType 优先，其次 part MIME，最后回退。
  const resolvedType = resolveContentType(contentType, dataMediaType)
  return {
    body: {
      key: validatedKey,
      data: STORAGE_DATA_MARKER,
      ...(medium === undefined ? {} : { medium }),
      ...(resolvedType === FALLBACK_CONTENT_TYPE ? {} : { contentType: resolvedType }),
    },
    value: { key: validatedKey, bytes: data, medium: resolvedMedium, contentType: resolvedType },
  }
}

function classify(error: unknown): Error {
  if (error instanceof StorageError) return error
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 413
  ) {
    return new StorageError('STORAGE_TOO_LARGE')
  }
  return new StorageError('STORAGE_INVALID_INPUT')
}

/** handler 侧读取：必须同时核对占位标识与可信解析上下文。 */
export function getStorageUpload(request: FastifyRequest): ParsedStorageUpload {
  const body = request.body as { data?: unknown } | undefined
  if (body?.data !== STORAGE_DATA_MARKER) throw new StorageError('STORAGE_INVALID_INPUT')
  const parsed = storageUploads.getParsed(request)
  // 没有真实解析上下文（含直接 handler 调用）时一律拒绝。
  if (parsed === undefined) throw new StorageError('STORAGE_INVALID_INPUT')
  return parsed
}

/**
 * 在 Fastify 的 schema 校验之前跑模块自己的校验，
 * 让非法 key / 字段 / 票据统一产出 STORAGE_INVALID_INPUT，而不是 schema 生成的通用错误。
 */
function validateJsonBody(
  request: FastifyRequest,
  fields: readonly string[],
  known: readonly string[],
): void {
  const body: unknown = request.body
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  const value = body as Record<string, unknown>
  // 未知字段在这里拒绝，与 multipart 路径一致；落到 schema 校验会变成通用 BAD_REQUEST。
  const allowed = new Set(known)
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new StorageError('STORAGE_INVALID_INPUT')
  }
  if ('key' in value) assertStorageKey(value.key)
  if ('contentType' in value && typeof value.contentType === 'string')
    assertContentType(value.contentType)
  if ('medium' in value && value.medium !== undefined) resolveMedium(value.medium as string, 'file')
  if ('size' in value) {
    const size = value.size
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
      throw new StorageError('STORAGE_INVALID_INPUT')
    }
  }
  if ('uploadTicket' in value) {
    const ticket = value.uploadTicket
    if (typeof ticket !== 'string' || ticket.length === 0 || ticket.length > 4096) {
      throw new StorageError('STORAGE_INVALID_INPUT')
    }
  }
  for (const field of fields) {
    if (!(field in value)) throw new StorageError('STORAGE_INVALID_INPUT')
  }
}

export interface RegisterStorageTransportOptions {
  /** 运行时配置的文件字节上限，用于 wire 上限与解析期截断。 */
  maxBytes: number
}

export function registerStorageTransport(
  app: FastifyInstance,
  options: RegisterStorageTransportOptions,
): void {
  // 每次注册建一个 controller：槽位属于这个 Fastify 实例，不与其他实例共享。
  const storageUpload = storageUploads.create(app)
  app.addHook('onRoute', (route) => {
    const operationId = (route.schema as { operationId?: string } | undefined)?.operationId

    if (operationId === 'prepareStorageUpload' || operationId === 'completeStorageUpload') {
      const fields =
        operationId === 'prepareStorageUpload'
          ? (['key', 'size', 'contentType'] as const)
          : (['key', 'uploadTicket'] as const)
      // prepare 另有可选字段 medium；其余字段一律拒绝。
      const known =
        operationId === 'prepareStorageUpload'
          ? (['key', 'size', 'contentType', 'medium'] as const)
          : fields
      appendHook(route, 'preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
        void reply.header('Cache-Control', 'no-store')
        validateJsonBody(request, fields, known)
      })
      return
    }

    if (operationId === 'getStoredFile') {
      const limits = config<DownloadLimits>(
        (route.config as { storageDownload?: unknown }).storageDownload,
        ['deadlineMs'],
      )
      // HEAD 未在 Contract 声明，关闭隐式 HEAD，避免新增未登记入口。
      route.exposeHeadRoute = false
      const timers = new WeakMap<FastifyRequest, NodeJS.Timeout>()
      appendHook(route, 'preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
        void reply.header('Cache-Control', 'no-store')
        assertStorageKey((request.query as { key?: unknown }).key)
      })
      appendHook(route, 'onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        const timer = setTimeout(() => {
          // `reply.sent` 在 Fastify 5 里等于 `raw.writableEnded`：流传输中它是 false，
          // 此时再 `reply.send()` 会抛 ERR_HTTP_HEADERS_SENT（未捕获的 rejection 会终止进程）。
          // 只有响应头还没发出时才能改写成 408 envelope。
          if (!reply.raw.headersSent) void reply.send(new StorageError('STORAGE_TIMEOUT'))
          // 头已发出后只能终止连接，不能二次写入 JSON。
          else reply.raw.destroy()
        }, limits.deadlineMs)
        timer.unref()
        timers.set(request, timer)
      })
      appendHook(route, 'onResponse', async (request) => {
        const timer = timers.get(request)
        if (timer !== undefined) {
          clearTimeout(timer)
          timers.delete(request)
        }
      })
      appendHook(route, 'onError', async (request) => {
        const timer = timers.get(request)
        if (timer !== undefined) {
          clearTimeout(timer)
          timers.delete(request)
        }
      })
      return
    }

    if (operationId !== 'uploadStorageContent') return

    const budget = config<UploadLimits>(
      (route.config as { storageUpload?: unknown }).storageUpload,
      [
        'wireOverheadBytes',
        'fieldBytes',
        'fields',
        'files',
        'fieldNameBytes',
        'headerPairs',
        'headerBytes',
        'slots',
        'deadlineMs',
      ],
    )
    // wire 上限 = 文件上限 + 限定的 multipart 元数据开销；加法必须保持安全整数。
    if (!Number.isSafeInteger(options.maxBytes + budget.wireOverheadBytes)) {
      throw new Error('Storage upload wire budget is not a safe integer.')
    }
    // wire 上限不写死在 Contract 里；deadline/slots 等仍在每请求读取，测试覆盖依然生效。
    const limits: MultipartUploadLimits = {
      get wireBytes() {
        return options.maxBytes + budget.wireOverheadBytes
      },
      get headerBytes() {
        return budget.headerBytes
      },
      get headerPairs() {
        return budget.headerPairs
      },
      get slots() {
        return budget.slots
      },
      get deadlineMs() {
        return budget.deadlineMs
      },
    }
    storageUpload.attach(route, {
      limits,
      declaredStatuses: declaredResponseStatuses(route),
      errors: STORAGE_WIRE_ERRORS,
      // 认证前移：任何请求体内容被消费之前完成 Bearer 校验。
      admit: async (request) => {
        await authenticateBearer(request, request.server.authServices)
      },
      parse: (request, scope) => parseStorageUpload(request, scope, budget, options.maxBytes),
      classify,
      timedOut: () => new StorageError('STORAGE_TIMEOUT'),
      busy: () => storageBusy(),
    })
  })
}
