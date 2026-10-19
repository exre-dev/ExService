import Ajv, { type ValidateFunction } from 'ajv'
import { readContract } from '@server/src/contract/document'

export {
  API_PREFIX,
  OPENAPI_PATH,
  HTTP_METHODS,
  assertOperationCoverage,
  listOperations,
  readContract,
  resolveContractReference,
  resolvePathItem,
  validateContract,
} from '@server/src/contract/document'
export type {
  ContractDocument,
  ContractOperation,
  ContractObject,
} from '@server/src/contract/document'

export function toDraft07Definitions(schemas: Record<string, unknown>): Record<string, unknown> {
  const transform = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(transform)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === '$ref' && typeof child === 'string' && child.startsWith('#/components/schemas/')
          ? child.replace('#/components/schemas/', '#/definitions/')
          : transform(child),
      ]),
    )
  }
  return transform(schemas) as Record<string, unknown>
}

export function compileComponentSchema(name: string): ValidateFunction {
  const definitions = toDraft07Definitions(readContract().schemas)
  if (!Object.hasOwn(definitions, name))
    throw new Error(`Contract component schema is missing: ${name}`)
  // This helper checks schema structure; format semantics stay in their behavior tests.
  return new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile({
    $ref: `#/definitions/${name.replaceAll('~', '~0').replaceAll('/', '~1')}`,
    definitions,
  })
}
