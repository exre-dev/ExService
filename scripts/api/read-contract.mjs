import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const API_PREFIX = '/api'
export const OPENAPI_PATH = fileURLToPath(
  new URL('../../api/generated/openapi.json', import.meta.url),
)
export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

function object(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Contract ${location} must be an object`)
  return value
}

export function resolveContractReference(document, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/'))
    throw new Error(`Contract reference must be internal: ${String(reference)}`)
  let target = document
  for (const encoded of reference.slice(2).split('/')) {
    if (/~(?:[^01]|$)/.test(encoded))
      throw new Error(`Contract reference has invalid JSON Pointer: ${reference}`)
    const key = encoded.replaceAll('~1', '/').replaceAll('~0', '~')
    if (!target || typeof target !== 'object' || !Object.hasOwn(target, key))
      throw new Error(`Contract reference target is missing: ${reference}`)
    target = target[key]
  }
  return target
}

export function resolvePathItem(document, value, chain = []) {
  const item = object(value, 'path item')
  if (!Object.hasOwn(item, '$ref')) return item
  const reference = item.$ref
  if (typeof reference !== 'string')
    throw new Error('Contract path item reference must be a string')
  if (chain.includes(reference))
    throw new Error(`Contract path item reference cycle: ${[...chain, reference].join(' -> ')}`)
  const target = resolvePathItem(document, resolveContractReference(document, reference), [
    ...chain,
    reference,
  ])
  const siblings = Object.fromEntries(Object.entries(item).filter(([key]) => key !== '$ref'))
  for (const key of Object.keys(siblings)) {
    if (Object.hasOwn(target, key))
      throw new Error(`Contract path item reference conflict for ${key}: ${reference}`)
  }
  return { ...target, ...siblings }
}

export function listOperations(document) {
  const result = []
  const declared = new Map()
  for (const [path, value] of Object.entries(document.paths)) {
    if (!path.startsWith('/')) throw new Error(`Contract path must start with /: ${path}`)
    const item = resolvePathItem(document, value)
    for (const method of HTTP_METHODS) {
      if (!Object.hasOwn(item, method)) continue
      const operation = object(item[method], `${method.toUpperCase()} ${path}`)
      const operationId = operation.operationId
      const location = `${method.toUpperCase()} ${path}`
      if (typeof operationId !== 'string' || !operationId.trim())
        throw new Error(`Contract ${location} is missing operationId`)
      if (declared.has(operationId))
        throw new Error(
          `Contract duplicate operationId ${operationId}: ${declared.get(operationId)} and ${location}`,
        )
      declared.set(operationId, location)
      result.push({ operationId, method, path, location, operation })
    }
  }
  return result
}

// Kept equivalent to the neutral Server reader; shared fixtures check both adapters.
export function validateContract(value) {
  const document = object(value, 'document')
  if (typeof document.openapi !== 'string' || !document.openapi.startsWith('3.1.'))
    throw new Error('Contract openapi must use version 3.1')
  object(document.info, 'info')
  object(document.paths, 'paths')
  const components = object(document.components, 'components')
  const schemas = object(components.schemas, 'components.schemas')
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (Object.hasOwn(node, '$ref')) resolveContractReference(document, node.$ref)
    for (const child of Object.values(node)) visit(child)
  }
  visit(document)
  Object.defineProperty(document, 'schemas', {
    value: schemas,
    enumerable: false,
    configurable: true,
  })
  listOperations(document)
  return document
}

export function readContract(path = OPENAPI_PATH) {
  return validateContract(JSON.parse(readFileSync(path, 'utf8')))
}

export function assertOperationCoverage(document, handlers) {
  const operations = listOperations(document)
  const declared = new Set(operations.map(({ operationId }) => operationId))
  const missing = operations
    .filter(({ operationId }) => !Object.hasOwn(handlers, operationId))
    .map(({ operationId, location }) => `${operationId} (${location})`)
  const extra = Object.keys(handlers).filter((key) => !declared.has(key))
  if (missing.length || extra.length)
    throw new Error(
      `Contract operation coverage mismatch; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`,
    )
  for (const { operationId } of operations) {
    if (typeof handlers[operationId] !== 'function')
      throw new Error(`Contract handler ${operationId} must be a function`)
  }
}
