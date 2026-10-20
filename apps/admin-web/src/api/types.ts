import type { components, paths } from './schema'

export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]
type Body<Operation> = Operation extends {
  requestBody?: { content: { 'application/json': infer Data } }
}
  ? Data
  : never
export type RequestBody<
  Path extends keyof paths,
  Method extends keyof paths[Path] = 'post' & keyof paths[Path],
> = Body<paths[Path][Method]>
type Success<Operation> = Operation extends {
  responses: { 200: { content: { 'application/json': infer Body } } }
}
  ? Body
  : never
export type Payload<
  Path extends keyof paths,
  Method extends keyof paths[Path] = 'get' & keyof paths[Path],
> = Success<paths[Path][Method]> extends { data: infer Data } ? Data : never
export interface ListPayload<Row> {
  list?: Row[]
  total?: number
}
