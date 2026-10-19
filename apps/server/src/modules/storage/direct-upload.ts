import type { StorageConfig } from '@server/src/modules/storage/config.js'
import {
  CREDENTIAL_DURATION_SECONDS,
  type CosAdapter,
  type CosTemporaryCredentials,
} from '@server/src/modules/storage/adapters/cos.js'
import { StorageError } from '@server/src/modules/storage/errors.js'
import { assertStorageKey } from '@server/src/modules/storage/key.js'
import { assertContentType, resolveMedium } from '@server/src/modules/storage/service.js'
import {
  signUploadTicket,
  verifyUploadTicket,
  type UploadTicketPayload,
} from '@server/src/modules/storage/upload-ticket.js'

export interface PrepareUploadInput {
  key: string
  size: number
  contentType: string
  medium?: string
}

export interface FileUploadPlan {
  medium: 'file'
  maxBytes: number
}

export interface CosUploadPlan {
  medium: 'cos'
  maxBytes: number
  bucket: string
  region: string
  key: string
  credentials: CosTemporaryCredentials
  uploadTicket: string
}

export type UploadPlan = FileUploadPlan | CosUploadPlan

export interface CompleteUploadInput {
  key: string
  uploadTicket: string
}

/**
 * COS 直传协调：准备（STS + 上传凭据）与完成确认。
 *
 * 用户身份由 HTTP 层传入；本服务不读取登录状态，也不落库。
 */
export class DirectUploadService {
  constructor(
    private readonly config: StorageConfig,
    private readonly cosAdapter: CosAdapter | undefined,
  ) {}

  private requireCos(): { adapter: CosAdapter; hmacKey: Buffer } {
    if (
      this.cosAdapter === undefined ||
      this.config.cos === undefined ||
      this.config.uploadHmacKey === undefined
    ) {
      throw new StorageError('STORAGE_UNAVAILABLE')
    }
    return { adapter: this.cosAdapter, hmacKey: this.config.uploadHmacKey }
  }

  /** 先校验配置、key、size、MIME，再申请 STS，最后签发凭据；任一步失败不返回部分凭证。 */
  async prepare(
    userId: string,
    input: PrepareUploadInput,
    nowSeconds = currentSeconds(),
  ): Promise<UploadPlan> {
    const key = assertStorageKey(input.key)
    if (typeof input.size !== 'number' || !Number.isSafeInteger(input.size) || input.size < 0) {
      throw new StorageError('STORAGE_INVALID_INPUT')
    }
    if (input.size > this.config.maxBytes) throw new StorageError('STORAGE_TOO_LARGE')
    const contentType = assertContentType(input.contentType)
    const medium = resolveMedium(input.medium, this.config.defaultMedium)

    if (medium === 'file') return { medium: 'file', maxBytes: this.config.maxBytes }

    const { adapter, hmacKey } = this.requireCos()
    const credentials = await adapter.issueCredentials(key)
    const expiredTime = credentials.expiredTime
    // exp 不晚于 STS expiredTime，且不超过 iat + 1800。
    const exp = Math.min(expiredTime, nowSeconds + CREDENTIAL_DURATION_SECONDS)
    const payload: UploadTicketPayload = {
      v: 1,
      userId,
      bucket: adapter.bucket,
      region: adapter.region,
      key,
      size: input.size,
      contentType,
      iat: nowSeconds,
      exp,
    }
    return {
      medium: 'cos',
      maxBytes: this.config.maxBytes,
      bucket: adapter.bucket,
      region: adapter.region,
      key,
      credentials,
      uploadTicket: signUploadTicket(payload, hmacKey),
    }
  }

  /**
   * 完成确认：只验证对象是否存在以及大小是否相符。
   * HEAD 不证明字节摘要或上传者身份，也不消除同 key 并发覆盖。
   */
  async complete(
    userId: string,
    input: CompleteUploadInput,
    nowSeconds = currentSeconds(),
  ): Promise<{ url: string }> {
    const { adapter } = this.requireCos()
    const payload = verifyUploadTicket({
      ticket: input.uploadTicket,
      hmacKey: this.config.uploadHmacKey!,
      userId,
      bucket: adapter.bucket,
      region: adapter.region,
      maxBytes: this.config.maxBytes,
      nowSeconds,
    })
    if (payload.key !== input.key) throw new StorageError('STORAGE_INVALID_INPUT')

    const head = await adapter.head(payload.key)
    if (head.bytes > this.config.maxBytes) throw new StorageError('STORAGE_TOO_LARGE')
    if (head.bytes !== payload.size) throw new StorageError('STORAGE_CONFLICT')
    return { url: await adapter.getUrl(payload.key) }
  }
}

function currentSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
