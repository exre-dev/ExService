import { randomUUID } from 'node:crypto'
import type { AppDatabase, SqlExecutor } from '../../db/client.js'
import type { ProfileService } from '../../modules/profile/service.js'
import type { ClickUpServices } from '../../modules/clickup/service.js'
import { ClickUpError, assertClickUpTaskId } from '../../modules/clickup/errors.js'
import { normalizeMime } from '@workspace/common/feedback-content'
import { finalMarkdown } from './markdown.js'
import { FeedbackError } from './errors.js'
import {
  normalizePrepare,
  normalizeAdvance,
  content,
  sha256,
  type FeedbackPrepare,
  type FeedbackSnapshot,
  type FeedbackAdvance,
  type FeedbackOptions,
} from './validation.js'
import { createMetadata, frozenTaskInput, type CommunityTarget } from './metadata.js'
import { activeCommunityProfile, matchesFrozenTask } from './frozen-payload.js'
import { loadFieldDefinitions, type FieldDefinition } from './field-config.js'
import { readRecord, snapshot, type RecordSet } from './records.js'
import { clearFailure, persistOutcome, type AttemptGuard, type Outcome } from './lifecycle.js'
export interface SupportUpload {
  bytes: Buffer
  filename: string
  contentType: string
}
export interface SupportServices {
  options(area?: import('./metadata.js').FeedbackArea): Promise<FeedbackOptions>
  prepare(
    userId: string,
    input: FeedbackPrepare,
  ): Promise<{ snapshot: FeedbackSnapshot; created: boolean }>
  get(userId: string, id: string): Promise<FeedbackSnapshot>
  lookup(userId: string, key: string): Promise<FeedbackSnapshot>
  authorizeUpload(userId: string, id: string, attachmentId: string): Promise<void>
  upload(
    userId: string,
    id: string,
    attachmentId: string,
    input: SupportUpload,
  ): Promise<FeedbackSnapshot>
  advance(
    userId: string,
    id: string,
    input: FeedbackAdvance,
  ): Promise<{ snapshot: FeedbackSnapshot; statusCode: 200 | 202 }>
  recover(): Promise<void>
  close(): Promise<void>
}
export interface SupportDependencies {
  db: AppDatabase
  clickup: ClickUpServices
  profile: Pick<ProfileService, 'snapshot'>
  now?: () => number
  bootId?: string
  communityTarget?: CommunityTarget
  fieldDefinitions?: FieldDefinition[]
}
export function createSupportServices({
  db,
  clickup,
  profile,
  now = Date.now,
  bootId = randomUUID(),
  communityTarget,
  fieldDefinitions = loadFieldDefinitions(),
}: SupportDependencies): SupportServices {
  const metadata = createMetadata(clickup, now, fieldDefinitions, communityTarget)
  const read = (tx: SqlExecutor, id: string, userId?: string, lock = false) =>
    readRecord(tx, id, userId, lock, activeCommunityProfile(communityTarget))
  const active = new Set<Promise<unknown>>()
  let closing = false
  const get = async (userId: string, id: string) =>
    db.transaction(
      async (tx) => snapshot(await read(tx, id, userId), now()),
      'repeatable-read-read-only',
    )
  const uploadAllowed = (r: RecordSet, attachmentId: string) => {
    const attachment = r.attachments.find((a) => a.id === attachmentId)
    if (!attachment) throw new FeedbackError('NOT_FOUND')
    // A received immutable digest also proves a later PUT replay after advance.
    // Only a still-missing file can change persistent state, and only while receiving.
    if (
      attachment.status === 'expected' &&
      (r.row.status !== 'receiving' || r.row.receive_expires_at <= now())
    )
      throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
  }
  async function advance(
    userId: string,
    id: string,
    input: FeedbackAdvance,
  ): Promise<{ snapshot: FeedbackSnapshot; statusCode: 200 | 202 }> {
    input = normalizeAdvance(input)
    // Inspect without a write to allow stale replay and completed replay even while draining.
    const initial = await db.transaction((tx) => read(tx, id, userId), 'repeatable-read-read-only')
    const current = initial.row
    if (input.expectedRevision > current.revision)
      throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
    if (
      input.expectedRevision < current.revision ||
      current.status === 'completed' ||
      current.status === 'verification_required'
    )
      return { snapshot: snapshot(initial, now()), statusCode: 200 }
    if (current.attempt_id && current.attempt_expires_at! <= now()) {
      await db.transaction(async (tx) => {
        const r = await read(tx, id, userId, true)
        if (current.attempt_id)
          await persistOutcome(
            tx,
            r,
            {
              source: 'reconcile',
              attemptId: current.attempt_id,
              reason: 'expired',
              currentTime: now(),
            },
            { kind: 'unknown' },
            now(),
          )
      })
      return { snapshot: await get(userId, id), statusCode: 200 }
    }
    if (current.attempt_id && current.attempt_expires_at! > now())
      return { snapshot: snapshot(initial, now()), statusCode: 202 }
    if (closing || active.size >= 2) throw new FeedbackError('FEEDBACK_BUSY', 5)
    // Reserve synchronously across preflight, claim, POST and settlement.
    let release!: () => void
    const reservation = new Promise<void>((resolve) => {
      release = resolve
    })
    active.add(reservation)
    try {
      if (!current.attempt_id && !clickup.available) throw new FeedbackError('FEEDBACK_UNAVAILABLE')
      const claim = await db.transaction(async (tx) => {
        const r = await read(tx, id, userId, true),
          s = r.row
        if (
          input.expectedRevision !== s.revision ||
          s.status === 'completed' ||
          s.status === 'verification_required'
        )
          return { record: r, attempt: null, replay: true }
        if (s.attempt_id) {
          if (s.attempt_expires_at! <= now()) {
            await persistOutcome(
              tx,
              r,
              {
                source: 'reconcile',
                attemptId: s.attempt_id,
                reason: 'expired',
                currentTime: now(),
              },
              { kind: 'unknown' },
              now(),
            )
            return { record: await read(tx, id, userId), attempt: null }
          }
          return { record: r, attempt: null }
        }
        if (s.status === 'failed') {
          if (
            input.intent !== 'retry' ||
            (s.retry_not_before !== null && s.retry_not_before > now()) ||
            (s.failure_phase === 'create_task' && s.clickup_task_id !== null)
          )
            throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
        } else if (input.intent !== 'continue') throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
        if (s.status === 'receiving') {
          if (s.receive_expires_at <= now() || r.attachments.some((a) => a.status !== 'received'))
            throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
          await tx.query(
            "UPDATE support_feedback_submissions SET status='ready',revision=revision+1,updated_at=$2 WHERE id=$1",
            [id, now()],
          )
        }
        const phase = s.clickup_task_id ? 'upload_attachment' : 'create_task'
        const attachment =
          phase === 'upload_attachment'
            ? r.attachments.find((a) => ['received', 'failed'].includes(a.status))
            : undefined
        if (phase === 'upload_attachment' && !attachment)
          throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
        let bytes: Buffer | undefined
        if (attachment) {
          bytes = (
            await tx.query<{ bytes: Buffer }>(
              'SELECT bytes FROM support_feedback_attachments WHERE submission_id=$1 AND id=$2',
              [id, attachment.id],
            )
          ).rows[0]?.bytes
          // Recheck the loaded bytes while the parent is locked, before a claim
          // can commit. Local corruption is not an uncertain external write.
          if (
            !Buffer.isBuffer(bytes) ||
            bytes.byteLength !== attachment.byte_length ||
            sha256(bytes) !== attachment.sha256
          )
            throw new Error('Support attachment invariant failed')
        }
        const attempt = randomUUID(),
          at = now()
        if (attachment)
          await tx.query(
            "UPDATE support_feedback_attachments SET status='uploading',updated_at=$3 WHERE submission_id=$1 AND id=$2",
            [id, attachment.id, at],
          )
        await tx.query(
          `UPDATE support_feedback_submissions SET status=$2,attempt_id=$3,attempt_kind=$4,attempt_attachment_id=$5,attempt_started_at=$6,attempt_expires_at=$7,attempt_owner_boot_id=$8,${clearFailure},revision=revision+1,updated_at=$6 WHERE id=$1`,
          [
            id,
            phase === 'create_task' ? 'creating' : 'uploading',
            attempt,
            phase,
            attachment?.id ?? null,
            at,
            at + 90000,
            bootId,
          ],
        )
        return { record: await read(tx, id, userId), attempt, attachment, bytes }
      })
      if (!claim.attempt)
        return {
          snapshot: snapshot(claim.record, now()),
          statusCode:
            claim.replay ||
            claim.record.row.status === 'completed' ||
            claim.record.row.status === 'verification_required'
              ? 200
              : 202,
        }
      const expected = claim.record.taskPayload
      const settle = async (outcome: Outcome) =>
        db.transaction(async (tx) => {
          const r = await read(tx, id, userId, true)
          const guard: AttemptGuard = { source: 'advance', attemptId: claim.attempt!, bootId }
          return persistOutcome(tx, r, guard, outcome, now())
        })
      try {
        if (claim.record.row.attempt_kind === 'create_task') {
          const result = await clickup.createTask(expected.payload.listId, expected.payload.task)
          try {
            assertClickUpTaskId(result.id)
          } catch {
            throw new ClickUpError('unknown', 'UPSTREAM_UNKNOWN')
          }
          const saved = await settle({ kind: 'task_id_saved', taskId: result.id })
          if (saved) {
            const remote = await clickup.getTask(result.id)
            if (!matchesFrozenTask(remote, expected, result.id))
              throw new ClickUpError('unknown', 'UPSTREAM_UNKNOWN')
            await settle({ kind: 'task_confirmed', taskId: result.id })
          }
        } else {
          if (!claim.bytes || !claim.attachment) throw new Error('Missing claimed attachment')
          const result = await clickup.uploadAttachment(claim.record.row.clickup_task_id!, {
            bytes: claim.bytes,
            filename: claim.attachment.original_name,
            contentType: claim.attachment.content_type,
          })
          if (!result.id || result.id.length > 256 || /[\x00-\x1f\x7f]/.test(result.id))
            throw new ClickUpError('unknown', 'UPSTREAM_UNKNOWN')
          await settle({
            kind: 'attachment_uploaded',
            attachmentId: claim.attachment.id,
            remoteId: result.id,
          })
        }
      } catch (error) {
        const currentResult = await db.transaction(
          (tx) => read(tx, id, userId),
          'repeatable-read-read-only',
        )
        // Once creation ID is known, any verification read failure is unknown,
        // even when GET returned an explicit rejection.
        const known =
          error instanceof ClickUpError &&
          ['rejected', 'rate_limited', 'unavailable', 'invalid_input'].includes(error.kind) &&
          !(currentResult.row.attempt_kind === 'create_task' && currentResult.row.clickup_task_id)
        if (!known) {
          await settle({ kind: 'unknown' })
        } else {
          const e = error as ClickUpError
          const code =
            e.kind === 'rate_limited'
              ? 'UPSTREAM_RATE_LIMITED'
              : e.kind === 'unavailable'
                ? 'UPSTREAM_CONFIGURATION'
                : e.code === 'UPSTREAM_CONFIGURATION'
                  ? 'UPSTREAM_CONFIGURATION'
                  : 'UPSTREAM_REJECTED'
          const retry = e.retryAfterSeconds === null ? null : now() + e.retryAfterSeconds * 1000
          await settle({ kind: 'definite_failure', code, retryNotBefore: retry })
        }
      }
      const result = await get(userId, id)
      return { snapshot: result, statusCode: result.status === 'completed' ? 200 : 202 }
    } finally {
      active.delete(reservation)
      release()
    }
  }
  return {
    options: metadata.options,
    get,
    advance,
    async lookup(userId, key) {
      const result = await db.query<{ id: string }>(
        'SELECT id FROM support_feedback_submissions WHERE user_id=$1 AND submission_key=$2',
        [userId, key],
      )
      if (!result.rows[0]) throw new FeedbackError('NOT_FOUND')
      return get(userId, result.rows[0].id)
    },
    async prepare(userId, value) {
      const input = normalizePrepare(value),
        digest = sha256(JSON.stringify(input))
      const existing = await db.query<{ id: string; payload_sha256: string }>(
        'SELECT id,payload_sha256 FROM support_feedback_submissions WHERE user_id=$1 AND submission_key=$2',
        [userId, input.submissionKey],
      )
      if (existing.rows[0]) {
        if (existing.rows[0].payload_sha256 !== digest)
          throw new FeedbackError('FEEDBACK_PAYLOAD_CONFLICT')
        return { snapshot: await get(userId, existing.rows[0].id), created: false }
      }
      await metadata.preflight(input.form)
      const nickname =
        input.form.kind === 'complaint' && input.form.anonymous
          ? ''
          : (await profile.snapshot(userId)).nickname
      return db.transaction(async (tx) => {
        const user = await tx.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId])
        if (!user.rows[0]) throw new FeedbackError('NOT_FOUND')
        const replay = await tx.query<{ id: string; payload_sha256: string }>(
          'SELECT id,payload_sha256 FROM support_feedback_submissions WHERE user_id=$1 AND submission_key=$2',
          [userId, input.submissionKey],
        )
        if (replay.rows[0]) {
          if (replay.rows[0].payload_sha256 !== digest)
            throw new FeedbackError('FEEDBACK_PAYLOAD_CONFLICT')
          return {
            snapshot: snapshot(await read(tx, replay.rows[0].id, userId), now()),
            created: false,
          }
        }
        const at = now(),
          counts = await tx.query<{ recent: string; receiving: string }>(
            "SELECT count(*) FILTER(WHERE created_at>$2) AS recent,count(*) FILTER(WHERE status='receiving' AND receive_expires_at>$3) AS receiving FROM support_feedback_submissions WHERE user_id=$1",
            [userId, at - 600000, at],
          )
        if (Number(counts.rows[0]!.recent) >= 10 || Number(counts.rows[0]!.receiving) >= 2)
          throw new FeedbackError('FEEDBACK_RATE_LIMITED', 600)
        const id = randomUUID(),
          markdown = content(input.form),
          fullMarkdown = finalMarkdown(markdown, id)
        const frozen = frozenTaskInput(input.form, fullMarkdown, nickname, userId, communityTarget),
          taskPayloadJson = JSON.stringify(frozen)
        await tx.query(
          `INSERT INTO support_feedback_submissions(id,user_id,submission_key,nickname_snapshot,form_kind,form_version,content_rule_version,form_json,user_markdown,final_markdown,payload_sha256,task_payload_json,task_payload_sha256,revision,status,attachment_count,total_attachment_bytes,created_at,receive_expires_at,updated_at,target_list_id) VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,0,'receiving',$13,$14,$15,$16,$15,$17)`,
          [
            id,
            userId,
            input.submissionKey,
            nickname,
            input.form.kind,
            ['suggestion', 'complaint'].includes(input.form.kind) ? 3 : 2,
            JSON.stringify(input.form),
            markdown,
            fullMarkdown,
            digest,
            taskPayloadJson,
            sha256(taskPayloadJson),
            input.attachments.length,
            input.attachments.reduce((n, a) => n + a.byteLength, 0),
            at,
            at + 86400000,
            frozen.listId,
          ],
        )
        for (const [ordinal, a] of input.attachments.entries())
          await tx.query(
            "INSERT INTO support_feedback_attachments(submission_id,id,ordinal,original_name,content_type,byte_length,sha256,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'expected',$8,$8)",
            [id, a.id, ordinal, a.originalName, a.contentType, a.byteLength, a.sha256, at],
          )
        return { snapshot: snapshot(await read(tx, id, userId), at), created: true }
      })
    },
    async authorizeUpload(userId, id, attachmentId) {
      await db.transaction(
        async (tx) => uploadAllowed(await read(tx, id, userId), attachmentId),
        'repeatable-read-read-only',
      )
    },
    async upload(userId, id, attachmentId, input) {
      return db.transaction(async (tx) => {
        const r = await read(tx, id, userId, true)
        uploadAllowed(r, attachmentId)
        const a = r.attachments.find((a) => a.id === attachmentId)!
        if (input.bytes.length > 20971520) throw new FeedbackError('FEEDBACK_TOO_LARGE')
        if (
          input.filename !== a.original_name ||
          normalizeMime(input.contentType) !== a.content_type ||
          input.bytes.length !== a.byte_length ||
          sha256(input.bytes) !== a.sha256
        )
          throw new FeedbackError('FEEDBACK_PAYLOAD_CONFLICT')
        if (a.status !== 'expected') return snapshot(r, now())
        await tx.query(
          "UPDATE support_feedback_attachments SET status='received',bytes=$3,updated_at=$4 WHERE submission_id=$1 AND id=$2",
          [id, attachmentId, input.bytes, now()],
        )
        await tx.query(
          'UPDATE support_feedback_submissions SET revision=revision+1,updated_at=$2 WHERE id=$1',
          [id, now()],
        )
        return snapshot(await read(tx, id, userId), now())
      })
    },
    async recover() {
      await db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          'SELECT id FROM support_feedback_submissions WHERE attempt_id IS NOT NULL AND attempt_owner_boot_id<>$1 ORDER BY id FOR UPDATE',
          [bootId],
        )
        for (const { id } of rows.rows) {
          const r = await read(tx, id)
          if (r.row.attempt_id)
            await persistOutcome(
              tx,
              r,
              {
                source: 'reconcile',
                attemptId: r.row.attempt_id,
                reason: 'old_boot',
                currentBootId: bootId,
              },
              { kind: 'unknown' },
              now(),
            )
        }
      })
    },
    async close() {
      closing = true
      if (!active.size) return
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        Promise.all([...active]),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 90000)
        }),
      ])
      clearTimeout(timer)
    },
  }
}
