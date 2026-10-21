export const OPENAPI_PATH: string
export const HTTP_METHODS: readonly string[]
export interface ContractDocument {
  openapi: string
  info: Record<string, unknown>
  paths: Record<string, Record<string, unknown>>
  components: { schemas: Record<string, unknown>; securitySchemes?: Record<string, unknown> }
  security?: unknown
}
export function readContract(path?: string): ContractDocument
export function validateContract(value: unknown): ContractDocument
export function resolveContractReference(document: ContractDocument, reference: string): unknown
export function resolvePathItem(
  document: ContractDocument,
  value: unknown,
  chain?: string[],
): Record<string, unknown>
export function listOperations(
  document: ContractDocument,
): Array<{
  operationId: string
  method: string
  path: string
  location: string
  operation: Record<string, unknown>
}>
export function assertOperationCoverage(
  document: ContractDocument,
  handlers: Record<string, unknown>,
): void
