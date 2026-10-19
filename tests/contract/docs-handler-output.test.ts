import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyReply } from 'fastify'
import { serviceHandlers } from '@workspace/server'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { compileComponentSchema, listOperations, readContract } from '@tests/helpers/contract'

const CORE = [
  'listDocsSpaces',
  'createDocsSpace',
  'getDocsSpace',
  'updateDocsSpace',
  'deleteDocsSpace',
  'getDocsTree',
  'createDocsDocument',
  'getDocsDocument',
  'updateDocsDocument',
  'moveDocsDocument',
  'trashDocsDocument',
  'listDocsTrash',
  'getDocsTrashedDocument',
  'restoreDocsDocument',
] as const

type CoreOperation = (typeof CORE)[number]
const contract = readContract()
const coreOperations = listOperations(contract).filter(
  ({ operationId, operation }) =>
    operationId.includes('Docs') &&
    !Object.hasOwn(operation.responses as Record<string, unknown>, '501'),
)

function successSchema(operationId: CoreOperation) {
  const operation = coreOperations.find((entry) => entry.operationId === operationId)
  if (!operation) throw new Error(`No core Docs operation: ${operationId}`)
  const success = Object.entries(
    operation.operation.responses as Record<string, Record<string, unknown>>,
  ).find(([status]) => /^2\d\d$/.test(status))
  if (!success) throw new Error(`No successful response for ${operationId}`)
  const [status, response] = success
  const schema = (response.content as Record<string, { schema?: { $ref?: string } }> | undefined)?.[
    'application/json'
  ]?.schema
  if (status === '204') return { status: 204, validate: undefined }
  const name = schema?.$ref?.replace('#/components/schemas/', '')
  if (!name || name === schema?.$ref) throw new Error(`No response schema for ${operationId}`)
  return { status: Number(status), validate: compileComponentSchema(name) }
}

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()))
})

const CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Docs raw output' }] }],
}

describe('Docs registered core handlers return unsanitized Contract output', () => {
  it('covers every implemented Docs operation and rejects raw shape regressions', async () => {
    expect(coreOperations.map(({ operationId }) => operationId).sort()).toEqual([...CORE].sort())
    const fixture = await createTestAuth()
    fixtures.push(fixture)
    const userId = await fixture.seedUser({
      email: 'docs-raw@example.com',
      nickname: 'Raw Docs',
      password: 'valid password',
    })
    const seen = new Set<CoreOperation>()

    async function invoke<T = unknown>(
      operationId: CoreOperation,
      input: {
        params?: Record<string, string>
        query?: Record<string, unknown>
        body?: unknown
      } = {},
    ): Promise<T> {
      const response = successSchema(operationId)
      let status = 200
      const headers: Record<string, string> = {}
      const reply = {
        header(name: string, value: string) {
          headers[name.toLowerCase()] = value
          return this
        },
        code(value: number) {
          status = value
          return this
        },
      } as unknown as FastifyReply
      const handler = serviceHandlers[operationId] as (
        request: unknown,
        reply: FastifyReply,
      ) => Promise<unknown>
      const value = await handler(
        {
          server: fixture,
          params: input.params ?? {},
          query: input.query ?? {},
          body: input.body,
          authSession: { userId },
        },
        reply,
      )
      expect(status, operationId).toBe(response.status)
      expect(headers['cache-control'], operationId).toBe('no-store')
      if (response.validate) {
        expect(
          response.validate(value),
          `${operationId}: ${JSON.stringify(response.validate.errors)}`,
        ).toBe(true)
      } else {
        expect(value, operationId).toBeUndefined()
      }
      seen.add(operationId)
      return value as T
    }

    type Space = { id: string; version: number; treeVersion: number }
    type Document = { id: string; version: number; spaceId: string }
    type DocumentResult = { document: Document; treeVersion: number }
    const first = await invoke<Space>('createDocsSpace', {
      body: { name: 'First', description: '' },
    })
    const second = await invoke<Space>('createDocsSpace', {
      body: { name: 'Second', description: '' },
    })
    await invoke('listDocsSpaces')
    await invoke('getDocsSpace', { params: { spaceId: first.id } })
    const renamed = await invoke<Space>('updateDocsSpace', {
      params: { spaceId: first.id },
      body: { expectedVersion: first.version, name: 'Renamed', description: 'Current' },
    })
    await invoke('getDocsTree', { params: { spaceId: first.id } })
    const created = await invoke<DocumentResult>('createDocsDocument', {
      params: { spaceId: first.id },
      body: {
        expectedTreeVersion: first.treeVersion,
        parentId: null,
        beforeDocumentId: null,
        title: 'First document',
        contentSchemaVersion: 1,
        content: CONTENT,
      },
    })
    await invoke('getDocsTree', { params: { spaceId: first.id } })
    await invoke('getDocsDocument', { params: { documentId: created.document.id } })
    const saved = await invoke<DocumentResult>('updateDocsDocument', {
      params: { documentId: created.document.id },
      body: {
        expectedSpaceId: first.id,
        expectedVersion: created.document.version,
        title: 'Saved document',
        contentSchemaVersion: 1,
        content: CONTENT,
      },
    })
    const moved = await invoke<{
      source: { treeVersion: number }
      target: { treeVersion: number }
    }>('moveDocsDocument', {
      params: { documentId: created.document.id },
      body: {
        sourceSpaceId: first.id,
        targetSpaceId: second.id,
        expectedVersion: saved.document.version,
        expectedSourceTreeVersion: saved.treeVersion,
        expectedTargetTreeVersion: second.treeVersion,
        parentId: null,
        beforeDocumentId: null,
      },
    })
    await invoke('deleteDocsSpace', {
      params: { spaceId: first.id },
      body: { expectedVersion: renamed.version, expectedTreeVersion: moved.source.treeVersion },
    })
    const current = await fixture.docsServices.getDocument(created.document.id)
    const trashed = await invoke<{
      version: number
      treeVersion: number
      deletionBatchId: string
    }>('trashDocsDocument', {
      params: { documentId: created.document.id },
      body: {
        expectedSpaceId: second.id,
        expectedVersion: current.document.version,
        expectedTreeVersion: moved.target.treeVersion,
      },
    })
    await invoke('listDocsTrash', { params: { spaceId: second.id } })
    const trashDetail = await invoke<{ document: Document }>('getDocsTrashedDocument', {
      params: { documentId: created.document.id },
    })
    await invoke('restoreDocsDocument', {
      params: { documentId: created.document.id },
      body: {
        expectedSpaceId: second.id,
        expectedVersion: trashDetail.document.version,
        expectedTreeVersion: trashed.treeVersion,
        deletionBatchId: trashed.deletionBatchId,
      },
    })

    expect([...seen].sort()).toEqual([...CORE].sort())

    const createdSchema = successSchema('createDocsDocument').validate!
    expect(createdSchema({ ...created, unexpected: true })).toBe(false)
    expect(createdSchema({ ...created, document: { ...created.document, id: undefined } })).toBe(
      false,
    )
    expect(
      createdSchema({
        ...created,
        document: { ...created.document, contentSchemaVersion: 2 },
      }),
    ).toBe(false)
  })
})
