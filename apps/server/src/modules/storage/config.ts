import { resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Medium } from '@server/src/modules/storage/service.js'

export interface CosConfig {
  secretId: string
  secretKey: string
  region: string
  bucket: string
  /** bucket 后缀中的 APPID，用于拼装 STS 的精确资源标识。 */
  appId: string
}

export interface StorageConfig {
  defaultMedium: Medium
  maxBytes: number
  /** 已去掉末尾斜杠的公开 API 基址，例如 `http://127.0.0.1:8080/api`。 */
  publicApiBaseUrl: string
  uploadsRoot: string
  uploadTmpRoot: string
  cos: CosConfig | undefined
  /** 启用 COS 时必填的 32 字节十六进制 HMAC 密钥。 */
  uploadHmacKey: Buffer | undefined
}

/**
 * 配置错误只携带「哪个变量缺失或非法」，不携带变量值、路径或底层异常。
 * `server.ts` 直接把 `message` 作为安全文案输出。
 */
export class StorageConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`存储配置无效：${problems.join('；')}`)
    this.name = 'StorageConfigError'
  }
}

export const DEFAULT_STORAGE_MAX_BYTES = 20 * 1024 * 1024
export const DEFAULT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080/api'

const COS_ENV_NAMES = [
  'TENCENT_COS_SECRET_ID',
  'TENCENT_COS_SECRET_KEY',
  'TENCENT_COS_REGION',
  'TENCENT_COS_BUCKET',
] as const
const HEX_64 = /^[0-9a-f]{64}$/
const BUCKET_WITH_APP_ID = /^[a-z0-9][a-z0-9-]{0,62}-(\d{4,20})$/

/**
 * 服务器包根目录：模块文件在 `src/modules/storage/` 或 `dist/modules/storage/` 下，
 * 两种情况都向上三级得到 `apps/server`，因此不依赖进程 cwd。
 */
function serverPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
}

function positiveSafeInteger(raw: string | undefined, name: string, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  if (!/^[0-9]+$/.test(raw)) throw new StorageConfigError([`${name} 必须是正整数`])
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1)
    throw new StorageConfigError([`${name} 必须是正整数`])
  return value
}

function publicApiBaseUrl(raw: string | undefined): string {
  const value = raw === undefined || raw === '' ? DEFAULT_PUBLIC_API_BASE_URL : raw
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new StorageConfigError(['STORAGE_PUBLIC_API_BASE_URL 必须是绝对 HTTP(S) 地址'])
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new StorageConfigError(['STORAGE_PUBLIC_API_BASE_URL 必须是绝对 HTTP(S) 地址'])
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new StorageConfigError(['STORAGE_PUBLIC_API_BASE_URL 不得包含凭据、query 或 hash'])
  }
  // 末尾斜杠统一去掉，拼接 `/storage/files` 时不会出现双斜杠。
  return url.href.replace(/\/+$/, '')
}

function cosConfig(env: NodeJS.ProcessEnv): CosConfig | undefined {
  const values = COS_ENV_NAMES.map((name) => env[name])
  const present = values.filter((value) => typeof value === 'string' && value !== '')
  if (present.length === 0) return undefined
  const missing = COS_ENV_NAMES.filter((name) => typeof env[name] !== 'string' || env[name] === '')
  if (missing.length > 0) {
    throw new StorageConfigError([`COS 配置不完整，缺少 ${missing.join('、')}`])
  }
  const bucket = env.TENCENT_COS_BUCKET!
  const appId = BUCKET_WITH_APP_ID.exec(bucket)?.[1]
  if (appId === undefined) {
    throw new StorageConfigError(['TENCENT_COS_BUCKET 必须是带 APPID 后缀的 bucket 名'])
  }
  return {
    secretId: env.TENCENT_COS_SECRET_ID!,
    secretKey: env.TENCENT_COS_SECRET_KEY!,
    region: env.TENCENT_COS_REGION!,
    bucket,
    appId,
  }
}

export interface ParseStorageConfigOptions {
  /**
   * 数据根目录，默认是服务器包根下的 `data/`。
   * 测试注入临时目录，避免写入开发数据。
   */
  dataRoot?: string
}

export function parseStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: ParseStorageConfigOptions = {},
): StorageConfig {
  const rawMedium = env.STORAGE_DEFAULT_ADAPTER
  const defaultMedium = rawMedium === undefined || rawMedium === '' ? 'file' : rawMedium
  if (defaultMedium !== 'file' && defaultMedium !== 'cos') {
    throw new StorageConfigError(['STORAGE_DEFAULT_ADAPTER 只能是 file 或 cos'])
  }

  const maxBytes = positiveSafeInteger(
    env.STORAGE_MAX_BYTES,
    'STORAGE_MAX_BYTES',
    DEFAULT_STORAGE_MAX_BYTES,
  )
  const cos = cosConfig(env)
  const root = options.dataRoot ?? resolve(serverPackageRoot(), 'data')

  const rawHmacKey = env.STORAGE_UPLOAD_HMAC_KEY
  let uploadHmacKey: Buffer | undefined
  if (rawHmacKey !== undefined && rawHmacKey !== '') {
    // 严格 64 位十六进制：与 AUTH_CODE_HMAC_KEY 独立，且不弱化字符集。
    if (!HEX_64.test(rawHmacKey)) {
      throw new StorageConfigError(['STORAGE_UPLOAD_HMAC_KEY 必须是 64 位十六进制字符串'])
    }
    uploadHmacKey = Buffer.from(rawHmacKey, 'hex')
  }

  if (defaultMedium === 'cos') {
    const missing: string[] = []
    if (cos === undefined) missing.push(...COS_ENV_NAMES)
    if (uploadHmacKey === undefined) missing.push('STORAGE_UPLOAD_HMAC_KEY')
    if (missing.length > 0) {
      throw new StorageConfigError([`默认介质为 cos，缺少 ${missing.join('、')}`])
    }
  } else if (cos !== undefined && uploadHmacKey === undefined) {
    // 任一 COS 配置出现即检查完整性：显式选择 cos 时不能悄悄回退到本地介质。
    throw new StorageConfigError(['已配置 COS 但缺少 STORAGE_UPLOAD_HMAC_KEY'])
  }

  return {
    defaultMedium,
    maxBytes,
    publicApiBaseUrl: publicApiBaseUrl(env.STORAGE_PUBLIC_API_BASE_URL),
    uploadsRoot: resolve(root, 'uploads'),
    uploadTmpRoot: resolve(root, 'upload-tmp'),
    cos,
    uploadHmacKey,
  }
}
