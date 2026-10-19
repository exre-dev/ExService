import type { ApiRequest, ApiJsonResult } from '../../../http/handler-types.js'
import type { FastifyReply } from 'fastify'
import { getSupportUpload } from './transport.js'
const noStore = (reply: FastifyReply) => {
  void reply.header('Cache-Control', 'no-store')
}
export async function getSupportFeedbackOptions(
  request: ApiRequest<'getSupportFeedbackOptions'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getSupportFeedbackOptions'>> {
  noStore(reply)
  return request.server.supportServices.options(request.query?.area)
}
export async function prepareSupportFeedback(
  request: ApiRequest<'prepareSupportFeedback'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'prepareSupportFeedback'>> {
  noStore(reply)
  const r = await request.server.supportServices.prepare(request.authSession!.userId, request.body)
  void reply.code(r.created ? 201 : 200)
  return r.snapshot
}
export async function getSupportFeedback(
  request: ApiRequest<'getSupportFeedback'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'getSupportFeedback'>> {
  noStore(reply)
  return request.server.supportServices.get(
    request.authSession!.userId,
    request.params.submissionId,
  )
}
export async function lookupSupportFeedback(
  request: ApiRequest<'lookupSupportFeedback'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'lookupSupportFeedback'>> {
  noStore(reply)
  return request.server.supportServices.lookup(
    request.authSession!.userId,
    request.query.submissionKey,
  )
}
export async function uploadSupportFeedbackAttachment(
  request: ApiRequest<'uploadSupportFeedbackAttachment'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'uploadSupportFeedbackAttachment'>> {
  noStore(reply)
  return request.server.supportServices.upload(
    request.authSession!.userId,
    request.params.submissionId,
    request.params.attachmentId,
    getSupportUpload(request),
  )
}
export async function advanceSupportFeedback(
  request: ApiRequest<'advanceSupportFeedback'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'advanceSupportFeedback'>> {
  noStore(reply)
  const r = await request.server.supportServices.advance(
    request.authSession!.userId,
    request.params.submissionId,
    request.body,
  )
  void reply.code(r.statusCode)
  return r.snapshot
}
