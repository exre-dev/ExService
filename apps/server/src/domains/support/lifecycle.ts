import type { SqlExecutor } from '../../db/client.js'
import { FeedbackError } from './errors.js'
import type { RecordSet } from './records.js'
import type { NotWrittenEvidence } from './maintenance.js'

export type AttemptGuard =
  | { source: 'advance'; attemptId: string; bootId: string }
  | { source: 'maintenance'; attemptId: string; expectedRevision: number }
  | { source: 'reconcile'; attemptId: string; reason: 'expired'; currentTime: number }
  | { source: 'reconcile'; attemptId: string; reason: 'old_boot'; currentBootId: string }
type MaintenanceResolution = Record<string, unknown>
type FailureCode = NonNullable<RecordSet['row']['failure_code']>
export type Outcome =
  | { kind: 'task_id_saved'; taskId: string }
  | { kind: 'task_confirmed'; taskId: string; resolution?: MaintenanceResolution }
  | {
      kind: 'attachment_uploaded'
      attachmentId: string
      remoteId: string
      resolution?: MaintenanceResolution
    }
  | { kind: 'definite_failure'; code: FailureCode; retryNotBefore: number | null }
  | { kind: 'unknown' }
  | {
      kind: 'confirmed_not_written'
      evidence: NotWrittenEvidence
      resolution: MaintenanceResolution
    }

export const clearAttempt =
  'attempt_id=NULL,attempt_kind=NULL,attempt_attachment_id=NULL,attempt_started_at=NULL,attempt_expires_at=NULL,attempt_owner_boot_id=NULL'
export const clearFailure =
  'failure_code=NULL,failure_phase=NULL,failure_attachment_id=NULL,retry_not_before=NULL'

function conflict(): never {
  throw new FeedbackError('FEEDBACK_STATE_CONFLICT')
}
function guarded(record: RecordSet, guard: AttemptGuard): boolean {
  const row = record.row
  if (row.attempt_id !== guard.attemptId) {
    if (guard.source === 'maintenance') conflict()
    return false
  }
  if (guard.source === 'maintenance') {
    if (row.revision !== guard.expectedRevision || row.status !== 'verification_required')
      conflict()
    return true
  }
  if (row.status !== 'creating' && row.status !== 'uploading') return false
  if (guard.source === 'advance') return row.attempt_owner_boot_id === guard.bootId
  if (guard.reason === 'expired')
    return row.attempt_expires_at !== null && row.attempt_expires_at <= guard.currentTime
  return row.attempt_owner_boot_id !== guard.currentBootId
}

/** Apply one external result while the caller holds the submission row lock. */
export async function persistOutcome(
  tx: SqlExecutor,
  locked: RecordSet,
  guard: AttemptGuard,
  outcome: Outcome,
  at: number,
): Promise<boolean> {
  if (!guarded(locked, guard)) return false
  const row = locked.row,
    id = row.id
  const phase = row.attempt_kind
  if (outcome.kind === 'unknown') {
    if (guard.source === 'maintenance') conflict()
    if (row.attempt_attachment_id)
      await tx.query(
        "UPDATE support_feedback_attachments SET status='verification_required',updated_at=$3 WHERE submission_id=$1 AND id=$2",
        [id, row.attempt_attachment_id, at],
      )
    await tx.query(
      "UPDATE support_feedback_submissions SET status='verification_required',failure_code='UPSTREAM_UNKNOWN',failure_phase=attempt_kind,failure_attachment_id=attempt_attachment_id,retry_not_before=NULL,revision=revision+1,updated_at=$2 WHERE id=$1",
      [id, at],
    )
    return true
  }
  if (outcome.kind === 'task_id_saved') {
    if (guard.source !== 'advance' || phase !== 'create_task' || row.clickup_task_id !== null)
      conflict()
    await tx.query(
      'UPDATE support_feedback_submissions SET clickup_task_id=$2,revision=revision+1,updated_at=$3 WHERE id=$1',
      [id, outcome.taskId, at],
    )
    return true
  }
  if (outcome.kind === 'task_confirmed') {
    if (
      phase !== 'create_task' ||
      (row.clickup_task_id !== null && row.clickup_task_id !== outcome.taskId) ||
      (guard.source === 'advance' && row.clickup_task_id !== outcome.taskId) ||
      guard.source === 'reconcile'
    )
      conflict()
    const resolution = guard.source === 'maintenance' ? JSON.stringify(outcome.resolution) : null
    if (guard.source === 'maintenance' && !outcome.resolution) conflict()
    await tx.query(
      `UPDATE support_feedback_submissions SET clickup_task_id=$2,status=$3,${clearAttempt},${clearFailure},maintenance_resolution_json=COALESCE($4,maintenance_resolution_json),revision=revision+1,updated_at=$5 WHERE id=$1`,
      [id, outcome.taskId, locked.attachments.length ? 'uploading' : 'completed', resolution, at],
    )
    return true
  }
  if (outcome.kind === 'attachment_uploaded') {
    const attachment = locked.attachments.find((item) => item.id === outcome.attachmentId)
    if (
      phase !== 'upload_attachment' ||
      row.attempt_attachment_id !== outcome.attachmentId ||
      !attachment ||
      attachment.remote_attachment_id !== null ||
      guard.source === 'reconcile' ||
      (guard.source === 'maintenance' && !outcome.resolution)
    )
      conflict()
    await tx.query(
      "UPDATE support_feedback_attachments SET status='uploaded',remote_attachment_id=$3,bytes=NULL,updated_at=$4 WHERE submission_id=$1 AND id=$2",
      [id, outcome.attachmentId, outcome.remoteId, at],
    )
    const done = locked.attachments.every(
      (item) => item.id === outcome.attachmentId || item.status === 'uploaded',
    )
    const resolution = guard.source === 'maintenance' ? JSON.stringify(outcome.resolution) : null
    await tx.query(
      `UPDATE support_feedback_submissions SET status=$2,${clearAttempt},${clearFailure},maintenance_resolution_json=COALESCE($3,maintenance_resolution_json),revision=revision+1,updated_at=$4 WHERE id=$1`,
      [id, done ? 'completed' : 'uploading', resolution, at],
    )
    return true
  }
  if (outcome.kind === 'definite_failure') {
    const attachment = locked.attachments.find((item) => item.id === row.attempt_attachment_id)
    if (
      guard.source !== 'advance' ||
      (phase === 'create_task' && row.clickup_task_id !== null) ||
      (phase === 'upload_attachment' &&
        (!row.clickup_task_id || !attachment || attachment.remote_attachment_id !== null)) ||
      !phase
    )
      conflict()
    if (attachment)
      await tx.query(
        "UPDATE support_feedback_attachments SET status='failed',updated_at=$3 WHERE submission_id=$1 AND id=$2",
        [id, attachment.id, at],
      )
    await tx.query(
      `UPDATE support_feedback_submissions SET status='failed',failure_code=$2,failure_phase=attempt_kind,failure_attachment_id=attempt_attachment_id,retry_not_before=$3,${clearAttempt},revision=revision+1,updated_at=$4 WHERE id=$1`,
      [id, outcome.code, outcome.retryNotBefore, at],
    )
    return true
  }
  if (
    guard.source !== 'maintenance' ||
    (phase === 'create_task' && row.clickup_task_id !== null) ||
    (phase === 'upload_attachment' &&
      locked.attachments.some(
        (item) => item.id === row.attempt_attachment_id && item.remote_attachment_id !== null,
      )) ||
    !phase
  )
    conflict()
  if (row.attempt_attachment_id)
    await tx.query(
      "UPDATE support_feedback_attachments SET status='failed',updated_at=$3 WHERE submission_id=$1 AND id=$2",
      [id, row.attempt_attachment_id, at],
    )
  await tx.query(
    `UPDATE support_feedback_submissions SET status='failed',failure_code='UPSTREAM_REJECTED',failure_phase=attempt_kind,failure_attachment_id=attempt_attachment_id,retry_not_before=NULL,${clearAttempt},maintenance_resolution_json=$2,revision=revision+1,updated_at=$3 WHERE id=$1`,
    [id, JSON.stringify(outcome.resolution), at],
  )
  return true
}
