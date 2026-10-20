import { StorageSdkError, toStorageSdkError } from '../errors.js'
import type { ConfigSnapshot, SdkConfig } from '../config.js'
import type { HttpRequest, RequestConfig, ResponseFor } from '../request-types.js'
import type { UploadData, UploadOptions, Storage } from './types.js'
export const REQUEST_TIMEOUT_MS = 120_000
export const FALLBACK_CONTENT_TYPE = 'application/octet-stream'
const CONTENT_TYPE_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

export function resolveContentType(
  explicit: string | undefined,
  blobType: string | undefined,
): string {
  if (explicit !== undefined) return explicit
  if (
    typeof blobType === 'string' &&
    blobType !== '' &&
    blobType.length <= 127 &&
    CONTENT_TYPE_PATTERN.test(blobType)
  ) {
    return blobType
  }
  return FALLBACK_CONTENT_TYPE
}

/** 与服务端一致的只读视图复制：不上传底层 ArrayBuffer 的额外字节。 */
async function toBytes(data: UploadData): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return new Uint8Array(data).slice()
  if (data instanceof Blob) {
    try {
      return new Uint8Array(await data.arrayBuffer())
    } catch {
      throw new StorageSdkError('INVALID_INPUT')
    }
  }
  throw new StorageSdkError('INVALID_INPUT', { detail: 'unsupported binary input' })
}

async function apiRequest<T>(pending: Promise<T>): Promise<T> {
  try {
    return await pending
  } catch (cause) {
    throw toStorageSdkError({ cause })
  }
}

/**
 * 上传协调：归一化输入 → PHP prepare → file multipart → 返回 URL。
 */
export function createStorage(
  state: SdkConfig,
  request: (config: HttpRequest, expected?: ConfigSnapshot) => Promise<unknown>,
  requestPolicy: { timeoutMs?: number; signal?: AbortSignal } = {},
): Storage {
  function check(expected: ConfigSnapshot) {
    if (!state.matches(expected)) throw new StorageSdkError('CONFIG_CHANGED')
  }
  async function stage<C extends RequestConfig>(
    config: C,
    expected: ConfigSnapshot,
  ): Promise<ResponseFor<C>> {
    return apiRequest(request(config as HttpRequest, expected)) as Promise<ResponseFor<C>>
  }
  async function upload(
    key: string,
    data: UploadData,
    uploadOptions: UploadOptions = {},
  ): Promise<string> {
    const expected = state.resolve()
    if (!expected.token) throw new StorageSdkError('UNAUTHORIZED')
    if (typeof key !== 'string' || key.length === 0) {
      throw new StorageSdkError('INVALID_INPUT', { detail: 'key is required' })
    }
    if (
      !uploadOptions ||
      typeof uploadOptions !== 'object' ||
      Array.isArray(uploadOptions) ||
      Object.keys(uploadOptions).some((key) => key !== 'medium' && key !== 'contentType') ||
      (uploadOptions.medium !== undefined &&
        uploadOptions.medium !== 'file' &&
        uploadOptions.medium !== 'cos') ||
      (uploadOptions.contentType !== undefined &&
        (typeof uploadOptions.contentType !== 'string' ||
          uploadOptions.contentType.length > 127 ||
          !CONTENT_TYPE_PATTERN.test(uploadOptions.contentType)))
    ) {
      throw new StorageSdkError('INVALID_INPUT')
    }
    const bytes = await toBytes(data)
    const contentType = resolveContentType(
      uploadOptions.contentType,
      data instanceof Uint8Array ? undefined : data.type,
    )

    check(expected)
    const prepared = await stage(
      {
        url: '/api/storage/uploads/prepare',
        method: 'POST',
        timeout: requestPolicy.timeoutMs ?? REQUEST_TIMEOUT_MS,
        signal: requestPolicy.signal,
        alert: false,
        data: {
          key,
          size: bytes.byteLength,
          contentType,
          ...(uploadOptions.medium === undefined ? {} : { medium: uploadOptions.medium }),
        },
      },
      expected,
    )
    check(expected)
    const plan = prepared.data

    // prepare 的 maxBytes 只是客户端预检，服务器仍是最终校验者。
    if (bytes.byteLength > plan.maxBytes) throw new StorageSdkError('TOO_LARGE')

    if (plan.medium !== 'file') throw new StorageSdkError('UNAVAILABLE')

    // FormData 序列化：boundary 由运行时生成，不手写 Content-Type。
    // `new Uint8Array(bytes)` 复制到新的 ArrayBuffer，同时也满足 BlobPart 的类型要求。
    const form = new FormData()
    form.append('key', key)
    form.append('medium', 'file')
    form.append('contentType', contentType)
    form.append(
      'data',
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      key.split('/').pop() ?? key,
    )

    check(expected)
    const uploaded = await stage(
      {
        url: '/api/storage/uploads',
        method: 'POST',
        timeout: requestPolicy.timeoutMs ?? REQUEST_TIMEOUT_MS,
        signal: requestPolicy.signal,
        alert: false,
        data: form,
      },
      expected,
    )
    check(expected)
    return uploaded.data.url
  }

  return { upload }
}
