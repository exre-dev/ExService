import type { StorageConfig } from '@server/src/modules/storage/config.js'
import { StorageError } from '@server/src/modules/storage/errors.js'
import { assertStorageKey } from '@server/src/modules/storage/key.js'

export type Medium = 'file' | 'cos'

/** File 是 Blob 的子类，Buffer 是 Uint8Array 的子类，因此这两类覆盖浏览器与 Node 的输入。 */
export type UploadData = Blob | Uint8Array

export interface UploadOptions {
  medium?: Medium
  contentType?: string
}

/**
 * Adapter 的基础能力只有写入和生成访问地址。
 * 本地公开读取、COS 元数据查询与 STS 签发是各自介质的专有能力，不要求其他 Adapter 虚假实现。
 */
export interface StorageAdapter {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  getUrl(key: string): Promise<string>
}

export interface StorageService {
  upload(key: string, data: UploadData, options?: UploadOptions): Promise<string>
}

export const FALLBACK_CONTENT_TYPE = 'application/octet-stream'

/** 无参数的 ASCII `type/subtype`，长度上限 127，禁止 CR/LF。 */
const CONTENT_TYPE_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/
const CONTENT_TYPE_MAX_LENGTH = 127

export function assertContentType(value: string): string {
  if (
    value.length === 0 ||
    value.length > CONTENT_TYPE_MAX_LENGTH ||
    !CONTENT_TYPE_PATTERN.test(value)
  ) {
    throw new StorageError('STORAGE_INVALID_INPUT')
  }
  return value
}

/** 有效 MIME 优先级：显式 options.contentType、非空 Blob.type、application/octet-stream。 */
export function resolveContentType(
  explicit: string | undefined,
  blobType: string | undefined,
): string {
  if (explicit !== undefined) return assertContentType(explicit)
  if (typeof blobType === 'string' && blobType !== '') {
    // Blob.type 来自调用方，可能携带参数或非法字符；不通过时回退而不是报错。
    if (blobType.length <= CONTENT_TYPE_MAX_LENGTH && CONTENT_TYPE_PATTERN.test(blobType))
      return blobType
  }
  return FALLBACK_CONTENT_TYPE
}

export function resolveMedium(requested: string | undefined, fallback: Medium): Medium {
  if (requested === undefined) return fallback
  if (requested !== 'file' && requested !== 'cos') throw new StorageError('STORAGE_INVALID_INPUT')
  return requested
}

/**
 * 只读视图：Uint8Array 可能只是底层 ArrayBuffer 的一段，
 * 必须只复制其有效区间，否则会把 ArrayBuffer 的额外字节一起上传。
 */
function copyBytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(data).slice()
}

/** 先按声明大小拒绝超限输入，再读取 Blob 内容，避免为了校验而缓冲超大文件。 */
async function toBytes(data: UploadData, maxBytes: number): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    if (data.byteLength > maxBytes) throw new StorageError('STORAGE_TOO_LARGE')
    return copyBytes(data)
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    typeof data.size === 'number' &&
    typeof data.arrayBuffer === 'function'
  ) {
    if (!Number.isSafeInteger(data.size)) throw new StorageError('STORAGE_INVALID_INPUT')
    if (data.size > maxBytes) throw new StorageError('STORAGE_TOO_LARGE')
    const buffer = await (data as Blob).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes.byteLength > maxBytes) throw new StorageError('STORAGE_TOO_LARGE')
    return bytes
  }
  throw new StorageError('STORAGE_INVALID_INPUT')
}

/**
 * 介质选择、输入归一化、大小与 MIME 校验、上传与 URL 返回。
 *
 * 不依赖 HTTP、登录会话与数据库；内部调用与 HTTP handler 走同一条路径。
 */
export class DefaultStorageService implements StorageService {
  constructor(
    private readonly config: StorageConfig,
    private readonly adapters: Partial<Record<Medium, StorageAdapter>>,
  ) {}

  get maxBytes(): number {
    return this.config.maxBytes
  }

  get defaultMedium(): Medium {
    return this.config.defaultMedium
  }

  adapter(medium: Medium): StorageAdapter {
    const adapter = this.adapters[medium]
    if (adapter === undefined) throw new StorageError('STORAGE_UNAVAILABLE')
    return adapter
  }

  async upload(key: string, data: UploadData, options: UploadOptions = {}): Promise<string> {
    const validatedKey = assertStorageKey(key)
    const medium = resolveMedium(options.medium, this.config.defaultMedium)
    const adapter = this.adapter(medium)
    const contentType = resolveContentType(
      options.contentType,
      data instanceof Uint8Array ? undefined : data.type,
    )
    const bytes = await toBytes(data, this.config.maxBytes)
    await adapter.put(validatedKey, bytes, contentType)
    return adapter.getUrl(validatedKey)
  }
}
