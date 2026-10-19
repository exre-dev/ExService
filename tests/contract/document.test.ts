import { describe, expect, it } from 'vitest'
import {
  API_PREFIX,
  OPENAPI_PATH,
  assertOperationCoverage,
  listOperations,
  readContract,
  resolveContractReference,
  validateContract,
} from '@server/src/contract/document'
import * as runtimeReader from '../../scripts/api/read-contract.mjs'

const operation = (operationId: string) => ({
  operationId,
  responses: { '200': { description: 'ok' } },
})
const document = (paths: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  openapi: '3.1.1',
  info: { title: 'fixture', version: '1' },
  paths,
  components: { schemas: {} },
  ...extra,
})

describe('unified Contract document', () => {
  it('reads the generated JSON independently of the working directory', () => {
    expect(API_PREFIX).toBe('/api')
    expect(OPENAPI_PATH.replaceAll('\\', '/')).toMatch(/\/api\/generated\/openapi.json$/)
    const contract = readContract()
    expect(contract.schemas).toBe(contract.components.schemas)
    expect(listOperations(contract).length).toBeGreaterThan(0)
  })

  it('resolves escaped JSON Pointer path items and includes every method', () => {
    const source = document(
      { '/fixture': { $ref: '#/components/pathItems/a~1b~0c' } },
      {
        components: {
          schemas: {},
          pathItems: {
            'a/b~c': { get: operation('readFixture'), patch: operation('patchFixture') },
          },
        },
      },
    )
    const contract = validateContract(source)
    expect(resolveContractReference(contract, '#/components/pathItems/a~1b~0c')).toEqual(
      source.components.pathItems['a/b~c'],
    )
    expect(
      listOperations(contract).map(({ operationId, location }) => [operationId, location]),
    ).toEqual([
      ['readFixture', 'GET /fixture'],
      ['patchFixture', 'PATCH /fixture'],
    ])
  })

  it.each([
    [{ '/fixture': { $ref: 'other.json#/paths/a' } }, {}, /internal/],
    [{ '/fixture': { $ref: '#/absent' } }, {}, /missing/i],
    [{ '/fixture': { $ref: '#/paths/~1fixture' } }, {}, /cycle/i],
    [
      { '/fixture': { $ref: '#/components/pathItems/item', get: operation('conflict') } },
      { components: { schemas: {}, pathItems: { item: { get: operation('read') } } } },
      /conflict/i,
    ],
    [{ '/fixture': { get: {} } }, {}, /operationId/],
    [{ '/a': { get: operation('same') }, '/b': { post: operation('same') } }, {}, /duplicate/i],
  ])('rejects invalid or ambiguous operation structure', (paths, extra, error) => {
    expect(() => validateContract(document(paths, extra))).toThrow(error)
  })

  it('allows recursive schemas while rejecting unresolved schema references', () => {
    expect(() =>
      validateContract(
        document(
          { '/a': { get: operation('read') } },
          {
            components: {
              schemas: {
                Node: {
                  type: 'object',
                  properties: { next: { $ref: '#/components/schemas/Node' } },
                },
              },
            },
          },
        ),
      ),
    ).not.toThrow()
    expect(() =>
      validateContract(
        document(
          {},
          { components: { schemas: { Bad: { $ref: '#/components/schemas/Missing' } } } },
        ),
      ),
    ).toThrow(/missing/i)
  })

  it('checks mapping in both directions and rejects unusable handlers', () => {
    const contract = validateContract(document({ '/a': { get: operation('read') } }))
    expect(() => assertOperationCoverage(contract, { read: () => undefined })).not.toThrow()
    expect(() => assertOperationCoverage(contract, {})).toThrow(/missing.*read/i)
    expect(() =>
      assertOperationCoverage(contract, { read: () => undefined, extra: () => undefined }),
    ).toThrow(/extra/i)
    expect(() => assertOperationCoverage(contract, { read: undefined })).toThrow(/function/i)
  })

  it('uses the same operation and reference semantics in the runtime script reader', () => {
    const source = document(
      { '/fixture': { $ref: '#/components/pathItems/a~1b~0c' } },
      {
        components: {
          schemas: { Node: { properties: { next: { $ref: '#/components/schemas/Node' } } } },
          pathItems: { 'a/b~c': { get: operation('readFixture') } },
        },
      },
    )
    expect(
      runtimeReader.listOperations(runtimeReader.validateContract(structuredClone(source))),
    ).toEqual(listOperations(validateContract(source)))
    for (const candidate of [
      document({ '/fixture': { $ref: '#/paths/~1fixture' } }),
      document({ '/a': { get: operation('same') }, '/b': { get: operation('same') } }),
      document({ '/fixture': { $ref: '#/missing' } }),
      document({ '/fixture': { $ref: 'other.json#/paths/a' } }),
    ]) {
      let expected: unknown
      try {
        validateContract(structuredClone(candidate))
      } catch (error) {
        expected = error
      }
      expect(() => runtimeReader.validateContract(candidate)).toThrow((expected as Error).message)
    }
    expect(runtimeReader.readContract().paths).toEqual(readContract().paths)
  })
})
