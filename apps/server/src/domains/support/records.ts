import type { QueryResultRow } from 'pg'
import type { SqlExecutor } from '../../db/client.js'
import { safeInteger } from '../../db/client.js'
import { FeedbackError } from './errors.js'
import {
  normalizeStoredPrepare,
  sha256,
  content,
  type FeedbackForm,
  type FeedbackSnapshot,
} from './validation.js'
import { finalMarkdown } from './markdown.js'
import {
  activeCommunityProfile,
  validateStoredTask,
  type CommunityProfile,
  type ValidatedFrozenTask,
} from './frozen-payload.js'
export interface Submission extends QueryResultRow {
  id: string
  user_id: string
  submission_key: string
  nickname_snapshot: string
  form_kind: string
  form_version: number
  content_rule_version: number
  form_json: string
  user_markdown: string
  final_markdown: string
  payload_sha256: string
  task_payload_json: string
  task_payload_sha256: string
  revision: number
  status: FeedbackSnapshot['status']
  attachment_count: number
  total_attachment_bytes: number
  created_at: number
  receive_expires_at: number
  updated_at: number
  clickup_task_id: string | null
  target_list_id: string
  attempt_id: string | null
  attempt_kind: 'create_task' | 'upload_attachment' | null
  attempt_attachment_id: string | null
  attempt_started_at: number | null
  attempt_expires_at: number | null
  attempt_owner_boot_id: string | null
  failure_code: NonNullable<FeedbackSnapshot['failure']>['code'] | null
  failure_phase: 'create_task' | 'upload_attachment' | null
  failure_attachment_id: string | null
  retry_not_before: number | null
  maintenance_resolution_json: string | null
}
export interface Attachment extends QueryResultRow {
  id: string
  submission_id: string
  ordinal: number
  original_name: string
  content_type: string
  byte_length: number
  sha256: string
  status: FeedbackSnapshot['attachments'][number]['status']
  remote_attachment_id: string | null
  bytes_length: number | null
}
export interface RecordSet {
  row: Submission
  attachments: Attachment[]
  form: FeedbackForm
  taskPayload: ValidatedFrozenTask
}
const millis = [
  'revision',
  'total_attachment_bytes',
  'created_at',
  'receive_expires_at',
  'updated_at',
  'attempt_started_at',
  'attempt_expires_at',
  'retry_not_before',
] as const
function corrupt(): never {
  throw new Error('Support record invariant failed')
}
export async function readRecord(
  tx: SqlExecutor,
  id: string,
  userId?: string,
  lock = false,
  activeProfile: CommunityProfile = activeCommunityProfile(),
): Promise<RecordSet> {
  const result = await tx.query<Submission>(
    `SELECT * FROM support_feedback_submissions WHERE id=$1${userId === undefined ? '' : ' AND user_id=$2'}${lock ? ' FOR UPDATE' : ''}`,
    userId === undefined ? [id] : [id, userId],
  )
  const row = result.rows[0]
  if (!row) throw new FeedbackError('NOT_FOUND')
  for (const key of millis) if (row[key] !== null) row[key] = safeInteger(row[key]!, key)
  const children = await tx.query<Attachment>(
    'SELECT id,submission_id,ordinal,original_name,content_type,byte_length,sha256,status,remote_attachment_id,octet_length(bytes) AS bytes_length FROM support_feedback_attachments WHERE submission_id=$1 ORDER BY ordinal',
    [id],
  )
  const attachments = children.rows
  let form: FeedbackForm
  try {
    form = JSON.parse(row.form_json) as FeedbackForm
  } catch {
    corrupt()
  }
  const declarations = attachments.map((a) => ({
    id: a.id,
    originalName: a.original_name,
    contentType: a.content_type,
    byteLength: a.byte_length,
    sha256: a.sha256,
  }))
  let input
  try {
    input = normalizeStoredPrepare({
      submissionKey: row.submission_key,
      form,
      attachments: declarations,
    })
  } catch {
    corrupt()
  }
  if (
    row.form_kind !== form.kind ||
    row.content_rule_version !== 1 ||
    JSON.stringify(input.form) !== row.form_json ||
    row.attachment_count !== attachments.length ||
    row.total_attachment_bytes !== attachments.reduce((n, a) => n + a.byte_length, 0) ||
    row.payload_sha256 !== sha256(JSON.stringify(input)) ||
    row.user_markdown !== content(form) ||
    row.final_markdown !== finalMarkdown(row.user_markdown, row.id) ||
    row.revision < 0
  )
    corrupt()
  const frozen = validateStoredTask(row, form, activeProfile)
  for (const [index, a] of attachments.entries()) {
    if (
      a.ordinal !== index ||
      (a.status === 'expected' && (a.bytes_length !== null || a.remote_attachment_id !== null)) ||
      (a.status === 'uploaded' && (a.bytes_length !== null || !a.remote_attachment_id)) ||
      (!['expected', 'uploaded'].includes(a.status) &&
        (a.bytes_length !== a.byte_length || a.remote_attachment_id !== null))
    )
      corrupt()
  }
  const all = attachments.every((a) => a.status === 'uploaded')
  if (
    (row.status === 'completed' &&
      (!row.clickup_task_id || row.attempt_id || row.failure_code || !all)) ||
    (row.status === 'receiving' &&
      (row.clickup_task_id ||
        row.attempt_id ||
        attachments.some((a) => !['expected', 'received'].includes(a.status)))) ||
    (row.status === 'ready' &&
      (row.clickup_task_id ||
        row.attempt_id ||
        attachments.some((a) => a.status !== 'received'))) ||
    (['uploading'].includes(row.status) && !row.clickup_task_id) ||
    (row.status === 'creating' && (!row.attempt_id || row.attempt_kind !== 'create_task'))
  )
    corrupt()
  if (row.attempt_id !== null) {
    if (
      !row.attempt_owner_boot_id ||
      row.attempt_started_at === null ||
      row.attempt_expires_at === null ||
      !row.attempt_kind ||
      !['creating', 'uploading', 'verification_required'].includes(row.status)
    )
      corrupt()
    if (
      row.attempt_kind === 'upload_attachment' &&
      (!row.clickup_task_id ||
        !attachments.some(
          (a) =>
            a.id === row.attempt_attachment_id &&
            ['uploading', 'verification_required'].includes(a.status),
        ))
    )
      corrupt()
  }
  if (row.status === 'failed' && (!row.failure_code || row.attempt_id)) corrupt()
  if (
    row.status === 'verification_required' &&
    (!row.attempt_id ||
      row.failure_code !== 'UPSTREAM_UNKNOWN' ||
      row.failure_phase !== row.attempt_kind ||
      row.failure_attachment_id !== row.attempt_attachment_id)
  )
    corrupt()
  if (
    row.status === 'uploading' &&
    !row.attempt_id &&
    (all ||
      row.failure_code ||
      attachments.some((a) => !['received', 'uploaded'].includes(a.status)))
  )
    corrupt()
  if (row.status === 'creating' && attachments.some((a) => a.status !== 'received')) corrupt()
  if (row.status === 'failed') {
    if (
      row.failure_phase === 'create_task' &&
      (row.clickup_task_id || attachments.some((a) => a.status !== 'received'))
    )
      corrupt()
    if (
      row.failure_phase === 'upload_attachment' &&
      (!row.clickup_task_id ||
        !attachments.some((a) => a.id === row.failure_attachment_id && a.status === 'failed') ||
        attachments.some(
          (a) => a.id !== row.failure_attachment_id && !['received', 'uploaded'].includes(a.status),
        ))
    )
      corrupt()
  }
  return { row, attachments, form, taskPayload: frozen }
}
export function snapshot(record: RecordSet, now: number): FeedbackSnapshot {
  const { row: r, attachments, form } = record
  const active = r.attempt_id !== null
  const expired = active && r.attempt_expires_at! <= now
  const nextAction: FeedbackSnapshot['nextAction'] =
    r.status === 'completed'
      ? 'done'
      : r.status === 'receiving'
        ? r.receive_expires_at <= now
          ? 'restart'
          : 'upload'
        : r.status === 'verification_required' || expired
          ? 'verify'
          : active
            ? 'wait'
            : r.status === 'failed'
              ? 'retry'
              : 'continue'
  return {
    id: r.id,
    submissionKey: r.submission_key,
    revision: r.revision,
    form,
    createdAt: r.created_at,
    receiveExpiresAt: r.receive_expires_at,
    status: r.status,
    nextAction,
    taskId: r.clickup_task_id,
    taskUrl:
      r.clickup_task_id === null
        ? null
        : `https://app.clickup.com/t/${encodeURIComponent(r.clickup_task_id)}`,
    failure:
      r.failure_code === null
        ? null
        : {
            code: r.failure_code,
            phase: r.failure_phase!,
            attachmentId: r.failure_attachment_id,
            retryAfterSeconds:
              r.retry_not_before !== null && r.retry_not_before > now
                ? Math.ceil((r.retry_not_before - now) / 1000)
                : null,
          },
    attachments: attachments.map((a) => ({
      id: a.id,
      ordinal: a.ordinal,
      originalName: a.original_name,
      contentType: a.content_type,
      byteLength: a.byte_length,
      sha256: a.sha256,
      status: a.status,
      remoteAttachmentId: a.remote_attachment_id,
    })),
  }
}
