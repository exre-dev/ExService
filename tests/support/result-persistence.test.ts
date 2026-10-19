import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppDatabase } from '@server/src/db/client'
import { createSupportServices } from '@server/src/domains/support/service'
import { createSupportMaintenance } from '@server/src/domains/support/maintenance'
import { sha256 } from '@server/src/domains/support/validation'
import { createTestAuth, type TestAuth } from '@tests/helpers/auth'
import { fakeClickUp, requestInput } from '@tests/helpers/support-clickup'

const fixtures: TestAuth[] = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.close()))
})

async function setup() {
  const f = await createTestAuth()
  fixtures.push(f)
  const userId = await f.seedUser({
    email: 'result@example.com',
    nickname: '结果核对',
    password: 'valid password',
  })
  const fake = fakeClickUp()
  let rejectCommits = false
  let rolledBackResults = 0
  const commitFailure = new Error('Injected result persistence failure')
  // Execute the actual statements against PostgreSQL, then abort before commit.
  // The result transaction and its error fallback both roll back, preserving the
  // durable attempt that preceded the externally successful POST.
  const injected: AppDatabase = {
    query: f.db.query.bind(f.db),
    close: () => f.db.close(),
    transaction: (run, mode) =>
      f.db.transaction(async (tx) => {
        const result = await run(tx)
        if (rejectCommits && mode !== 'repeatable-read-read-only') {
          rolledBackResults++
          throw commitFailure
        }
        return result
      }, mode),
  }
  const oldBoot = randomUUID()
  const support = createSupportServices({
    db: injected,
    clickup: fake.service,
    profile: f.profileServices,
    now: f.now,
    bootId: oldBoot,
  })
  return {
    f,
    fake,
    userId,
    support,
    oldBoot,
    commitFailure,
    failCommits: () => {
      rejectCommits = true
    },
    restoreCommits: () => {
      rejectCommits = false
    },
    rolledBackResults: () => rolledBackResults,
  }
}

describe('external success followed by local result commit failure', () => {
  it.each(['known_id', 'verified_result'] as const)(
    'preserves the original create attempt when %s persistence rolls back',
    async (phase) => {
      const {
        f,
        fake,
        userId,
        support,
        oldBoot,
        commitFailure,
        failCommits,
        restoreCommits,
        rolledBackResults,
      } = await setup()
      const originalCreate = fake.createTask.getMockImplementation()!
      const originalRead = vi.mocked(fake.service.getTask).getMockImplementation()!
      let claimedAttempt: string | undefined
      const create = vi
        .spyOn(fake.service, 'createTask')
        .mockImplementation(async (listId, input) => {
          claimedAttempt = (
            await f.db.query<{ attempt_id: string }>(
              'SELECT attempt_id FROM support_feedback_submissions WHERE attempt_owner_boot_id=$1',
              [oldBoot],
            )
          ).rows[0]!.attempt_id
          const remote = await originalCreate(listId, input)
          if (phase === 'known_id') failCommits()
          return remote
        })
      vi.spyOn(fake.service, 'getTask').mockImplementation(async (taskId) => {
        const remote = await originalRead(taskId)
        if (phase === 'verified_result') failCommits()
        return remote
      })
      const prepared = (await support.prepare(userId, requestInput())).snapshot
      await expect(
        support.advance(userId, prepared.id, {
          expectedRevision: prepared.revision,
          intent: 'continue',
        }),
      ).rejects.toBe(commitFailure)
      expect(rolledBackResults()).toBe(2)
      expect(create).toHaveBeenCalledTimes(1)
      expect(fake.tasks.size).toBe(1)
      restoreCommits()
      // Prevent the fake read-back from re-enabling failure during maintenance.
      vi.mocked(fake.service.getTask).mockImplementation(originalRead)
      const durable = await support.get(userId, prepared.id)
      expect(durable.status).toBe('creating')
      expect(durable.nextAction).toBe('wait')
      expect(durable.taskId).toBe(phase === 'known_id' ? null : 'task-1')
      const row = (
        await f.db.query(
          'SELECT attempt_id,attempt_owner_boot_id,failure_code FROM support_feedback_submissions WHERE id=$1',
          [prepared.id],
        )
      ).rows[0]!
      expect(row.attempt_id).toEqual(expect.any(String))
      expect(row.attempt_id).toBe(claimedAttempt)
      expect(row.attempt_owner_boot_id).toBe(oldBoot)
      expect(row.failure_code).toBeNull()
      expect(
        (
          await support.advance(userId, prepared.id, {
            expectedRevision: prepared.revision,
            intent: 'continue',
          })
        ).statusCode,
      ).toBe(200)
      expect(
        (
          await support.advance(userId, prepared.id, {
            expectedRevision: durable.revision,
            intent: 'continue',
          })
        ).statusCode,
      ).toBe(202)
      expect(create).toHaveBeenCalledTimes(1)

      const restarted = createSupportServices({
        db: f.db,
        clickup: fake.service,
        profile: f.profileServices,
        now: f.now,
      })
      await restarted.recover()
      const recovered = await restarted.get(userId, prepared.id)
      expect(recovered.status).toBe('verification_required')
      expect(recovered.nextAction).toBe('verify')
      expect(recovered.revision).toBeGreaterThan(durable.revision)
      const maintenance = createSupportMaintenance({ db: f.db, clickup: fake.service, now: f.now })
      expect((await maintenance.inspect(prepared.id)).attempt?.id).toBe(row.attempt_id)
      await maintenance.resolveTask(prepared.id, row.attempt_id, 'task-1', true)
      expect(await restarted.get(userId, prepared.id)).toMatchObject({
        status: 'completed',
        taskId: 'task-1',
        nextAction: 'done',
      })
      expect(create).toHaveBeenCalledTimes(1)
    },
  )

  it('preserves bytes and the upload attempt after remote attachment success until content-proven reconciliation', async () => {
    const {
      f,
      fake,
      userId,
      support,
      oldBoot,
      commitFailure,
      failCommits,
      restoreCommits,
      rolledBackResults,
    } = await setup()
    const bytes = Buffer.from('provider accepted these exact bytes')
    const attachmentId = randomUUID()
    const input = {
      ...requestInput(),
      attachments: [
        {
          id: attachmentId,
          originalName: 'proof.txt',
          contentType: 'text/plain',
          byteLength: bytes.length,
          sha256: sha256(bytes),
        },
      ],
    }
    let s = (await support.prepare(userId, input)).snapshot
    s = await support.upload(userId, s.id, attachmentId, {
      bytes,
      filename: 'proof.txt',
      contentType: 'text/plain',
    })
    s = (await support.advance(userId, s.id, { expectedRevision: s.revision, intent: 'continue' }))
      .snapshot
    const originalUpload = vi.mocked(fake.service.uploadAttachment).getMockImplementation()!
    let claimedAttempt: string | undefined
    const upload = vi
      .spyOn(fake.service, 'uploadAttachment')
      .mockImplementation(async (taskId, input) => {
        claimedAttempt = (
          await f.db.query<{ attempt_id: string }>(
            'SELECT attempt_id FROM support_feedback_submissions WHERE id=$1',
            [s.id],
          )
        ).rows[0]!.attempt_id
        const remote = await originalUpload(taskId, input)
        failCommits()
        return remote
      })
    await expect(
      support.advance(userId, s.id, { expectedRevision: s.revision, intent: 'continue' }),
    ).rejects.toBe(commitFailure)
    expect(rolledBackResults()).toBe(2)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(fake.tasks.get(s.taskId!)!.attachments).toHaveLength(1)
    restoreCommits()
    const durable = await support.get(userId, s.id)
    expect(durable).toMatchObject({ status: 'uploading', nextAction: 'wait', taskId: s.taskId })
    const parent = (
      await f.db.query(
        'SELECT attempt_id,attempt_owner_boot_id FROM support_feedback_submissions WHERE id=$1',
        [s.id],
      )
    ).rows[0]!
    expect(parent.attempt_owner_boot_id).toBe(oldBoot)
    expect(parent.attempt_id).toBe(claimedAttempt)
    const stored = (
      await f.db.query(
        'SELECT bytes,status,remote_attachment_id FROM support_feedback_attachments WHERE submission_id=$1 AND id=$2',
        [s.id, attachmentId],
      )
    ).rows[0]!
    expect(stored.bytes).toEqual(bytes)
    expect(stored.status).toBe('uploading')
    expect(stored.remote_attachment_id).toBeNull()
    await support.advance(userId, s.id, { expectedRevision: s.revision, intent: 'continue' })
    await support.advance(userId, s.id, { expectedRevision: durable.revision, intent: 'continue' })
    expect(upload).toHaveBeenCalledTimes(1)

    const restarted = createSupportServices({
      db: f.db,
      clickup: fake.service,
      profile: f.profileServices,
      now: f.now,
    })
    await restarted.recover()
    expect((await restarted.get(userId, s.id)).nextAction).toBe('verify')
    const maintenance = createSupportMaintenance({ db: f.db, clickup: fake.service, now: f.now })
    await maintenance.resolveAttachment(
      s.id,
      attachmentId,
      parent.attempt_id,
      'attachment-1',
      bytes,
      true,
    )
    expect((await restarted.get(userId, s.id)).status).toBe('completed')
    expect(
      (
        await f.db.query(
          'SELECT bytes,remote_attachment_id FROM support_feedback_attachments WHERE submission_id=$1 AND id=$2',
          [s.id, attachmentId],
        )
      ).rows[0],
    ).toEqual({ bytes: null, remote_attachment_id: 'attachment-1' })
    expect(upload).toHaveBeenCalledTimes(1)
    expect(fake.createTask).toHaveBeenCalledTimes(1)
  })
})
