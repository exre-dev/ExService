import { createHash, randomUUID } from 'node:crypto'
import { AuthError } from '@server/src/modules/auth/errors.js'
import type { SqlExecutor } from '@server/src/db/client.js'
import { InvitationService } from '@server/src/domains/join/invitations/service.js'
import {
  application,
  detail,
  latestInvitation,
  summary,
  type ApplicationRow,
} from '@server/src/domains/join/applications/records.js'
import {
  validateJoinApplicationPayload,
  validateJoinQuery,
} from '@server/src/domains/join/applications/form-validation.js'
import {
  validateJoinProofs,
  type JoinProofInput,
} from '@server/src/domains/join/applications/attachment-validation.js'
export type { JoinApplicationInput } from '@server/src/domains/join/applications/form-validation.js'
export type { JoinProofInput } from '@server/src/domains/join/applications/attachment-validation.js'

function isJoinEmailConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const pg = error as { code?: string; constraint?: string }
  return (
    pg.code === '23505' &&
    [
      'join_applications_open_email_unique',
      'join_applications_email_unique',
      'join_application_email_registry_pkey',
    ].includes(pg.constraint ?? '')
  )
}
function assertOne(rowCount: number | null) {
  if (rowCount !== 1) throw new AuthError('JOIN_STATE_CONFLICT')
}

export class JoinService {
  constructor(
    private readonly invitations: InvitationService,
    private readonly createId: () => string = randomUUID,
  ) {}
  private get db() {
    return this.invitations.db
  }

  async submit(value: unknown, proofs: JoinProofInput[] = []) {
    const now = this.invitations.now(),
      input = validateJoinApplicationPayload(value, now)
    const attachments = validateJoinProofs(proofs, input.form.applicationType)
    const { email, nickname } = input
    try {
      await this.db.transaction(async (tx) => {
        if (
          (
            await tx.query('SELECT 1 FROM join_application_email_registry WHERE email = $1', [
              email,
            ])
          ).rows.length ||
          (await tx.query('SELECT 1 FROM join_applications WHERE email = $1', [email])).rows.length
        )
          throw new AuthError('JOIN_APPLICATION_EXISTS')
        if (await this.invitations.hasUser(tx, email)) throw new AuthError('EMAIL_IN_USE')
        const id = this.createId()
        await tx.query(
          "INSERT INTO join_applications (id, email, nickname, qq, status, created_at, form_version) VALUES ($1, $2, $3, $4, 'pending', $5, 1)",
          [id, email, nickname, input.qq, now],
        )
        await tx.query(
          'INSERT INTO join_application_email_registry (email, canonical_application_id) VALUES ($1, $2)',
          [email, id],
        )
        await tx.query(
          'INSERT INTO join_application_forms (application_id, version, application_type, form_json) VALUES ($1, 1, $2, $3)',
          [id, input.form.applicationType, JSON.stringify(input.form)],
        )
        for (const file of attachments) {
          await tx.query(
            'INSERT INTO join_application_attachments (id, application_id, ordinal, original_name, extension, sha256, byte_length, bytes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [
              this.createId(),
              id,
              file.ordinal,
              file.originalName,
              file.extension,
              file.sha256,
              file.byteLength,
              file.bytes,
            ],
          )
        }
      })
    } catch (error) {
      if (isJoinEmailConflict(error)) throw new AuthError('JOIN_APPLICATION_EXISTS')
      throw error
    }
    return { status: 'received' as const }
  }

  async query(value: unknown) {
    const { email } = validateJoinQuery(value),
      now = this.invitations.now()
    return this.db.transaction(async (tx) => {
      if (
        (
          await tx.query(
            `SELECT 1 FROM join_invitations i JOIN join_applications a ON a.id = i.application_id
        JOIN auth_users u ON u.id = i.completed_user_id WHERE a.email = $1 AND i.status = 'completed' LIMIT 1`,
            [email],
          )
        ).rows.length
      )
        return { status: 'registered' as const, nextAction: 'login' as const }
      if (
        (
          await tx.query(
            `SELECT 1 FROM join_invitations i JOIN join_applications a ON a.id = i.application_id
        LEFT JOIN auth_users u ON u.id = i.completed_user_id WHERE a.email = $1 AND i.status = 'completed' AND u.id IS NULL LIMIT 1`,
            [email],
          )
        ).rows.length
      )
        throw new Error('Join application completed invitation association is inconsistent')
      const row = (
        await tx.query<ApplicationRow>(
          'SELECT * FROM join_applications WHERE email = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
          [email],
        )
      ).rows[0]
      if (!row) return { status: 'not_found' as const, nextAction: 'apply' as const }
      if (row.status === 'pending')
        return { status: 'pending' as const, nextAction: 'wait' as const }
      if (row.status === 'rejected')
        return { status: 'rejected' as const, nextAction: 'contact_community' as const }
      const invitation = await latestInvitation(tx, row.id)
      if (!invitation || invitation.status === 'completed' || invitation.issued_at > now)
        throw new Error('Join application invitation association is inconsistent')
      if (invitation.status === 'expired' || invitation.expires_at <= now)
        return { status: 'invitation_expired' as const, nextAction: 'contact_community' as const }
      if (invitation.status !== 'active')
        throw new Error('Join application invitation status is inconsistent')
      return { status: 'approved' as const, nextAction: 'register' as const }
    }, 'repeatable-read-read-only')
  }

  async download(applicationId: string, attachmentId: string) {
    const row = (
      await this.db.query<{
        original_name: string
        bytes: Buffer
        byte_length: number
        sha256: string
      }>(
        'SELECT f.original_name, f.bytes, f.byte_length, f.sha256 FROM join_application_attachments f JOIN join_applications a ON a.id=f.application_id WHERE f.application_id = $1 AND f.id = $2',
        [applicationId, attachmentId],
      )
    ).rows[0]
    if (!row) throw new AuthError('JOIN_ATTACHMENT_NOT_FOUND')
    if (
      !Buffer.isBuffer(row.bytes) ||
      row.bytes.length !== row.byte_length ||
      createHash('sha256').update(row.bytes).digest('hex') !== row.sha256
    )
      throw new Error('Join application attachment bytes are inconsistent')
    return {
      originalName: row.original_name,
      bytes: row.bytes,
      byteLength: row.byte_length,
      sha256: row.sha256,
    }
  }

  async list(query: { view?: string; limit?: string; offset?: string } = {}) {
    const view = query.view ?? 'pending',
      limitText = query.limit ?? '20',
      offsetText = query.offset ?? '0'
    if (
      !['pending', 'all'].includes(view) ||
      !/^([1-9]|[1-4][0-9]|50)$/.test(limitText) ||
      !/^(0|[1-9][0-9]{0,8})$/.test(offsetText)
    )
      throw new AuthError('BAD_REQUEST')
    const now = this.invitations.now(),
      limit = Number(limitText),
      offset = Number(offsetText)
    await this.invitations.cleanup(now)
    return this.db.transaction(async (tx) => {
      const filter = view === 'pending' ? "WHERE status = 'pending'" : ''
      const rows = (
        await tx.query<ApplicationRow>(
          `SELECT * FROM join_applications ${filter} ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        )
      ).rows
      const total = (
        await tx.query<{ n: number }>(`SELECT count(*) AS n FROM join_applications ${filter}`)
      ).rows[0]!.n
      const items = []
      for (const row of rows) items.push(await summary(tx, row, now))
      return { items, total, offset, limit, serverTime: now }
    }, 'repeatable-read-read-only')
  }
  async get(id: string) {
    const now = this.invitations.now()
    await this.invitations.cleanup(now)
    return this.db.transaction(
      async (tx) => detail(tx, await this.require(tx, id), now),
      'repeatable-read-read-only',
    )
  }

  async approve(id: string) {
    const now = this.invitations.now()
    const result = await this.db.transaction(async (tx) => {
      const row = await this.require(tx, id, true)
      if (row.status === 'approved') return { value: await detail(tx, row, now) }
      if (row.status !== 'pending') throw new AuthError('JOIN_STATE_CONFLICT')
      await detail(tx, row, now)
      if (await this.invitations.hasUser(tx, row.email)) throw new AuthError('EMAIL_IN_USE')
      await this.invitations.assertCooldown(tx, row.email, now)
      const updated = await tx.query(
        "UPDATE join_applications SET status = 'approved', reviewed_at = $1, reviewed_by_user_id = NULL WHERE id = $2 AND status = 'pending'",
        [now, id],
      )
      assertOne(updated.rowCount)
      return {
        mail: await this.invitations.issueInside(
          tx,
          { ...row, status: 'approved', reviewed_at: now },
          now,
        ),
      }
    })
    if (result.value) return result.value
    await this.invitations.dispatch(result.mail!)
    return this.db.transaction(
      async (tx) => detail(tx, await this.require(tx, id), this.invitations.now()),
      'repeatable-read-read-only',
    )
  }
  async reject(id: string) {
    const now = this.invitations.now()
    return this.db.transaction(async (tx) => {
      const row = await this.require(tx, id, true)
      if (row.status === 'rejected') return detail(tx, row, now)
      if (row.status !== 'pending') throw new AuthError('JOIN_STATE_CONFLICT')
      if (await this.invitations.hasUser(tx, row.email)) throw new AuthError('EMAIL_IN_USE')
      const updated = await tx.query(
        "UPDATE join_applications SET status = 'rejected', reviewed_at = $1, reviewed_by_user_id = NULL WHERE id = $2 AND status = 'pending'",
        [now, id],
      )
      assertOne(updated.rowCount)
      return detail(tx, { ...row, status: 'rejected', reviewed_at: now }, now)
    })
  }
  async resend(id: string) {
    const now = this.invitations.now()
    const mail = await this.db.transaction(async (tx) => {
      const row = await this.require(tx, id, true)
      const invite = await this.invitations.lockLatestInvitation(tx, id)
      if ((await this.invitations.hasUser(tx, row.email)) || invite?.status === 'completed')
        throw new AuthError('EMAIL_IN_USE')
      if (row.status !== 'approved') throw new AuthError('JOIN_STATE_CONFLICT')
      await detail(tx, row, now)
      await this.invitations.assertCooldown(tx, row.email, now)
      return this.invitations.issueInside(tx, row, now, invite)
    })
    await this.invitations.dispatch(mail)
    return this.db.transaction(
      async (tx) => detail(tx, await this.require(tx, id), this.invitations.now()),
      'repeatable-read-read-only',
    )
  }
  private async require(tx: SqlExecutor, id: string, lock = false) {
    const row = lock
      ? (
          await tx.query<ApplicationRow>(
            'SELECT * FROM join_applications WHERE id = $1 FOR UPDATE',
            [id],
          )
        ).rows[0]
      : await application(tx, id)
    if (!row) throw new AuthError('JOIN_APPLICATION_NOT_FOUND')
    return row
  }
}
