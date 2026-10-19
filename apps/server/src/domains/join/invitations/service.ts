import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { AuthError } from '@server/src/modules/auth/errors.js'
import {
  ScryptPasswordHasher,
  secureRandom,
  type PasswordHasher,
} from '@server/src/modules/auth/crypto.js'
import type { AppDatabase, SqlExecutor } from '@server/src/db/client.js'
import { JoinRateLimiter } from '@server/src/domains/join/applications/rate-limiter.js'
import {
  application,
  control,
  type ApplicationRow,
  type ControlRow,
  type InvitationRow,
} from '@server/src/domains/join/applications/records.js'
import {
  publicWebBaseUrl,
  terminalInvitationMailer,
  type InvitationMail,
  type InvitationMailer,
} from '@server/src/domains/join/invitations/mail.js'

const DAY = 86_400_000
const CODE_MS = 600_000
const GRANT_MS = 1_800_000
const COOLDOWN_MS = 60_000
const DELIVERY_MS = 10_000
export interface InvitationServiceDependencies {
  db: AppDatabase
  codeHmacKey: Buffer
  passwordHasher?: PasswordHasher
  now?: () => number
  randomBytes?: (length: number) => Buffer
  randomInteger?: (maximum: number) => number
  createUserId?: () => string
  createId?: () => string
  deliverInvitation?: InvitationMailer
  publicWebBaseUrl?: string
  rateLimiter?: JoinRateLimiter
}
function assertOne(rowCount: number | null) {
  if (rowCount !== 1) throw new Error('Invitation state update did not affect exactly one row')
}
export class InvitationService {
  readonly db: AppDatabase
  readonly now: () => number
  private readonly key: Buffer
  private readonly hasher: PasswordHasher
  private readonly bytes: (length: number) => Buffer
  private readonly integer: (maximum: number) => number
  private readonly userId: () => string
  private readonly id: () => string
  private readonly deliver: InvitationMailer
  private readonly baseUrl: string
  private readonly limiter: JoinRateLimiter
  constructor(deps: InvitationServiceDependencies) {
    this.db = deps.db
    this.now = deps.now ?? Date.now
    this.key = deps.codeHmacKey
    this.hasher = deps.passwordHasher ?? new ScryptPasswordHasher()
    this.bytes = deps.randomBytes ?? secureRandom.bytes
    this.integer = deps.randomInteger ?? secureRandom.integer
    this.userId = deps.createUserId ?? randomUUID
    this.id = deps.createId ?? randomUUID
    this.deliver = deps.deliverInvitation ?? terminalInvitationMailer
    this.baseUrl = publicWebBaseUrl(deps.publicWebBaseUrl)
    this.limiter = deps.rateLimiter ?? new JoinRateLimiter(this.now)
  }
  limit(ip: string) {
    const retryAfterSeconds = this.limiter.check(ip)
    if (retryAfterSeconds !== undefined)
      throw new AuthError('JOIN_RATE_LIMITED', { retryAfterSeconds })
  }
  async checkEligibility(emailInput: string) {
    const email = normalizeEmail(emailInput),
      now = this.now()
    return this.db.transaction(async (tx) => {
      if (
        !(await tx.query('SELECT 1 FROM join_applications WHERE email = $1', [email])).rows.length
      )
        throw new AuthError('INVITATION_APPLICATION_NOT_FOUND')
      if (!(await this.eligible(tx, email, now))) throw new AuthError('INVITATION_NOT_ELIGIBLE')
      return {
        status: 'eligible' as const,
        email,
        serverTime: now,
        resendAvailableAt: Math.max(now, (await control(tx, email))?.next_send_at ?? now),
      }
    }, 'repeatable-read-read-only')
  }
  async requestCode(emailInput: string) {
    const email = normalizeEmail(emailInput),
      now = this.now()
    await this.cleanup(now)
    const mail = await this.db.transaction(async (tx) => {
      const locked = await this.lockEligible(tx, email, now)
      if (!locked || (await this.hasUser(tx, email))) return undefined
      const { app, invite } = locked
      const state = await this.lockControl(tx, email)
      if (state.next_send_at > now) return undefined
      return this.issueInside(tx, app, now, invite)
    })
    if (mail) await this.dispatch(mail)
    return { status: 'accepted' as const, serverTime: now, resendAvailableAt: now + COOLDOWN_MS }
  }
  async verifyCode(emailInput: string, code: string) {
    const email = normalizeEmail(emailInput),
      now = this.now()
    if (!/^[0-9]{6}$/.test(code)) throw new AuthError('BAD_REQUEST')
    await this.cleanup(now)
    const result = await this.db.transaction(async (tx) => {
      const locked = await this.lockEligible(tx, email, now)
      let state = await this.lockControl(tx, email)
      if (
        state.failure_window_started_at !== null &&
        now >= state.failure_window_started_at + CODE_MS
      ) {
        assertOne(
          (
            await tx.query(
              'UPDATE join_email_controls SET failed_attempts = 0, failure_window_started_at = NULL WHERE email = $1',
              [email],
            )
          ).rowCount,
        )
        state = { ...state, failed_attempts: 0, failure_window_started_at: null }
      }
      if (state.failed_attempts >= 5 && state.failure_window_started_at !== null)
        return { error: this.locked(state.failure_window_started_at, now) }
      if (!locked || (await this.hasUser(tx, email)))
        return { error: await this.recordFailure(tx, state, now) }
      const { app, invite } = locked
      if (
        invite.code_digest === null ||
        invite.code_expires_at === null ||
        now >= invite.code_expires_at
      )
        return { error: new AuthError('INVITATION_CODE_INVALID') }
      if (!equalDigest(invite.code_digest, this.digestCode(invite.id, invite.code_version, code)))
        return { error: await this.recordFailure(tx, state, now) }
      const token = this.bytes(32).toString('base64url'),
        expires = Math.min(now + GRANT_MS, invite.expires_at)
      assertOne(
        (
          await tx.query(
            `UPDATE join_invitations SET code_digest = NULL, code_expires_at = NULL,
        completion_token_hash = $1, completion_expires_at = $2 WHERE id = $3 AND status = 'active'`,
            [digest(token), expires, invite.id],
          )
        ).rowCount,
      )
      return {
        value: {
          status: 'verified' as const,
          completionToken: token,
          email,
          nickname: app.nickname,
          serverTime: now,
          completionExpiresAt: expires,
        },
      }
    })
    if (result.error) throw result.error
    return result.value!
  }
  async complete(input: { completionToken: string; nickname: string; password: string }) {
    const nickname = normalizeNickname(input.nickname)
    if (
      Array.from(input.password).length < 8 ||
      Array.from(input.password).length > 64 ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.completionToken)
    )
      throw new AuthError('BAD_REQUEST')
    await this.cleanup(this.now())
    const hash = digest(input.completionToken)
    const preflight = await this.db.transaction(
      (tx) => this.inspectGrant(tx, hash, this.now()),
      'repeatable-read-read-only',
    )
    if (preflight.invite.status === 'completed')
      return { status: 'registered' as const, email: preflight.app.email }
    const passwordHash = await this.hasher.hash(input.password)
    try {
      return await this.db.transaction(async (tx) => {
        // Locate without locking, then lock in application -> invitation order.
        const located = (
          await tx.query<InvitationRow>(
            'SELECT * FROM join_invitations WHERE completion_token_hash = $1',
            [hash],
          )
        ).rows[0]
        if (!located) throw new AuthError('COMPLETION_GRANT_INVALID')
        const app = (
          await tx.query<ApplicationRow>(
            'SELECT * FROM join_applications WHERE id = $1 FOR UPDATE',
            [located.application_id],
          )
        ).rows[0]
        const invite = (
          await tx.query<InvitationRow>('SELECT * FROM join_invitations WHERE id = $1 FOR UPDATE', [
            located.id,
          ])
        ).rows[0]
        const inspected = await this.inspectGrant(tx, hash, this.now(), app, invite)
        if (inspected.invite.status === 'completed')
          return { status: 'registered' as const, email: inspected.app.email }
        if (await this.hasUser(tx, inspected.app.email)) throw new AuthError('EMAIL_IN_USE')
        const userId = this.userId(),
          now = this.now()
        await tx.query(
          `INSERT INTO auth_users (id, email, nickname, password_hash, created_at, qq, fivem_id, avatar_key)
          VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL)`,
          [userId, inspected.app.email, nickname, passwordHash, now, inspected.app.qq],
        )
        assertOne(
          (
            await tx.query(
              `UPDATE join_invitations SET status = 'completed', completed_user_id = $1, completed_at = $2,
          code_digest = NULL, code_expires_at = NULL WHERE id = $3 AND status = 'active'`,
              [userId, now, inspected.invite.id],
            )
          ).rowCount,
        )
        return { status: 'registered' as const, email: inspected.app.email }
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string; constraint?: string }).code === '23505' &&
        (error as { constraint?: string }).constraint === 'auth_users_email_unique'
      )
        throw new AuthError('EMAIL_IN_USE')
      throw error
    }
  }
  private async inspectGrant(
    tx: SqlExecutor,
    hash: string,
    now: number,
    app?: ApplicationRow,
    invite?: InvitationRow,
  ) {
    invite ??= (
      await tx.query<InvitationRow>(
        'SELECT * FROM join_invitations WHERE completion_token_hash = $1',
        [hash],
      )
    ).rows[0]
    if (
      !invite ||
      invite.completion_token_hash !== hash ||
      invite.completion_expires_at === null ||
      now >= invite.completion_expires_at ||
      now < invite.issued_at ||
      now >= invite.expires_at
    )
      throw new AuthError('COMPLETION_GRANT_INVALID')
    app ??= await application(tx, invite.application_id)
    if (
      !app ||
      app.status !== 'approved' ||
      (invite.status !== 'active' && invite.status !== 'completed')
    )
      throw new AuthError('COMPLETION_GRANT_INVALID')
    if (invite.status !== 'completed' && (await this.hasUser(tx, app.email)))
      throw new AuthError('EMAIL_IN_USE')
    return { invite, app }
  }
  async hasUser(tx: SqlExecutor, email: string) {
    return (await tx.query('SELECT 1 FROM auth_users WHERE email = $1', [email])).rows.length !== 0
  }
  async eligible(tx: SqlExecutor, email: string, now: number) {
    if (await this.hasUser(tx, email)) return undefined
    return (
      await tx.query<InvitationRow>(
        `SELECT i.* FROM join_invitations i JOIN join_applications a ON a.id = i.application_id
      WHERE a.email = $1 AND a.status = 'approved' AND i.status = 'active' AND i.issued_at <= $2 AND i.expires_at > $2
      AND i.completed_at IS NULL LIMIT 1`,
        [email, now],
      )
    ).rows[0]
  }
  private isEligible(app: ApplicationRow, invite: InvitationRow, now: number) {
    return (
      app.status === 'approved' &&
      invite.status === 'active' &&
      invite.issued_at <= now &&
      invite.expires_at > now &&
      invite.completed_at === null
    )
  }
  private async lockEligible(tx: SqlExecutor, email: string, now: number) {
    const located = (
      await tx.query<{ application_id: string; invitation_id: string }>(
        `SELECT i.application_id, i.id AS invitation_id FROM join_invitations i
      JOIN join_applications a ON a.id = i.application_id WHERE a.email = $1 AND a.status = 'approved'
      AND i.status = 'active' AND i.issued_at <= $2 AND i.expires_at > $2 AND i.completed_at IS NULL
      ORDER BY i.issued_at DESC, i.id DESC LIMIT 1`,
        [email, now],
      )
    ).rows[0]
    if (!located) return undefined
    const app = (
      await tx.query<ApplicationRow>('SELECT * FROM join_applications WHERE id = $1 FOR UPDATE', [
        located.application_id,
      ])
    ).rows[0]
    const invite = (
      await tx.query<InvitationRow>('SELECT * FROM join_invitations WHERE id = $1 FOR UPDATE', [
        located.invitation_id,
      ])
    ).rows[0]
    if (!app || !invite || !this.isEligible(app, invite, now)) return undefined
    return { app, invite }
  }
  async lockLatestInvitation(tx: SqlExecutor, applicationId: string) {
    return (
      await tx.query<InvitationRow>(
        'SELECT * FROM join_invitations WHERE application_id = $1 ORDER BY issued_at DESC, id DESC LIMIT 1 FOR UPDATE',
        [applicationId],
      )
    ).rows[0]
  }
  private async lockControl(tx: SqlExecutor, email: string) {
    await tx.query(
      'INSERT INTO join_email_controls (email, next_send_at, failed_attempts) VALUES ($1, 0, 0) ON CONFLICT (email) DO NOTHING',
      [email],
    )
    const state = (
      await tx.query<ControlRow>('SELECT * FROM join_email_controls WHERE email = $1 FOR UPDATE', [
        email,
      ])
    ).rows[0]
    if (!state) throw new Error('Join email control was not created')
    return state
  }
  async assertCooldown(tx: SqlExecutor, email: string, now: number) {
    const next = (await this.lockControl(tx, email)).next_send_at
    if (next > now)
      throw new AuthError('CODE_RESEND_TOO_SOON', {
        retryAfterSeconds: Math.max(1, Math.ceil((next - now) / 1000)),
      })
  }
  /** Called with a transaction client after application and invitation locks. Delivery follows commit. */
  async issueInside(
    tx: SqlExecutor,
    app: ApplicationRow,
    now: number,
    previous?: InvitationRow,
  ): Promise<InvitationMail> {
    await this.assertCooldown(tx, app.email, now)
    let invite = previous
    if (invite && (invite.status !== 'active' || now >= invite.expires_at)) {
      if (invite.status === 'completed') throw new AuthError('EMAIL_IN_USE')
      assertOne(
        (
          await tx.query(
            `UPDATE join_invitations SET status = 'expired', code_digest = NULL, code_expires_at = NULL,
        completion_token_hash = NULL, completion_expires_at = NULL WHERE id = $1 AND status <> 'completed'`,
            [invite.id],
          )
        ).rowCount,
      )
      invite = undefined
    }
    const id = invite?.id ?? this.id(),
      version = invite ? invite.code_version + 1 : 1
    let code: string | undefined
    for (let n = 0; n < 8; n++) {
      const candidate = this.integer(1_000_000).toString().padStart(6, '0')
      if (
        !invite?.code_digest ||
        invite.code_expires_at === null ||
        now >= invite.code_expires_at ||
        !equalDigest(invite.code_digest, this.digestCode(id, invite.code_version, candidate))
      ) {
        code = candidate
        break
      }
    }
    if (code === undefined)
      throw new Error('random source repeatedly produced the previous verification code')
    const expires = invite?.expires_at ?? now + 7 * DAY,
      codeExpires = Math.min(now + CODE_MS, expires)
    if (!invite)
      await tx.query(
        `INSERT INTO join_invitations (id, application_id, status, issued_at, expires_at, code_version, code_digest, code_expires_at)
      VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)`,
        [id, app.id, now, expires, version, this.digestCode(id, version, code), codeExpires],
      )
    else
      assertOne(
        (
          await tx.query(
            "UPDATE join_invitations SET code_version = $1, code_digest = $2, code_expires_at = $3 WHERE id = $4 AND status = 'active'",
            [version, this.digestCode(id, version, code), codeExpires, id],
          )
        ).rowCount,
      )
    assertOne(
      (
        await tx.query('UPDATE join_email_controls SET next_send_at = $1 WHERE email = $2', [
          now + COOLDOWN_MS,
          app.email,
        ])
      ).rowCount,
    )
    const attemptId = this.id()
    await tx.query(
      `INSERT INTO join_delivery_attempts (id, invitation_id, code_version, started_at, status)
      VALUES ($1, $2, $3, $4, 'pending')`,
      [attemptId, id, version, now],
    )
    const url = new URL('/register', this.baseUrl)
    url.searchParams.set('email', app.email)
    url.searchParams.set('code', code)
    return {
      email: app.email,
      code,
      registrationUrl: url.toString(),
      invitationExpiresAt: expires,
      codeExpiresAt: codeExpires,
      attemptId,
    }
  }
  async dispatch(mail: InvitationMail) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const outcome = await Promise.race([
      Promise.resolve()
        .then(() => this.deliver(mail))
        .then(
          () => 'sent' as const,
          () => 'failed' as const,
        ),
      new Promise<'failed'>((resolve) => {
        timer = setTimeout(() => resolve('failed'), DELIVERY_MS)
      }),
    ])
    clearTimeout(timer)
    await this.db.query(
      `UPDATE join_delivery_attempts SET status = $1, finished_at = $2 WHERE id = $3 AND status = 'pending'`,
      [outcome, this.now(), mail.attemptId],
    )
  }
  async cleanup(now: number) {
    await this.db.query(
      `UPDATE join_invitations SET status = 'expired', code_digest = NULL, code_expires_at = NULL,
      completion_token_hash = NULL, completion_expires_at = NULL WHERE id IN
      (SELECT id FROM join_invitations WHERE status = 'active' AND expires_at <= $1 LIMIT 25 FOR UPDATE SKIP LOCKED)`,
      [now],
    )
    await this.db.query(
      `UPDATE join_invitations SET code_digest = NULL, code_expires_at = NULL WHERE id IN
      (SELECT id FROM join_invitations WHERE code_expires_at <= $1 LIMIT 25 FOR UPDATE SKIP LOCKED)`,
      [now],
    )
    await this.db.query(
      `UPDATE join_invitations SET completion_token_hash = NULL, completion_expires_at = NULL WHERE id IN
      (SELECT id FROM join_invitations WHERE completion_expires_at <= $1 LIMIT 25 FOR UPDATE SKIP LOCKED)`,
      [now],
    )
    await this.db.query(
      `UPDATE join_delivery_attempts SET status = 'failed', finished_at = $1 WHERE id IN
      (SELECT id FROM join_delivery_attempts WHERE status = 'pending' AND started_at + $2 <= $1 LIMIT 25 FOR UPDATE SKIP LOCKED)`,
      [now, DELIVERY_MS],
    )
    await this.db.query(
      `DELETE FROM join_email_controls WHERE email IN (SELECT c.email FROM join_email_controls c
      WHERE next_send_at <= $1 AND (failure_window_started_at IS NULL OR failure_window_started_at + $2 <= $1)
      AND NOT EXISTS (SELECT 1 FROM join_invitations i JOIN join_applications a ON a.id = i.application_id
        WHERE a.email = c.email AND i.status = 'active' AND i.issued_at <= $1 AND i.expires_at > $1)
      LIMIT 25 FOR UPDATE OF c SKIP LOCKED)`,
      [now, CODE_MS],
    )
  }
  private digestCode(id: string, version: number, code: string) {
    return createHmac('sha256', this.key).update(`${id}:${version}:${code}`).digest('hex')
  }
  private locked(startedAt: number, now: number) {
    return new AuthError('INVITATION_CODE_LOCKED', {
      retryAfterSeconds: Math.max(1, Math.ceil((startedAt + CODE_MS - now) / 1000)),
    })
  }
  private async recordFailure(tx: SqlExecutor, state: ControlRow, now: number) {
    const startedAt = state.failure_window_started_at ?? now,
      attempts = Math.min(5, state.failed_attempts + 1)
    assertOne(
      (
        await tx.query(
          `UPDATE join_email_controls SET failure_window_started_at = $1, failed_attempts = $2 WHERE email = $3`,
          [startedAt, attempts, state.email],
        )
      ).rowCount,
    )
    return attempts >= 5 ? this.locked(startedAt, now) : new AuthError('INVITATION_CODE_INVALID')
  }
}
export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (Array.from(email).length > 254) throw new AuthError('BAD_REQUEST')
  return email
}
export function normalizeNickname(value: string) {
  const name = value.trim()
  if (
    Array.from(name).length < 1 ||
    Array.from(name).length > 32 ||
    /[\u0000-\u001F\u007F-\u009F]/.test(name)
  )
    throw new AuthError('BAD_REQUEST')
  return name
}
function digest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
function equalDigest(left: string, right: string) {
  const a = Buffer.from(left, 'hex'),
    b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
