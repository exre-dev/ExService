import type { FastifyReply } from 'fastify'
import type { ApiRequest, ApiJsonResult } from '@server/src/http/handler-types.js'
import { requireSession } from '@server/src/modules/auth/api/handlers.js'
import { docsNotImplemented } from '../errors.js'
import type { DocsContentNode } from '../content/validation.js'
import type { DocsDocumentView } from '../service.js'

function noStore(reply: FastifyReply): void {
  void reply.header('Cache-Control', 'no-store')
}

function body(request: { body: unknown }): Record<string, unknown> {
  return request.body as Record<string, unknown>
}

function content(request: { body: unknown }): DocsContentNode {
  return body(request).content as DocsContentNode
}

/**
 * 正文已经通过 Docs profile 1 的完整校验，形状与 Contract 的递归 union 一致。
 *
 * Contract union 只约束 JSON 形状、不表达文档语法，因此这里在服务与 HTTP DTO 的边界
 * 显式定型，不把生成类型反向引入领域服务；语法、网格与预算仍由服务负责。
 */
function documentResult<
  Id extends 'getDocsDocument' | 'createDocsDocument' | 'updateDocsDocument',
>(value: { document: DocsDocumentView; treeVersion: number }): ApiJsonResult<Id> {
  return value as ApiJsonResult<Id>
}

function trashedResult(value: {
  document: DocsDocumentView
  treeVersion: number
  deletion: { batchId: string; rootId: string; deletedAt: number }
}): ApiJsonResult<'getDocsTrashedDocument'> {
  return value as ApiJsonResult<'getDocsTrashedDocument'>
}

// ---------------------------------------------------------------- 核心：空间

export async function listDocsSpaces(
  request: ApiRequest<'listDocsSpaces'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'listDocsSpaces'>> {
  noStore(reply)
  return request.server.docsServices.listSpaces({
    limit: request.query.limit,
    cursor: request.query.cursor,
  })
}

export async function createDocsSpace(
  request: ApiRequest<'createDocsSpace'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'createDocsSpace'>> {
  noStore(reply)
  const session = requireSession(request)
  const created = await request.server.docsServices.createSpace(
    { name: request.body.name, description: request.body.description },
    session.userId,
  )
  void reply.code(201)
  return created
}

export async function getDocsSpace(
  request: ApiRequest<'getDocsSpace'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getDocsSpace'>> {
  noStore(reply)
  return request.server.docsServices.getSpace(request.params.spaceId)
}

export async function updateDocsSpace(
  request: ApiRequest<'updateDocsSpace'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'updateDocsSpace'>> {
  noStore(reply)
  const session = requireSession(request)
  return request.server.docsServices.updateSpace(
    request.params.spaceId,
    request.body,
    session.userId,
  )
}

export async function deleteDocsSpace(
  request: ApiRequest<'deleteDocsSpace'>,
  reply: FastifyReply,
): Promise<void> {
  noStore(reply)
  const session = requireSession(request)
  await request.server.docsServices.deleteSpace(request.params.spaceId, request.body)
  void reply.code(204)
}

// ---------------------------------------------------------------- 核心：文档树与内容

export async function getDocsTree(
  request: ApiRequest<'getDocsTree'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getDocsTree'>> {
  noStore(reply)
  return request.server.docsServices.getTree(request.params.spaceId, {
    limit: request.query.limit,
    cursor: request.query.cursor,
    parentId: request.query.parentId,
  })
}

export async function createDocsDocument(
  request: ApiRequest<'createDocsDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'createDocsDocument'>> {
  noStore(reply)
  const session = requireSession(request)
  const source = body(request)
  const created = await request.server.docsServices.createDocument(
    request.params.spaceId,
    {
      expectedTreeVersion: source.expectedTreeVersion as number,
      parentId: (source.parentId ?? null) as string | null,
      beforeDocumentId: (source.beforeDocumentId ?? null) as string | null,
      title: source.title as string,
      content: content(request),
    },
    session.userId,
  )
  void reply.code(201)
  return documentResult(created)
}

export async function getDocsDocument(
  request: ApiRequest<'getDocsDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getDocsDocument'>> {
  noStore(reply)
  return documentResult(await request.server.docsServices.getDocument(request.params.documentId))
}

export async function updateDocsDocument(
  request: ApiRequest<'updateDocsDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'updateDocsDocument'>> {
  noStore(reply)
  const session = requireSession(request)
  const source = body(request)
  return documentResult(
    await request.server.docsServices.saveDocument(
      request.params.documentId,
      {
        expectedSpaceId: source.expectedSpaceId as string,
        expectedVersion: source.expectedVersion as number,
        title: source.title as string,
        content: content(request),
      },
      session.userId,
    ),
  )
}

export async function moveDocsDocument(
  request: ApiRequest<'moveDocsDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'moveDocsDocument'>> {
  noStore(reply)
  const session = requireSession(request)
  const source = body(request)
  return request.server.docsServices.moveDocument(
    request.params.documentId,
    {
      sourceSpaceId: source.sourceSpaceId as string,
      targetSpaceId: source.targetSpaceId as string,
      expectedVersion: source.expectedVersion as number,
      expectedSourceTreeVersion: source.expectedSourceTreeVersion as number,
      expectedTargetTreeVersion: source.expectedTargetTreeVersion as number,
      parentId: (source.parentId ?? null) as string | null,
      beforeDocumentId: (source.beforeDocumentId ?? null) as string | null,
    },
    session.userId,
  )
}

export async function trashDocsDocument(
  request: ApiRequest<'trashDocsDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'trashDocsDocument'>> {
  noStore(reply)
  const session = requireSession(request)
  return request.server.docsServices.trashDocument(
    request.params.documentId,
    request.body,
    session.userId,
  )
}

export async function listDocsTrash(
  request: ApiRequest<'listDocsTrash'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'listDocsTrash'>> {
  noStore(reply)
  requireSession(request)
  return request.server.docsServices.listTrash(request.params.spaceId, {
    limit: request.query.limit,
    cursor: request.query.cursor,
  })
}

export async function getDocsTrashedDocument(
  request: ApiRequest<'getDocsTrashedDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getDocsTrashedDocument'>> {
  noStore(reply)
  requireSession(request)
  return trashedResult(
    await request.server.docsServices.getTrashedDocument(request.params.documentId),
  )
}

export async function restoreDocsDocument(
  request: ApiRequest<'restoreDocsDocument'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'restoreDocsDocument'>> {
  noStore(reply)
  const session = requireSession(request)
  return request.server.docsServices.restoreDocument(
    request.params.documentId,
    request.body,
    session.userId,
  )
}

// ---------------------------------------------------------------- B 类预留

/**
 * 全部 B 类 operation 在本期明确抛出 501。
 *
 * 它们都有真实 handler，直接调用 handler 也会抛同一错误，不会退化成 Glue 缺失 handler 的
 * 默认 500；不访问数据库、存储或模型，不返回空列表或假成功结果。
 */
function notImplemented(): never {
  throw docsNotImplemented()
}

export async function searchDocsDocuments(
  _request: ApiRequest<'searchDocsDocuments'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'searchDocsDocuments'>> {
  noStore(reply)
  return notImplemented()
}

export async function suggestDocsDocumentContent(
  request: ApiRequest<'suggestDocsDocumentContent'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'suggestDocsDocumentContent'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function listDocsTemplates(
  request: ApiRequest<'listDocsTemplates'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'listDocsTemplates'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function createDocsTemplate(
  request: ApiRequest<'createDocsTemplate'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'createDocsTemplate'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function getDocsTemplate(
  request: ApiRequest<'getDocsTemplate'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getDocsTemplate'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function updateDocsTemplate(
  request: ApiRequest<'updateDocsTemplate'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'updateDocsTemplate'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function deleteDocsTemplate(
  request: ApiRequest<'deleteDocsTemplate'>,
  reply: FastifyReply,
): Promise<void> {
  noStore(reply)
  requireSession(request)
  notImplemented()
}

export async function applyDocsTemplate(
  request: ApiRequest<'applyDocsTemplate'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'applyDocsTemplate'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function listDocsAttachments(
  _request: ApiRequest<'listDocsAttachments'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'listDocsAttachments'>> {
  noStore(reply)
  return notImplemented()
}

export async function uploadDocsAttachment(
  request: ApiRequest<'uploadDocsAttachment'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'uploadDocsAttachment'>> {
  noStore(reply)
  requireSession(request)
  // 不读取或验证 multipart payload：认证通过后立即返回预留响应。
  return notImplemented()
}

export async function getDocsAttachment(
  _request: ApiRequest<'getDocsAttachment'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getDocsAttachment'>> {
  noStore(reply)
  return notImplemented()
}

export async function deleteDocsAttachment(
  request: ApiRequest<'deleteDocsAttachment'>,
  reply: FastifyReply,
): Promise<void> {
  noStore(reply)
  requireSession(request)
  notImplemented()
}

export async function listDocsComments(
  _request: ApiRequest<'listDocsComments'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'listDocsComments'>> {
  noStore(reply)
  return notImplemented()
}

export async function createDocsComment(
  request: ApiRequest<'createDocsComment'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'createDocsComment'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function updateDocsComment(
  request: ApiRequest<'updateDocsComment'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'updateDocsComment'>> {
  noStore(reply)
  requireSession(request)
  return notImplemented()
}

export async function deleteDocsComment(
  request: ApiRequest<'deleteDocsComment'>,
  reply: FastifyReply,
): Promise<void> {
  noStore(reply)
  requireSession(request)
  notImplemented()
}
