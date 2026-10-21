import { listOperations } from './read-contract.mjs'

function requiresSession(document, operation, location) {
  const security = Object.hasOwn(operation, 'security') ? operation.security : document.security
  if (security === undefined) return false
  if (!Array.isArray(security)) throw new Error(`Invalid security at ${location}`)
  const schemes = document.components.securitySchemes ?? {}
  if (!schemes || typeof schemes !== 'object' || Array.isArray(schemes))
    throw new Error('Invalid Contract securitySchemes')
  const alternatives = security.map((alternative) => {
    if (!alternative || typeof alternative !== 'object' || Array.isArray(alternative))
      throw new Error(`Invalid security alternative at ${location}`)
    const names = Object.keys(alternative)
    for (const name of names) {
      if (!Object.hasOwn(schemes, name))
        throw new Error(`Unknown security scheme ${name} at ${location}`)
      if (
        !Array.isArray(alternative[name]) ||
        alternative[name].some((scope) => typeof scope !== 'string')
      )
        throw new Error(`Invalid security scopes for ${name} at ${location}`)
      if (schemes[name].type === 'http' && alternative[name].length)
        throw new Error(`HTTP security scheme cannot have scopes at ${location}`)
    }
    return names.includes('sessionAuth')
  })
  return alternatives.length > 0 && alternatives.every(Boolean)
}

export function operationPolicy(document) {
  const policy = {}
  for (const { method, path, operation, location } of listOperations(document)) {
    policy[`${method.toUpperCase()} ${path}`] = {
      requiresSession: requiresSession(document, operation, location),
    }
  }
  return policy
}

export function renderOperationPolicy(document) {
  return `// Generated from apps/php-server/api/generated/openapi.internal.yaml. Do not edit.\nexport const operationPolicy = ${JSON.stringify(operationPolicy(document), null, 2)} as const\n`
}
