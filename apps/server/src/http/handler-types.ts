import type { FastifyReply, FastifyRequest } from 'fastify'
import type { operations } from '@workspace/sdk/types'

export type OperationId = keyof operations
type Parameter<Id extends OperationId, Key extends 'query' | 'path'> = NonNullable<
  operations[Id]['parameters'][Key]
>
type JsonContent<Value> = Value extends { content: { 'application/json': infer Body } }
  ? Body
  : never
export type ApiBody<Id extends OperationId> = JsonContent<
  NonNullable<operations[Id]['requestBody']>
>
export type ApiRoute<Id extends OperationId> = {
  Body: ApiBody<Id>
  Querystring: Parameter<Id, 'query'>
  Params: Parameter<Id, 'path'>
}
export type ApiRequest<Id extends OperationId> = FastifyRequest<ApiRoute<Id>>
/** Parsed multipart marker bodies are distinct from both binary wire data and JSON requests. */
export type ApiTransportRequest<Id extends OperationId, Body> = FastifyRequest<
  Omit<ApiRoute<Id>, 'Body'> & { Body: Body }
>

type SuccessJson<Responses> = {
  [Status in keyof Responses]: Status extends string | number
    ? `${Status}` extends `2${string}`
      ? JsonContent<Responses[Status]>
      : never
    : never
}[keyof Responses]
export type ApiJsonResult<Id extends OperationId> = SuccessJson<operations[Id]['responses']>
export type TypedApiHandler<Id extends OperationId> = (
  request: ApiRequest<Id>,
  reply: FastifyReply,
) => Promise<ApiJsonResult<Id>>
