import COS from 'cos-nodejs-sdk-v5'
import sts from 'qcloud-cos-sts'
import type { CosConfig } from '@server/src/modules/storage/config.js'
import { StorageError } from '@server/src/modules/storage/errors.js'
import type { StorageAdapter } from '@server/src/modules/storage/service.js'

/** 一年下载签名：365 天的秒数。 */
export const DOWNLOAD_URL_EXPIRES_SECONDS = 365 * 24 * 60 * 60
/** STS 与上传凭据的有效期：30 分钟。 */
export const CREDENTIAL_DURATION_SECONDS = 30 * 60
/** 云操作截止时间。超时与依赖失败同属上游故障。 */
export const COS_DEADLINE_MS = 120_000

export interface CosTemporaryCredentials {
  tmpSecretId: string
  tmpSecretKey: string
  securityToken: string
  startTime: number
  expiredTime: number
}

/**
 * 可注入的云端依赖。
 *
 * 测试注入 fake，因此真实云 SDK 不会被单测触碰；生产实现全部集中在本文件末尾。
 */
export interface CosDependencies {
  putObject(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<void>
  headObject(input: { key: string }): Promise<{ bytes: number }>
  signDownloadUrl(input: { key: string }): string
  issueCredentials(input: { key: string }): Promise<CosTemporaryCredentials>
}

/**
 * 云端错误的收敛边界。
 *
 * 映射放在 Adapter 层而不是 `createCosDependencies` 内，因此注入的 fake 与真实 SDK
 * 一样被归类：未知异常一律成为 502，绝不把云 SDK 原始消息带出模块。
 */
function classify(error: unknown, allowNotFound: boolean): StorageError {
  if (error instanceof StorageError) return error
  const original = error instanceof CosOperationFailed ? error.original : error
  if (allowNotFound && isCosNotFound(original)) return new StorageError('STORAGE_NOT_FOUND')
  return new StorageError('STORAGE_UPSTREAM_FAILED')
}

export class CosAdapter implements StorageAdapter {
  constructor(
    private readonly config: CosConfig,
    private readonly dependencies: CosDependencies,
  ) {}

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    try {
      await this.dependencies.putObject({ key, bytes, contentType })
    } catch (error) {
      throw classify(error, false)
    }
  }

  async getUrl(key: string): Promise<string> {
    return this.dependencies.signDownloadUrl({ key })
  }

  /** 完成确认只验证对象存在与大小，不证明字节摘要或上传者身份。 */
  async head(key: string): Promise<{ bytes: number }> {
    try {
      return await this.dependencies.headObject({ key })
    } catch (error) {
      throw classify(error, true)
    }
  }

  async issueCredentials(key: string): Promise<CosTemporaryCredentials> {
    try {
      return await this.dependencies.issueCredentials({ key })
    } catch (error) {
      throw classify(error, false)
    }
  }

  get bucket(): string {
    return this.config.bucket
  }

  get region(): string {
    return this.config.region
  }
}

/**
 * 云操作失败的内部包装：保留原始异常供分支判断（例如 404），
 * 但原始异常绝不进入对外消息 —— 它可能包含账号、签名或请求细节。
 */
class CosOperationFailed extends Error {
  constructor(readonly original: unknown) {
    super('cos operation failed')
    this.name = 'CosOperationFailed'
  }
}

async function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new StorageError('STORAGE_UPSTREAM_FAILED')),
          COS_DEADLINE_MS,
        )
        timer.unref()
      }),
    ])
  } catch (error) {
    // 云 SDK 原始异常可能包含账号、签名或请求细节，统一收敛为上游故障分类。
    if (error instanceof StorageError) throw error
    throw new CosOperationFailed(error)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function contentLength(headers: Record<string, unknown> | undefined): number | undefined {
  const value = headers?.['content-length']
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return Number(value)
  return undefined
}

/**
 * STS policy：只授权配置 bucket 内本次 key 的 PutObject。
 *
 * 不使用 `getPolicy()` helper —— 它按客户端 SDK 的 scope 格式生成，
 * 会拼出 `prefix//<appid>/<bucket>/<key>` 这类错误资源标识。
 */
export function putObjectPolicy(config: CosConfig, key: string): Record<string, unknown> {
  return {
    version: '2.0',
    statement: [
      {
        action: ['name/cos:PutObject'],
        effect: 'allow',
        principal: { qcs: ['*'] },
        resource: [`qcs::cos:${config.region}:uid/${config.appId}:${config.bucket}/${key}`],
      },
    ],
  }
}

export function createCosDependencies(config: CosConfig): CosDependencies {
  const client = new COS({ SecretId: config.secretId, SecretKey: config.secretKey })

  return {
    async putObject({ key, bytes, contentType }) {
      await withDeadline(
        client.putObject({
          Bucket: config.bucket,
          Region: config.region,
          Key: key,
          Body: Buffer.from(bytes),
          // 显式长度：Body 是 Buffer 时不让 SDK 走流式上传。
          ContentLength: bytes.byteLength,
          ContentType: contentType,
          ContentDisposition: 'attachment',
          CacheControl: 'no-store',
        }),
      )
    },

    async headObject({ key }) {
      // 缺失与上游故障的区分交给 Adapter 层的 classify。
      const result = await withDeadline(
        client.headObject({ Bucket: config.bucket, Region: config.region, Key: key }),
      )
      const bytes = contentLength(result.headers)
      if (bytes === undefined) throw new StorageError('STORAGE_UPSTREAM_FAILED')
      return { bytes }
    },

    signDownloadUrl({ key }) {
      // 服务端长期凭证签发：临时凭证会把地址有效期缩短到 30 分钟。
      // 签名参数一次性准备完整，签完不再拼接或修改。
      return client.getObjectUrl({
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Method: 'GET',
        Sign: true,
        Expires: DOWNLOAD_URL_EXPIRES_SECONDS,
        Protocol: 'https:',
        Query: { 'response-content-disposition': 'attachment' },
      })
    },

    async issueCredentials({ key }) {
      const data = await withDeadline(
        sts.getCredential({
          secretId: config.secretId,
          secretKey: config.secretKey,
          policy: putObjectPolicy(config, key),
          durationSeconds: CREDENTIAL_DURATION_SECONDS,
        }),
      )
      return {
        tmpSecretId: data.credentials.tmpSecretId,
        tmpSecretKey: data.credentials.tmpSecretKey,
        securityToken: data.credentials.sessionToken,
        startTime: data.startTime,
        expiredTime: data.expiredTime,
      }
    },
  }
}

/**
 * 对象不存在不是上游故障：完成确认需要把它映射成 404。
 * 云 SDK 用 statusCode 404 或 NoSuchKey 表达缺失。
 */
export function isCosNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { statusCode?: unknown; code?: unknown }
  return candidate.statusCode === 404 || candidate.code === 'NoSuchKey'
}
