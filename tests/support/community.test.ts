import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { fakeClickUp, requestInput } from '@tests/helpers/support-clickup'
import { createSupportServices } from '@server/src/domains/support/service'
import { createSupportMaintenance } from '@server/src/domains/support/maintenance'
import {
  createMetadata,
  frozenTaskInput,
  TARGET,
  COMMUNITY_TARGET,
} from '@server/src/domains/support/metadata'
import {
  matchesFrozenTask,
  validateStoredTask,
  type FrozenTaskPayload,
  type FrozenTaskColumns,
  type CommunityProfile,
} from '@server/src/domains/support/frozen-payload'
import { normalizePrepare, sha256 } from '@server/src/domains/support/validation'
import { createEnabledClickUpServices, type ClickUpTask } from '@server/src/modules/clickup/service'
import { ClickUpError } from '@server/src/modules/clickup/errors'
import { loadFieldDefinitions } from '@server/src/domains/support/field-config'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})
const suggestion = () => ({
  kind: 'suggestion' as const,
  title: '社区建议',
  contentText: '请改进服务',
  largeFileInfo: null,
})
const complaint = (anonymous: boolean) => ({
  kind: 'complaint' as const,
  title: '社区投诉',
  contentText: '这里是投诉内容',
  largeFileInfo: null,
  anonymous,
})
const matchesTask = (
  task: ClickUpTask,
  payload: FrozenTaskPayload,
  id: string,
  formVersion: 2 | 3 = 2,
) => matchesFrozenTask(task, { payload, formVersion, userFieldIds: new Set([TARGET.user]) }, id)
async function setup() {
  const f = await createTestAuth()
  fixtures.push(f)
  const userId = await f.seedUser({
    email: 'community@example.com',
    nickname: '实名用户',
    password: 'valid password',
  })
  const fake = fakeClickUp()
  const support = createSupportServices({
    db: f.db,
    clickup: fake.service,
    profile: f.profileServices,
    now: f.now,
  })
  return { f, userId, fake, support }
}
describe('community support feedback', () => {
  it('accepts closed v3 forms and rejects missing, nonboolean or cross-kind anonymous', () => {
    for (const form of [suggestion(), complaint(false), complaint(true)])
      expect(normalizePrepare({ submissionKey: randomUUID(), form, attachments: [] }).form).toEqual(
        form,
      )
    for (const form of [
      { ...complaint(true), anonymous: 'true' },
      { kind: 'complaint', title: 'x', contentText: 'x', largeFileInfo: null },
      { ...suggestion(), anonymous: true },
      { ...requestInput().form, anonymous: false },
    ]) {
      expect(() =>
        normalizePrepare({ submissionKey: randomUUID(), form, attachments: [] }),
      ).toThrow()
    }
  })
  it('isolates area metadata and disables only the kind with a missing tag', async () => {
    const fake = fakeClickUp(),
      metadata = createMetadata(fake.service, () => 1)
    expect((await metadata.options()).kinds).toHaveLength(6)
    const community = await metadata.options('community')
    expect(community.fields.map((f) => f.id)).toEqual([TARGET.largeFile])
    expect(community.actions).toEqual([])
    expect(community.kinds.map((k) => k.kind)).toEqual(['suggestion', 'complaint'])
    vi.mocked(fake.service.getSpaceTags).mockImplementation(async (space) =>
      space === COMMUNITY_TARGET.space ? ['反馈'] : ['新增', '修改', '删除'],
    )
    const missing = await createMetadata(fake.service, () => 1).options('community')
    expect(missing.kinds).toMatchObject([{ available: true }, { available: false }])
    vi.mocked(fake.service.getList).mockImplementation(async (list) => {
      if (list === COMMUNITY_TARGET.list) throw new Error('community outage')
      return {
        id: TARGET.list,
        name: 'development',
        space: { id: TARGET.space },
        statuses: [{ status: TARGET.status }],
      }
    })
    const isolated = createMetadata(fake.service, () => 1)
    expect((await isolated.options('community')).available).toBe(false)
    expect((await isolated.options()).available).toBe(true)
  })
  it('freezes anonymous and named payloads, advances with attachments, and rejects identity tampering', async () => {
    const { f, userId, fake, support } = await setup()
    const bytes = Buffer.from('complaint attachment')
    const attachment = {
      id: randomUUID(),
      originalName: 'proof.txt',
      contentType: 'text/plain',
      byteLength: bytes.length,
      sha256: sha256(bytes),
    }
    const key = randomUUID(),
      input = { submissionKey: key, form: complaint(true), attachments: [attachment] }
    const prepared = await support.prepare(userId, input)
    expect(prepared.snapshot.form).toEqual(input.form)
    const otherId = await f.seedUser({
      email: 'other-community@example.com',
      nickname: '另一位用户',
      password: 'valid password',
    })
    await expect(support.get(otherId, prepared.snapshot.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(support.lookup(otherId, key)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const row = (
      await f.db.query<{
        nickname_snapshot: string
        form_version: number
        target_list_id: string
        task_payload_json: string
      }>(
        'SELECT nickname_snapshot,form_version,target_list_id,task_payload_json FROM support_feedback_submissions WHERE id=$1',
        [prepared.snapshot.id],
      )
    ).rows[0]!
    expect(row).toMatchObject({
      nickname_snapshot: '',
      form_version: 3,
      target_list_id: COMMUNITY_TARGET.list,
    })
    expect(JSON.parse(row.task_payload_json).task.custom_fields).toEqual([])
    await expect(
      support.prepare(userId, { ...input, form: complaint(false) }),
    ).rejects.toMatchObject({ code: 'FEEDBACK_PAYLOAD_CONFLICT' })
    const uploaded = await support.upload(userId, prepared.snapshot.id, attachment.id, {
      bytes,
      filename: attachment.originalName,
      contentType: attachment.contentType,
    })
    const created = await support.advance(userId, prepared.snapshot.id, {
      expectedRevision: uploaded.revision,
      intent: 'continue',
    })
    expect(created.snapshot.status).toBe('uploading')
    expect(fake.createTask).toHaveBeenCalledWith(
      COMMUNITY_TARGET.list,
      expect.objectContaining({
        custom_item_id: 1003,
        status: '待处理',
        tags: ['投诉'],
        custom_fields: [],
      }),
    )
    const completed = await support.advance(userId, prepared.snapshot.id, {
      expectedRevision: created.snapshot.revision,
      intent: 'continue',
    })
    expect(completed.snapshot.status).toBe('completed')
    expect(fake.service.uploadAttachment).toHaveBeenCalledTimes(1)
    const task = fake.tasks.get(completed.snapshot.taskId!)!
    task.custom_fields.push({
      id: TARGET.user,
      name: '用户',
      type: 'short_text',
      type_config: {},
      value: 'injected user',
    })
    expect(matchesTask(task, JSON.parse(row.task_payload_json), task.id, 3)).toBe(false)
    const named = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form: complaint(false),
      attachments: [],
    })
    expect(
      JSON.parse(
        (
          await f.db.query<{ task_payload_json: string }>(
            'SELECT task_payload_json FROM support_feedback_submissions WHERE id=$1',
            [named.snapshot.id],
          )
        ).rows[0]!.task_payload_json,
      ).task.custom_fields[0].value,
    ).toContain(userId)
    const suggested = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form: suggestion(),
      attachments: [],
    })
    expect(
      (
        await support.advance(userId, suggested.snapshot.id, {
          expectedRevision: suggested.snapshot.revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('completed')
    expect(fake.createTask).toHaveBeenLastCalledWith(
      COMMUNITY_TARGET.list,
      expect.objectContaining({ tags: ['反馈'] }),
    )
  })
  it('rejects recomputed anonymous identity corruption while preserving old v2 tag scope', async () => {
    const { f, userId, support, fake } = await setup()
    const prepared = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form: complaint(true),
      attachments: [],
    })
    const row = (
      await f.db.query<{ task_payload_json: string }>(
        'SELECT task_payload_json FROM support_feedback_submissions WHERE id=$1',
        [prepared.snapshot.id],
      )
    ).rows[0]!
    const frozen = JSON.parse(row.task_payload_json)
    frozen.task.custom_fields = [{ id: TARGET.user, value: `Forged (${userId})` }]
    frozen.fieldTypes = ['short_text']
    const json = JSON.stringify(frozen)
    await f.db.query(
      'UPDATE support_feedback_submissions SET task_payload_json=$2,task_payload_sha256=$3 WHERE id=$1',
      [prepared.snapshot.id, json, sha256(json)],
    )
    await expect(support.get(userId, prepared.snapshot.id)).rejects.toThrow(
      'Support record invariant failed',
    )
    const v2 = frozenTaskInput(requestInput().form, 'body', 'name', userId)
    const taskId = (await fake.service.createTask(v2.listId, v2.task)).id
    const oldTask = await fake.service.getTask(taskId)
    oldTask.tags.push('投诉')
    expect(matchesTask(oldTask, v2, taskId)).toBe(true)
  })
  it('rejects a recomputed anonymous payload moved to an unregistered community target', async () => {
    const { f, userId, support } = await setup()
    const prepared = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form: complaint(true),
      attachments: [],
    })
    const frozen = JSON.parse(
      (
        await f.db.query<{ task_payload_json: string }>(
          'SELECT task_payload_json FROM support_feedback_submissions WHERE id=$1',
          [prepared.snapshot.id],
        )
      ).rows[0]!.task_payload_json,
    )
    frozen.listId = '1100500000009999'
    const json = JSON.stringify(frozen)
    await f.db.query(
      'UPDATE support_feedback_submissions SET target_list_id=$2,task_payload_json=$3,task_payload_sha256=$4 WHERE id=$1',
      [prepared.snapshot.id, frozen.listId, json, sha256(json)],
    )
    await expect(support.get(userId, prepared.snapshot.id)).rejects.toThrow(
      'Support record invariant failed',
    )
  })
  it('keeps an old anonymous target readable after the active target changes and rejects identity in either generation', async () => {
    const { f, userId, fake, support } = await setup()
    const prepared = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form: complaint(true),
      attachments: [],
    })
    const row = (
      await f.db.query<FrozenTaskColumns>(
        'SELECT * FROM support_feedback_submissions WHERE id=$1',
        [prepared.snapshot.id],
      )
    ).rows[0]!
    const next: CommunityProfile = {
      listId: '1100500000009999',
      taskType: 1004,
      status: '待核对',
      userFieldId: randomUUID(),
      largeFileFieldId: randomUUID(),
    }
    const validated = validateStoredTask(row, prepared.snapshot.form, next)
    expect(validated.payload.listId).toBe(COMMUNITY_TARGET.list)
    expect((await support.get(userId, prepared.snapshot.id)).form.kind).toBe('complaint')
    const taskId = (await fake.service.createTask(validated.payload.listId, validated.payload.task))
      .id
    const remote = await fake.service.getTask(taskId)
    remote.custom_fields.push({
      id: next.userFieldId,
      name: 'new identity',
      type: 'short_text',
      type_config: {},
      value: null,
      hasUnsupportedValue: true,
    })
    expect(matchesFrozenTask(remote, validated, taskId)).toBe(false)
    remote.custom_fields[0]!.id = TARGET.user
    expect(matchesFrozenTask(remote, validated, taskId)).toBe(false)
    const newPayload = structuredClone(validated.payload)
    newPayload.listId = next.listId
    newPayload.task.custom_item_id = next.taskType
    newPayload.task.status = next.status
    const task_payload_json = JSON.stringify(newPayload)
    const nextFrozen = validateStoredTask(
      {
        ...row,
        target_list_id: next.listId,
        task_payload_json,
        task_payload_sha256: sha256(task_payload_json),
      },
      prepared.snapshot.form,
      next,
    )
    const newTaskId = (
      await fake.service.createTask(nextFrozen.payload.listId, nextFrozen.payload.task)
    ).id
    expect(matchesFrozenTask(await fake.service.getTask(newTaskId), nextFrozen, newTaskId)).toBe(
      true,
    )
  })
  it('requires named identity and large-file fields to belong to one registered v3 profile', async () => {
    const { f, userId, support } = await setup()
    const form = { ...complaint(false), largeFileInfo: 'https://example.invalid/proof' }
    const prepared = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form,
      attachments: [],
    })
    const row = (
      await f.db.query<FrozenTaskColumns>(
        'SELECT * FROM support_feedback_submissions WHERE id=$1',
        [prepared.snapshot.id],
      )
    ).rows[0]!
    const next: CommunityProfile = {
      listId: COMMUNITY_TARGET.list,
      taskType: COMMUNITY_TARGET.taskType,
      status: COMMUNITY_TARGET.status,
      userFieldId: randomUUID(),
      largeFileFieldId: randomUUID(),
    }
    const frozen = JSON.parse(row.task_payload_json)
    frozen.task.custom_fields.at(-1).id = next.largeFileFieldId
    const task_payload_json = JSON.stringify(frozen)
    expect(() =>
      validateStoredTask(
        { ...row, task_payload_json, task_payload_sha256: sha256(task_payload_json) },
        form,
        next,
      ),
    ).toThrow('Support record invariant failed')
  })
  it('reads and advances old and new frozen targets after active configuration changes, then reconciles an old attempt', async () => {
    const { f, userId, fake, support } = await setup()
    const old = (
      await support.prepare(userId, {
        submissionKey: randomUUID(),
        form: complaint(true),
        attachments: [],
      })
    ).snapshot
    const next = {
      workspace: TARGET.workspace,
      list: '1100500000009999',
      space: '90186006984',
      taskType: 1004,
      status: '待核对',
      user: randomUUID(),
      largeFile: randomUUID(),
    }
    const originalGetList = vi.mocked(fake.service.getList).getMockImplementation()!,
      originalGetTypes = vi.mocked(fake.service.getTaskTypes).getMockImplementation()!,
      originalTags = vi.mocked(fake.service.getSpaceTags).getMockImplementation()!
    vi.mocked(fake.service.getList).mockImplementation(async (list) =>
      list === next.list
        ? {
            id: next.list,
            name: 'next community',
            space: { id: next.space },
            statuses: [{ status: next.status }],
          }
        : originalGetList(list),
    )
    vi.mocked(fake.service.getTaskTypes).mockImplementation(async (workspace) => [
      ...(await originalGetTypes(workspace)),
      { id: next.taskType, name: 'Next Feedback' },
    ])
    vi.mocked(fake.service.getSpaceTags).mockImplementation(async (space) =>
      space === next.space ? ['反馈', '投诉'] : originalTags(space),
    )
    fake.fields.push({ ...fake.fields.find((field) => field.id === TARGET.user)!, id: next.user })
    fake.fields.push({
      ...fake.fields.find((field) => field.id === TARGET.largeFile)!,
      id: next.largeFile,
    })
    const definitions = [
      ...loadFieldDefinitions(),
      {
        ...loadFieldDefinitions().find((field) => field.id === TARGET.largeFile)!,
        id: next.largeFile,
      },
    ]
    const switched = createSupportServices({
      db: f.db,
      clickup: fake.service,
      profile: f.profileServices,
      now: f.now,
      communityTarget: next,
      fieldDefinitions: definitions,
    })
    const newer = (
      await switched.prepare(userId, {
        submissionKey: randomUUID(),
        form: complaint(true),
        attachments: [],
      })
    ).snapshot
    expect((await switched.get(userId, old.id)).form.kind).toBe('complaint')
    expect((await switched.get(userId, newer.id)).form.kind).toBe('complaint')
    expect(
      (
        await switched.advance(userId, old.id, {
          expectedRevision: old.revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('completed')
    expect(
      (
        await switched.advance(userId, newer.id, {
          expectedRevision: newer.revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('completed')
    const named = (
      await switched.prepare(userId, {
        submissionKey: randomUUID(),
        form: { ...complaint(false), largeFileInfo: 'https://example.invalid/proof' },
        attachments: [],
      })
    ).snapshot
    const namedPayload = JSON.parse(
      (
        await f.db.query<FrozenTaskColumns>(
          'SELECT * FROM support_feedback_submissions WHERE id=$1',
          [named.id],
        )
      ).rows[0]!.task_payload_json,
    )
    expect(namedPayload.task.custom_fields.map((field: { id: string }) => field.id)).toEqual([
      next.user,
      next.largeFile,
    ])
    expect(
      (
        await switched.advance(userId, named.id, {
          expectedRevision: named.revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('completed')
    expect(fake.createTask.mock.calls.map((call) => call[0])).toEqual([
      COMMUNITY_TARGET.list,
      next.list,
      next.list,
    ])
    const pending = (
      await support.prepare(userId, {
        submissionKey: randomUUID(),
        form: complaint(true),
        attachments: [],
      })
    ).snapshot
    fake.createTask.mockRejectedValueOnce(new ClickUpError('unknown', 'UPSTREAM_UNKNOWN'))
    expect(
      (
        await switched.advance(userId, pending.id, {
          expectedRevision: pending.revision,
          intent: 'continue',
        })
      ).snapshot.status,
    ).toBe('verification_required')
    const frozen = JSON.parse(
      (
        await f.db.query<FrozenTaskColumns>(
          'SELECT * FROM support_feedback_submissions WHERE id=$1',
          [pending.id],
        )
      ).rows[0]!.task_payload_json,
    )
    const remote = (await fake.service.createTask(frozen.listId, frozen.task)).id
    const maintenance = createSupportMaintenance({
      db: f.db,
      clickup: fake.service,
      now: f.now,
      communityTarget: next,
    })
    const attempt = (await maintenance.inspect(pending.id)).attempt!.id
    await maintenance.resolveTask(pending.id, attempt, remote, true)
    expect((await switched.get(userId, pending.id)).status).toBe('completed')
  })
  it('does not read a profile and treats parsed complex remote identity as verification required', async () => {
    const { f, userId, fake } = await setup()
    const profile = {
      snapshot: vi.fn(async () => {
        throw new Error('profile should not be read')
      }),
    }
    const support = createSupportServices({ db: f.db, clickup: fake.service, profile, now: f.now })
    const prepared = await support.prepare(userId, {
      submissionKey: randomUUID(),
      form: complaint(true),
      attachments: [],
    })
    expect(profile.snapshot).not.toHaveBeenCalled()
    const parser = createEnabledClickUpServices('fixture', {
      transport: async () => {
        const task = [...fake.tasks.values()][0]!
        return new Response(
          JSON.stringify({
            ...task,
            tags: task.tags.map((name) => ({ name })),
            custom_fields: [
              {
                id: TARGET.user,
                name: '用户',
                type: 'short_text',
                type_config: {},
                value: { id: 'secret-id', username: 'secret-name' },
              },
            ],
          }),
        )
      },
    })
    let parsed: ClickUpTask | undefined
    vi.mocked(fake.service.getTask).mockImplementation(async (id) => {
      parsed = await parser.getTask(id)
      return parsed
    })
    const advanced = await support.advance(userId, prepared.snapshot.id, {
      expectedRevision: prepared.snapshot.revision,
      intent: 'continue',
    })
    expect(parsed?.custom_fields[0]).toMatchObject({ id: TARGET.user, hasUnsupportedValue: true })
    expect(JSON.stringify(parsed)).not.toMatch(/secret-id|secret-name/)
    expect(advanced.snapshot.status).toBe('verification_required')
    expect(fake.createTask).toHaveBeenCalledTimes(1)
    expect((await support.get(userId, prepared.snapshot.id)).status).toBe('verification_required')
  })
})
