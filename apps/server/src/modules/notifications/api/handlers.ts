import type { ApiRequest, ApiJsonResult } from '@server/src/http/handler-types.js'
import type { FastifyReply } from 'fastify'
import { requireSession } from '@server/src/modules/auth/api/handlers.js'

/**
 * Contract 登记的 handler。
 *
 * 所有路径都只接受已认证会话，userId 一律取自认证上下文，不接受请求体里的身份。
 * 响应全部 no-store：通知是私人数据。
 */

export async function listNotifications(
  request: ApiRequest<'listNotifications'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'listNotifications'>> {
  void reply.header('Cache-Control', 'no-store')
  const query = request.query
  return request.server.notifications.service.list({
    userId: requireSession(request).userId,
    view: query.view,
    scope: query.scope ?? null,
    category: query.category ?? null,
    limit: query.limit ?? null,
    cursor: query.cursor ?? null,
  })
}

export async function getNotificationSummary(
  request: ApiRequest<'getNotificationSummary'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getNotificationSummary'>> {
  void reply.header('Cache-Control', 'no-store')
  return request.server.notifications.service.summary(requireSession(request).userId)
}

export async function getNotification(
  request: ApiRequest<'getNotification'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getNotification'>> {
  void reply.header('Cache-Control', 'no-store')
  const { notificationId } = request.params
  return request.server.notifications.service.detail(requireSession(request).userId, notificationId)
}

export async function updateNotificationState(
  request: ApiRequest<'updateNotificationState'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'updateNotificationState'>> {
  void reply.header('Cache-Control', 'no-store')
  const { notificationId } = request.params
  const body = request.body
  return request.server.notifications.service.updateState(
    requireSession(request).userId,
    notificationId,
    body.read,
    body.expectedRevision,
  )
}

export async function markNotificationsReadThrough(
  request: ApiRequest<'markNotificationsReadThrough'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'markNotificationsReadThrough'>> {
  void reply.header('Cache-Control', 'no-store')
  const body = request.body
  return request.server.notifications.service.readThrough(
    requireSession(request).userId,
    body.requestId,
    body.readThroughToken,
  )
}

export async function previewNotificationClear(
  request: ApiRequest<'previewNotificationClear'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'previewNotificationClear'>> {
  void reply.header('Cache-Control', 'no-store')
  return request.server.notifications.service.previewClear(requireSession(request).userId)
}

export async function clearNotificationsSnapshot(
  request: ApiRequest<'clearNotificationsSnapshot'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'clearNotificationsSnapshot'>> {
  void reply.header('Cache-Control', 'no-store')
  const body = request.body
  return request.server.notifications.service.clearSnapshot(
    requireSession(request).userId,
    body.requestId,
    body.clearSnapshotToken,
  )
}

export async function getNotificationPreferences(
  request: ApiRequest<'getNotificationPreferences'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getNotificationPreferences'>> {
  void reply.header('Cache-Control', 'no-store')
  return request.server.notifications.service.getPreferences(requireSession(request).userId)
}

export async function updateNotificationPreferences(
  request: ApiRequest<'updateNotificationPreferences'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'updateNotificationPreferences'>> {
  void reply.header('Cache-Control', 'no-store')
  const body = request.body
  return request.server.notifications.service.updatePreferences(
    requireSession(request).userId,
    body.expectedRevision,
    body.optionalCategories,
  )
}
