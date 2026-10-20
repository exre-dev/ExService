import { describe, expect, it } from 'vitest'
import { readContract } from '../../scripts/api/read-contract.mjs'

describe('typed API transport', () => {
  it('supports every declared path and query serialization style in the contract', () => {
    const contract = readContract() as {
      paths: Record<
        string,
        Record<
          string,
          {
            parameters?: Array<{
              name: string
              in: string
              style?: string
              explode?: boolean
              schema?: { type?: string }
            }>
          }
        >
      >
    }
    for (const [path, item] of Object.entries(contract.paths))
      for (const [method, operation] of Object.entries(item)) {
        if (!operation || !Array.isArray(operation.parameters)) continue
        for (const parameter of operation.parameters) {
          if (parameter.in === 'path') {
            expect(parameter.style ?? 'simple', `${method} ${path} ${parameter.name}`).toBe(
              'simple',
            )
            expect(parameter.explode ?? false).toBe(false)
          } else if (parameter.in === 'query') {
            expect(parameter.style ?? 'form', `${method} ${path} ${parameter.name}`).toBe('form')
            expect(parameter.explode ?? true).toBe(true)
          } else if (parameter.in === 'header') {
            expect(parameter.style ?? 'simple', `${method} ${path} ${parameter.name}`).toBe(
              'simple',
            )
            expect(parameter.explode ?? false).toBe(false)
          } else
            throw new Error(`Unsupported parameter location: ${method} ${path} ${parameter.name}`)
          expect(parameter.schema?.type ?? 'string').not.toBe('object')
        }
      }
  })
})
