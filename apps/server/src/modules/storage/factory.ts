import { mkdirSync } from 'node:fs'
import type { StorageConfig } from '@server/src/modules/storage/config.js'
import { FileAdapter } from '@server/src/modules/storage/adapters/file.js'
import {
  CosAdapter,
  createCosDependencies,
  type CosDependencies,
} from '@server/src/modules/storage/adapters/cos.js'
import { DefaultStorageService } from '@server/src/modules/storage/service.js'
import { DirectUploadService } from '@server/src/modules/storage/direct-upload.js'

export interface StorageServices {
  config: StorageConfig
  service: DefaultStorageService
  direct: DirectUploadService
  /** 本地介质的专有读取能力，只有它支持公开下载。 */
  fileAdapter: FileAdapter
  cosAdapter: CosAdapter | undefined
}

export interface CreateStorageModuleOptions {
  config: StorageConfig
  /**
   * 测试注入的 fake 云端依赖；缺省时使用真实云 SDK。
   * 注入后完全不触碰 COS/STS 网络。
   */
  cosDependencies?: CosDependencies
}

/**
 * 组装存储模块。
 *
 * 工厂不连接数据库、不读取登录状态；只有 HTTP 层通过既有 AuthService 取得用户 ID。
 */
export function createStorageModule({
  config,
  cosDependencies,
}: CreateStorageModuleOptions): StorageServices {
  mkdirSync(config.uploadsRoot, { recursive: true })
  mkdirSync(config.uploadTmpRoot, { recursive: true })

  const fileAdapter = new FileAdapter(
    config.uploadsRoot,
    config.uploadTmpRoot,
    config.publicApiBaseUrl,
  )
  const cosAdapter =
    config.cos === undefined
      ? undefined
      : new CosAdapter(config.cos, cosDependencies ?? createCosDependencies(config.cos))
  const service = new DefaultStorageService(config, {
    file: fileAdapter,
    ...(cosAdapter === undefined ? {} : { cos: cosAdapter }),
  })
  return {
    config,
    service,
    direct: new DirectUploadService(config, cosAdapter),
    fileAdapter,
    cosAdapter,
  }
}
