import type {
  ApiRequest,
  ApiTransportRequest,
  ApiJsonResult,
} from '@server/src/http/handler-types.js'
import type { FastifyReply } from 'fastify'
import { requireSession } from '@server/src/modules/auth/api/handlers.js'
import {
  assertStorageKey,
  lastKeySegment,
  quotedStringFilename,
} from '@server/src/modules/storage/key.js'
import {
  getStorageUpload,
  type StorageTransportBody,
} from '@server/src/modules/storage/api/transport.js'

export async function prepareStorageUpload(
  request: ApiRequest<'prepareStorageUpload'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'prepareStorageUpload'>> {
  void reply.header('Cache-Control', 'no-store')
  const session = requireSession(request)
  const body = request.body
  return request.server.storageServices.direct.prepare(session.userId, body)
}

export async function uploadStorageContent(
  request: ApiTransportRequest<'uploadStorageContent', StorageTransportBody>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'uploadStorageContent'>> {
  void reply.header('Cache-Control', 'no-store')
  // 认证由 transport 的 onRequest 前移完成，Glue 的 preHandler 再复核一次。
  requireSession(request)
  // 必须走可信解析上下文：schema body 里的 data 只是占位标识。
  const parsed = getStorageUpload(request)
  const url = await request.server.storageServices.service.upload(parsed.key, parsed.bytes, {
    ...(parsed.medium === undefined ? {} : { medium: parsed.medium }),
    ...(parsed.contentType === undefined ? {} : { contentType: parsed.contentType }),
  })
  return { url }
}

export async function completeStorageUpload(
  request: ApiRequest<'completeStorageUpload'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'completeStorageUpload'>> {
  void reply.header('Cache-Control', 'no-store')
  const session = requireSession(request)
  const body = request.body
  return request.server.storageServices.direct.complete(session.userId, body)
}

/**
 * 本地介质的公开读取。
 *
 * 响应头发出前的失败返回 envelope；发出后读取失败只能终止连接，不二次写入 JSON。
 */
export async function getStoredFile(
  request: ApiRequest<'getStoredFile'>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  void reply.header('Cache-Control', 'no-store')
  const key = assertStorageKey(request.query.key)
  const read = await request.server.storageServices.fileAdapter.openRead(key)
  // 等待打开期间可能已超时或断开；此时 close 已发生，不能再靠监听器回收。
  if (reply.sent || reply.raw.writableEnded || reply.raw.destroyed) {
    await read.release()
    return reply
  }
  void reply.header('Content-Length', String(read.bytes))
  void reply.header(
    'Content-Disposition',
    `attachment; filename=${quotedStringFilename(lastKeySegment(key))}`,
  )
  void reply.header('X-Content-Type-Options', 'nosniff')
  void reply.type('application/octet-stream')
  // 首版不支持 Range：收到 Range 仍返回完整 200。
  reply.raw.once('close', () => {
    void read.release()
  })
  return reply.send(read.stream)
}
