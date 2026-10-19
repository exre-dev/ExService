import type { ApiRequest, ApiJsonResult } from '@server/src/http/handler-types.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
const noStore = (reply: FastifyReply) => {
  void reply.header('Cache-Control', 'no-store')
}
const applicant = (request: FastifyRequest, reply: FastifyReply) => {
  noStore(reply)
  request.server.invitationServices.limit(request.ip)
}
export async function checkInvitationEligibility(
  request: ApiRequest<'checkInvitationEligibility'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'checkInvitationEligibility'>> {
  applicant(request, reply)
  return request.server.invitationServices.checkEligibility(request.body.email)
}
export async function requestInvitationCode(
  request: ApiRequest<'requestInvitationCode'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'requestInvitationCode'>> {
  applicant(request, reply)
  void reply.code(202)
  return request.server.invitationServices.requestCode(request.body.email)
}
export async function verifyInvitationCode(
  request: ApiRequest<'verifyInvitationCode'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'verifyInvitationCode'>> {
  applicant(request, reply)
  const { email, code } = request.body
  return request.server.invitationServices.verifyCode(email, code)
}
export async function completeInvitationRegistration(
  request: ApiRequest<'completeInvitationRegistration'>,
  reply: FastifyReply,
): Promise<ApiJsonResult<'completeInvitationRegistration'>> {
  applicant(request, reply)
  return request.server.invitationServices.complete(request.body)
}
