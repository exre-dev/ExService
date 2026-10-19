import type { components } from '@workspace/sdk/types'
import type { SqlExecutor } from '@server/src/db/client.js'
import {
  validateStoredJoinForm,
  type JoinForm,
} from '@server/src/domains/join/applications/form-validation.js'

export interface ApplicationRow {
  id: string
  email: string
  nickname: string
  qq: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: number
  reviewed_at: number | null
  reviewed_by_user_id: string | null
  form_version: 0 | 1
}
export interface InvitationRow {
  id: string
  application_id: string
  status: 'active' | 'expired' | 'completed'
  issued_at: number
  expires_at: number
  code_version: number
  code_digest: string | null
  code_expires_at: number | null
  completion_token_hash: string | null
  completion_expires_at: number | null
  completed_user_id: string | null
  completed_at: number | null
}
export interface ControlRow {
  email: string
  next_send_at: number
  failure_window_started_at: number | null
  failed_attempts: number
}
export interface DeliveryRow {
  id: string
  status: 'pending' | 'sent' | 'failed'
  started_at: number
  finished_at: number | null
}

export function effectiveStatus(row: InvitationRow, now: number) {
  return row.status === 'active' && now >= row.expires_at ? ('expired' as const) : row.status
}
export async function application(db: SqlExecutor, id: string) {
  return (await db.query<ApplicationRow>('SELECT * FROM join_applications WHERE id = $1', [id]))
    .rows[0]
}
export async function latestInvitation(db: SqlExecutor, applicationId: string) {
  return (
    await db.query<InvitationRow>(
      'SELECT * FROM join_invitations WHERE application_id = $1 ORDER BY issued_at DESC, id DESC LIMIT 1',
      [applicationId],
    )
  ).rows[0]
}
export async function control(db: SqlExecutor, email: string) {
  return (await db.query<ControlRow>('SELECT * FROM join_email_controls WHERE email = $1', [email]))
    .rows[0]
}
export async function latestDelivery(db: SqlExecutor, invitationId: string) {
  return (
    await db.query<DeliveryRow>(
      'SELECT id, status, started_at, finished_at FROM join_delivery_attempts WHERE invitation_id = $1 ORDER BY code_version DESC LIMIT 1',
      [invitationId],
    )
  ).rows[0]
}
export async function applicationForm(
  db: SqlExecutor,
  row: ApplicationRow,
  now: number,
): Promise<JoinForm | null> {
  const stored = (
    await db.query<{ version: number; application_type: string; form_json: string }>(
      'SELECT version, application_type, form_json FROM join_application_forms WHERE application_id = $1',
      [row.id],
    )
  ).rows[0]
  if (row.form_version === 0) {
    if (stored) throw new Error('Legacy join application has a versioned form')
    return null
  }
  if (row.form_version !== 1 || !stored || stored.version !== 1)
    throw new Error('Join application versioned form is missing')
  let parsed: unknown
  try {
    parsed = JSON.parse(stored.form_json)
  } catch {
    throw new Error('Join application versioned form is invalid')
  }
  const form = validateStoredJoinForm(parsed, now)
  if (form.applicationType !== stored.application_type)
    throw new Error('Join application versioned form type is inconsistent')
  return form
}
export type AttachmentMetadata = components['schemas']['JoinApplicationAttachment']
export async function attachmentMetadata(
  db: SqlExecutor,
  row: ApplicationRow,
  form: JoinForm | null,
): Promise<AttachmentMetadata[]> {
  const rows = (
    await db.query<{
      id: string
      original_name: string
      extension: AttachmentMetadata['extension']
      byte_length: number
      sha256: string
      ordinal: number
    }>(
      'SELECT id, original_name, extension, byte_length, sha256, ordinal FROM join_application_attachments WHERE application_id = $1 ORDER BY ordinal',
      [row.id],
    )
  ).rows
  if ((form?.applicationType !== 'experienced' && rows.length) || rows.length > 5)
    throw new Error('Join application attachments are inconsistent')
  return rows.map((item) => ({
    id: item.id,
    originalName: item.original_name,
    extension: item.extension,
    byteLength: item.byte_length,
    sha256: item.sha256,
    ordinal: item.ordinal,
  }))
}
export async function summary(db: SqlExecutor, row: ApplicationRow, now: number) {
  const invitation = await latestInvitation(db, row.id)
  const form = await applicationForm(db, row, now)
  const delivery = invitation && (await latestDelivery(db, invitation.id))
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    qq: row.qq,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    invitationStatus: invitation ? effectiveStatus(invitation, now) : null,
    deliveryStatus: delivery?.status ?? null,
    applicationType: form?.applicationType ?? ('legacy' as const),
  }
}
export async function detail(
  db: SqlExecutor,
  row: ApplicationRow,
  now: number,
): Promise<components['schemas']['JoinApplicationDetail']> {
  const form = await applicationForm(db, row, now)
  const invitation = await latestInvitation(db, row.id)
  const delivery = invitation && (await latestDelivery(db, invitation.id))
  const value = {
    application: await summary(db, row, now),
    invitation: invitation
      ? {
          id: invitation.id,
          status: effectiveStatus(invitation, now),
          issuedAt: invitation.issued_at,
          expiresAt: invitation.expires_at,
          codeExpiresAt:
            invitation.code_expires_at !== null && now < invitation.code_expires_at
              ? invitation.code_expires_at
              : null,
          completedAt: invitation.completed_at,
          completedUserId: invitation.completed_user_id,
          resendAvailableAt: Math.max(now, (await control(db, row.email))?.next_send_at ?? now),
          latestDelivery: delivery
            ? {
                id: delivery.id,
                status: delivery.status,
                startedAt: delivery.started_at,
                finishedAt: delivery.finished_at,
              }
            : null,
        }
      : null,
    serverTime: now,
    formVersion: row.form_version,
    form,
    attachments: await attachmentMetadata(db, row, form),
  }
  // Stored-form validation has already established this type/version pairing.
  // Keep the pairing explicit so the generated discriminated result remains precise.
  if (form === null)
    return {
      ...value,
      application: { ...value.application, applicationType: 'legacy' },
      formVersion: 0,
      form: null,
      attachments: [],
    }
  if (form.applicationType === 'new')
    return {
      ...value,
      application: { ...value.application, applicationType: 'new' },
      formVersion: 1,
      form,
      attachments: [],
    }
  return {
    ...value,
    application: { ...value.application, applicationType: 'experienced' },
    formVersion: 1,
    form,
  }
}
