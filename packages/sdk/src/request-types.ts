import type { paths } from './generated/schema.js'
import type { ExAxiosError } from './http/errors.js'

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'
export interface SessionExpiredContext {
  error: ExAxiosError
  loginUrl: string
}
/** Return false when persistent session cleanup cannot be confirmed; void remains accepted. */
export type SessionExpiredHandler = (
  context: SessionExpiredContext,
) => void | boolean | Promise<void | boolean>
export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
  alert?: boolean
}
type Parameter<O, K extends 'path' | 'query'> = O extends { parameters: infer P }
  ? K extends keyof P
    ? Exclude<P[K], undefined>
    : never
  : never
type Field<O, K extends 'path' | 'query', Name extends string> = [Parameter<O, K>] extends [never]
  ? { [N in Name]?: never }
  : O extends { parameters: infer P }
    ? K extends keyof P
      ? {} extends Pick<P, K>
        ? { [N in Name]?: Parameter<O, K> }
        : { [N in Name]: Parameter<O, K> }
      : never
    : never
type RequestBody<O> = O extends { requestBody?: infer B } ? Exclude<B, undefined> : never
type MediaBody<B> = B extends { content: infer C }
  ? C extends { 'multipart/form-data': unknown }
    ? FormData
    : C extends { 'application/json': infer J }
      ? J
      : never
  : never
type DataField<O> = [RequestBody<O>] extends [never]
  ? { data?: never }
  : O extends { requestBody: unknown }
    ? { data: MediaBody<RequestBody<O>> }
    : { data?: MediaBody<RequestBody<O>> }
type OperationConfig<P extends string, M extends Method, O> = RequestOptions & {
  url: P
} & (M extends 'get' ? { method?: M | Uppercase<M> } : { method: M | Uppercase<M> }) &
  Field<O, 'path', 'pathParams'> &
  Field<O, 'query', 'params'> &
  DataField<O>
export type RequestConfig = {
  [P in keyof paths]: {
    [M in Method]: M extends keyof paths[P]
      ? Exclude<paths[P][M], undefined> extends infer O
        ? [O] extends [never]
          ? never
          : O extends { responses: object }
            ? OperationConfig<P & string, M, O>
            : never
        : never
      : never
  }[Method]
}[keyof paths]

// Preserve literal excess-property checking through the const generic, including
// discriminated JSON unions; string index signatures continue to allow extra keys.
type Exact<A, E> = E extends unknown
  ? A extends E
    ? A extends FormData | Blob | Date
      ? A
      : A extends readonly unknown[]
        ? E extends readonly unknown[]
          ? {
              [K in keyof A]: K extends number
                ? Exact<A[K], E[K]>
                : K extends `${infer I extends number}`
                  ? Exact<A[K], E[I]>
                  : A[K]
            }
          : never
        : A extends object
          ? E extends object
            ? Exclude<keyof A, keyof E> extends never
              ? { [K in keyof A]: K extends keyof E ? Exact<A[K], E[K]> : never }
              : never
            : A
          : A
    : never
  : never
type CheckAgainst<C, R> = R extends unknown
  ? C extends R
    ? Exclude<keyof C, keyof R> extends never
      ? {
          [K in keyof C]: K extends 'pathParams' | 'params' | 'data'
            ? K extends keyof R
              ? Exact<C[K], R[K]>
              : never
            : C[K]
        }
      : never
    : never
  : never
export type CheckedConfig<C> = CheckAgainst<C, RequestConfig>
type MethodFor<C> = C extends { method: infer M extends string } ? Lowercase<M> : 'get'
type OperationFor<C> = C extends { url: infer P extends keyof paths }
  ? MethodFor<C> extends keyof paths[P]
    ? Exclude<paths[P][MethodFor<C>], undefined>
    : never
  : never
type SuccessKey<R> = {
  [K in keyof R]: `${K & (number | string)}` extends `2${string}` ? K : never
}[keyof R]
type ResponseBody<R> = R extends { content: infer C }
  ? C extends { 'application/json': infer J }
    ? J
    : C[keyof C]
  : void
type JsonResponse<O> = O extends { responses: infer R } ? ResponseBody<R[SuccessKey<R>]> : never
type ResponseMode<C> = C extends { responseType?: infer T } ? T : 'json'
type ByMode<C, T> = T extends 'text'
  ? string
  : T extends 'blob'
    ? Blob
    : T extends 'arraybuffer'
      ? ArrayBuffer
      : JsonResponse<OperationFor<C>>
export type ResponseFor<C> = C extends unknown ? ByMode<C, ResponseMode<C>> : never
export interface SdkInstance {
  <const C extends RequestConfig>(config: C & CheckedConfig<C>): Promise<ResponseFor<C>>
}

/** Internal transport shape; deliberately absent from the package exports. */
export interface HttpRequest extends RequestOptions {
  url: string
  method?: string
  pathParams?: Record<string, unknown>
  params?: Record<string, unknown>
  data?: unknown
}
