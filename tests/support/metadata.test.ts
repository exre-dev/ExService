import { describe, expect, it, vi } from 'vitest'
import { fakeClickUp, requestInput, typeOption } from '@tests/helpers/support-clickup'
import { createMetadata, frozenTaskInput, TARGET } from '@server/src/domains/support/metadata'
import {
  matchesFrozenTask,
  type FrozenTaskPayload,
} from '@server/src/domains/support/frozen-payload'
import { loadFieldDefinitions } from '@server/src/domains/support/field-config'
import { validateEvidence } from '@server/src/domains/support/maintenance'
const matchesTask = (
  task: Parameters<typeof matchesFrozenTask>[0],
  payload: FrozenTaskPayload,
  id: string,
) => matchesFrozenTask(task, { payload, formVersion: 2, userFieldIds: new Set() }, id)
describe('support read-only preflight and proof rules', () => {
  it('isolates a missing type definition and a failed tag lookup to dependent operations', async () => {
    const fake = fakeClickUp()
    vi.mocked(fake.service.getSpaceTags).mockRejectedValue(new Error('tags unavailable'))
    const definitions = loadFieldDefinitions().filter((field) => field.id !== TARGET.type)
    const metadata = createMetadata(fake.service, () => 1, definitions)
    const options = await metadata.options()
    expect(options.available).toBe(true)
    expect(options.kinds.find((kind) => kind.kind === 'bug')?.available).toBe(false)
    expect(options.kinds.find((kind) => kind.kind === 'content')?.available).toBe(true)
    expect(options.actions.find((action) => action.action === 'add')?.available).toBe(false)
    expect(options.actions.find((action) => action.action === 'other')?.available).toBe(true)
    await expect(
      metadata.preflight({
        kind: 'content',
        title: 'content',
        action: 'other',
        largeFileInfo: null,
        contentText: 'text',
      }),
    ).resolves.toBeUndefined()
  })
  it('keeps standard Task feature available when the custom TaskType lookup fails', async () => {
    const fake = fakeClickUp()
    vi.mocked(fake.service.getTaskTypes).mockRejectedValue(
      new Error('custom task types unavailable'),
    )
    const metadata = createMetadata(fake.service, () => 1)
    const options = await metadata.options()
    expect(options.available).toBe(true)
    expect(options.kinds.find((kind) => kind.kind === 'feature')?.available).toBe(true)
    expect(options.kinds.find((kind) => kind.kind === 'bug')?.available).toBe(false)
    await expect(
      metadata.preflight({
        kind: 'feature',
        title: 'feature',
        typeOptionId: null,
        departmentOptionId: null,
        largeFileInfo: null,
        contentText: 'body',
      }),
    ).resolves.toBeUndefined()
  })
  it('coalesces concurrent refresh, expires after 60s, and never serves stale available options on failure', async () => {
    const fake = fakeClickUp()
    let now = 1
    const metadata = createMetadata(fake.service, () => now)
    const options = await Promise.all([metadata.options(), metadata.options(), metadata.options()])
    expect(options.every((o) => o.available)).toBe(true)
    expect(fake.service.getFields).toHaveBeenCalledTimes(1)
    now += 60001
    vi.mocked(fake.service.getFields).mockRejectedValueOnce(new Error('SECRET upstream body'))
    expect(await metadata.options()).toMatchObject({
      available: false,
      reason: 'upstream_unavailable',
      fields: [],
    })
    expect((await metadata.options()).available).toBe(true)
    expect(fake.service.getFields).toHaveBeenCalledTimes(3)
  })
  it('rejects field type/application changes and unknown selected options', async () => {
    const fake = fakeClickUp(),
      metadata = createMetadata(fake.service, () => 1)
    await expect(
      metadata.preflight({
        ...requestInput().form,
        typeOptionId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toMatchObject({ code: 'FEEDBACK_INVALID_INPUT' })
    fake.fields.find((f) => f.id === TARGET.user)!.applied_objects = [
      { object_type: 19, object_id: 1005 },
    ]
    expect(
      (await createMetadata(fake.service, () => 1).options()).kinds.find(
        (kind) => kind.kind === 'bug',
      )?.available,
    ).toBe(false)
    delete fake.fields.find((f) => f.id === TARGET.user)!.applied_objects
    fake.fields.find((f) => f.id === TARGET.largeFile)!.type = 'url'
    expect(
      (await createMetadata(fake.service, () => 1).options()).kinds.find(
        (kind) => kind.kind === 'request',
      )?.available,
    ).toBe(false)
  })
  it('rejects duplicate orderindex and changed remote field types despite matching scalar values', async () => {
    const fake = fakeClickUp(),
      form = { ...requestInput().form, typeOptionId: typeOption },
      expected = frozenTaskInput(form, 'body', 'nickname', 'user')
    const { id } = await fake.service.createTask(TARGET.list, expected.task),
      task = await fake.service.getTask(id)
    expect(matchesTask(task, expected, id)).toBe(true)
    const field = task.custom_fields.find((f) => f.id === TARGET.type)!
    field.type = 'text'
    expect(matchesTask(task, expected, id)).toBe(false)
    field.type = 'drop_down'
    field.value = 0
    field.type_config.options!.push({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'duplicate',
      orderindex: 0,
    })
    expect(matchesTask(task, expected, id)).toBe(false)
  })
  it('matches a frozen operation tag even when its name differs from current tags and rejects conflicts', async () => {
    const fake = fakeClickUp()
    const form = {
      kind: 'asset' as const,
      title: 'asset',
      typeOptionId: null,
      action: 'add' as const,
      largeFileInfo: null,
      contentText: 'body',
    }
    const expected = frozenTaskInput(form, 'body', 'nickname', 'user')
    expected.task.tags = ['添加']
    const { id } = await fake.service.createTask(expected.listId, expected.task)
    const task = await fake.service.getTask(id)
    expect(matchesTask(task, expected, id)).toBe(true)
    task.tags = ['新增']
    expect(matchesTask(task, expected, id)).toBe(false)
    task.tags = ['添加', '新增']
    expect(matchesTask(task, expected, id)).toBe(false)
  })
  it('preserves a v2 frozen user field ID when the remote task has another user field', async () => {
    const fake = fakeClickUp(),
      frozen = frozenTaskInput(
        requestInput().form,
        'body',
        'name',
        '11111111-1111-4111-8111-111111111111',
      )
    const { id } = await fake.service.createTask(frozen.listId, frozen.task)
    const remote = await fake.service.getTask(id)
    const historicalId = '22222222-2222-4222-8222-222222222222'
    frozen.task.custom_fields[0]!.id = historicalId
    remote.custom_fields[0]!.id = historicalId
    remote.custom_fields.push({
      id: TARGET.user,
      name: 'Current user',
      type: 'short_text',
      type_config: {},
      value: 'additional value',
    })
    expect(matchesTask(remote, frozen, id)).toBe(true)
  })
  it('only accepts closed, bounded provider confirmation and rejects embedded secrets', () => {
    const proof = {
      evidenceKind: 'provider_confirmation',
      providerReference: 'ticket-42',
      observedAt: 42,
      confirmedNotExecuted: true,
    }
    expect(validateEvidence(proof)).toEqual(proof)
    for (const invalid of [
      { ...proof, rawLog: 'server log' },
      { ...proof, providerReference: 'x'.repeat(257) },
      { ...proof, confirmedNotExecuted: false },
      { ...proof, evidenceKind: 'not_found' },
    ])
      expect(() => validateEvidence(invalid)).toThrow()
    expect(() =>
      validateEvidence({ ...proof, providerReference: 'quoted"secret' }, ['quoted"secret']),
    ).toThrow()
    expect(() =>
      validateEvidence({ ...proof, providerReference: encodeURIComponent('percent%secret') }, [
        'percent%secret',
      ]),
    ).toThrow()
  })
})
