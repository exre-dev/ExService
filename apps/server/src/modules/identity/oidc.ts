import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { AuthError } from '@server/src/modules/auth/errors.js'
import type { AuthService, SessionIdentity } from '@server/src/modules/auth/service.js'
import type { AppDatabase } from '@server/src/db/client.js'
import { withSidSerial } from './sid-serial.js'

type HydraClient = { client_id: string; client_name?: string; redirect_uris?: string[] }
type HydraRequest = { client?: HydraClient; requested_scope?: string[]; request_url?: string }
export type HydraLoginRequest = HydraRequest & {
  challenge: string
  session_id?: string
  skip: boolean
  subject: string
}
export type HydraConsentRequest = HydraRequest & {
  challenge: string
  login_challenge?: string
  login_session_id?: string
  subject?: string
}
export type HydraLogoutRequest = { sid?: string; subject?: string; client?: HydraClient }
type HydraRedirect = { redirect_to: string }

function assertChallenge(value: string): void {
  if (typeof value !== 'string' || value.length < 1 || value.length > 8192 || /\s/.test(value)) {
    throw new AuthError('IDENTITY_CHALLENGE_INVALID')
  }
}

export interface HydraAdmin {
  getLogin(challenge: string): Promise<HydraLoginRequest>
  acceptLogin(challenge: string, body: { subject: string; remember: false }): Promise<HydraRedirect>
  getConsent(challenge: string): Promise<HydraConsentRequest>
  acceptConsent(
    challenge: string,
    body: {
      grant_scope: string[]
      remember: false
      session: { id_token: Record<string, unknown> }
    },
  ): Promise<HydraRedirect>
  getLogout(challenge: string): Promise<HydraLogoutRequest>
  acceptLogout(challenge: string): Promise<HydraRedirect>
}

export class HttpHydraAdmin implements HydraAdmin {
  private readonly baseUrl: URL
  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl)
    if (
      !['http:', 'https:'].includes(this.baseUrl.protocol) ||
      this.baseUrl.username ||
      this.baseUrl.password ||
      this.baseUrl.search ||
      this.baseUrl.hash ||
      this.baseUrl.pathname !== '/'
    ) {
      throw new Error('HYDRA_ADMIN_URL must be a root HTTP(S) URL')
    }
  }

  private async call<T>(
    method: 'GET' | 'PUT',
    path: string,
    challengeName: string,
    challenge: string,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    url.searchParams.set(challengeName, challenge)
    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(1000),
      })
    } catch {
      throw new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    }
    if (response.status === 404 || response.status === 410)
      throw new AuthError('IDENTITY_CHALLENGE_INVALID')
    if (!response.ok) throw new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    try {
      return (await response.json()) as T
    } catch {
      throw new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    }
  }

  getLogin(challenge: string) {
    return this.call<HydraLoginRequest>(
      'GET',
      '/admin/oauth2/auth/requests/login',
      'login_challenge',
      challenge,
    )
  }
  acceptLogin(challenge: string, body: { subject: string; remember: false }) {
    return this.call<HydraRedirect>(
      'PUT',
      '/admin/oauth2/auth/requests/login/accept',
      'login_challenge',
      challenge,
      body,
    )
  }
  getConsent(challenge: string) {
    return this.call<HydraConsentRequest>(
      'GET',
      '/admin/oauth2/auth/requests/consent',
      'consent_challenge',
      challenge,
    )
  }
  acceptConsent(
    challenge: string,
    body: {
      grant_scope: string[]
      remember: false
      session: { id_token: Record<string, unknown> }
    },
  ) {
    return this.call<HydraRedirect>(
      'PUT',
      '/admin/oauth2/auth/requests/consent/accept',
      'consent_challenge',
      challenge,
      body,
    )
  }
  getLogout(challenge: string) {
    return this.call<HydraLogoutRequest>(
      'GET',
      '/admin/oauth2/auth/requests/logout',
      'logout_challenge',
      challenge,
    )
  }
  acceptLogout(challenge: string) {
    return this.call<HydraRedirect>(
      'PUT',
      '/admin/oauth2/auth/requests/logout/accept',
      'logout_challenge',
      challenge,
    )
  }
}

interface OidcClientConfig {
  readonly name: string
  readonly redirectUri: string
  readonly scopes: readonly string[]
}
interface FlowRow {
  session_id: string
  client_id: string
  hydra_sid: string | null
  state: string
  expires_at: number
  encrypted_redirect: string | null
}

export class OidcService {
  private readonly now: () => number
  private readonly issuer: URL
  constructor(
    private readonly options: {
      db: AppDatabase
      authServices: AuthService
      admin: HydraAdmin
      flowKey: Buffer
      issuer: string
      clients: Readonly<Record<string, OidcClientConfig>>
      now?: () => number
    },
  ) {
    if (options.flowKey.length !== 32) throw new Error('IDENTITY_FLOW_KEY must be 32 bytes')
    this.now = options.now ?? Date.now
    this.issuer = new URL(options.issuer)
    if (this.issuer.pathname !== '/' || this.issuer.search || this.issuer.hash)
      throw new Error('Invalid Hydra issuer')
  }

  async inspect(phase: 'login' | 'consent', challenge: string) {
    assertChallenge(challenge)
    const request =
      phase === 'login'
        ? await this.options.admin.getLogin(challenge)
        : await this.options.admin.getConsent(challenge)
    const { config, scopes } = this.approved(request)
    return { clientName: config.name, scopes }
  }

  async acceptLogin(challenge: string, session: SessionIdentity) {
    assertChallenge(challenge)
    const request = await this.options.admin.getLogin(challenge)
    const { clientId } = this.approved(request)
    if (request.skip && request.subject && request.subject !== session.userId)
      throw new AuthError('IDENTITY_RESTART_REQUIRED')
    const sid = request.session_id
    if (!sid || sid.length > 255) throw new AuthError('IDENTITY_CHALLENGE_INVALID')
    const existing = await this.startFlow('login', challenge, session, clientId, sid)
    if (existing) return existing
    try {
      const redirect = await this.options.admin.acceptLogin(challenge, {
        subject: session.userId,
        remember: false,
      })
      return await this.completeFlow('login', challenge, redirect)
    } catch (error) {
      await this.restartFlow('login', challenge)
      throw error instanceof AuthError ? error : new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    }
  }

  async acceptConsent(challenge: string, session: SessionIdentity) {
    assertChallenge(challenge)
    const request = await this.options.admin.getConsent(challenge)
    const { clientId, scopes } = this.approved(request)
    const sid = request.login_session_id
    if (
      !sid ||
      sid.length > 255 ||
      !request.login_challenge ||
      request.subject !== session.userId
    ) {
      throw new AuthError('IDENTITY_CHALLENGE_INVALID')
    }
    assertChallenge(request.login_challenge)
    // Hydra v2.3 exposes an internal login request ID in consent.login_challenge,
    // while the browser received a distinct signed challenge. Correlate the
    // completed Website login through the Hydra login session and local actor.
    const loginFlow = (
      await this.options.db.query<{ phase: string }>(
        `SELECT phase FROM auth_oidc_flows
      WHERE phase = 'login' AND session_id = $1 AND client_id = $2 AND hydra_sid = $3
        AND state = 'completed' AND expires_at > $4 LIMIT 1`,
        [session.id, clientId, sid, this.now()],
      )
    ).rows[0]
    if (!loginFlow) {
      throw new AuthError('IDENTITY_RESTART_REQUIRED')
    }
    const existing = await this.startFlow('consent', challenge, session, clientId, sid)
    if (existing) return existing
    try {
      await this.options.db.transaction(async (tx) => {
        await this.options.authServices.assertSessionCurrent(session, tx, true)
        const collision = await tx.query<{
          session_id: string
          user_id: string
          revoked_at: number | null
        }>(
          'SELECT session_id, user_id, revoked_at FROM auth_oidc_bindings WHERE client_id = $1 AND hydra_sid = $2',
          [clientId, sid],
        )
        if (
          collision.rows[0] &&
          (collision.rows[0].session_id !== session.id ||
            collision.rows[0].user_id !== session.userId ||
            collision.rows[0].revoked_at !== null)
        ) {
          throw new AuthError('IDENTITY_RESTART_REQUIRED')
        }
        if (!collision.rows[0])
          await tx.query(
            `INSERT INTO auth_oidc_bindings
          (client_id, hydra_sid, session_id, user_id, created_at) VALUES ($1, $2, $3, $4, $5)`,
            [clientId, sid, session.id, session.userId, this.now()],
          )
      })
      const profile = await this.options.authServices.inspectIdentityUser(session.userId)
      if (!profile) throw new AuthError('SESSION_INVALID')
      const redirect = await this.options.admin.acceptConsent(challenge, {
        grant_scope: scopes,
        remember: false,
        session: {
          id_token: {
            nickname: profile.nickname,
            name: profile.nickname,
            email: profile.email,
            picture: profile.avatarUrl,
            profile_version: profile.profileVersion,
            ex_session_id: session.id,
          },
        },
      })
      return await this.completeFlow('consent', challenge, redirect)
    } catch (error) {
      await this.restartFlow('consent', challenge)
      throw error instanceof AuthError ? error : new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    }
  }

  async acceptLogout(challenge: string, session: SessionIdentity) {
    assertChallenge(challenge)
    const request = await this.options.admin.getLogout(challenge)
    const sid = request.sid
    if (!sid || request.subject !== session.userId || !request.client)
      throw new AuthError('IDENTITY_CHALLENGE_INVALID')
    const clientId = request.client.client_id
    const config = this.options.clients[clientId]
    if (!config || !request.client.redirect_uris?.includes(config.redirectUri)) {
      throw new AuthError('IDENTITY_CLIENT_FORBIDDEN')
    }
    return withSidSerial(sid, async () => {
      const linked = await this.options.authServices.checkLinkedSession(
        clientId,
        sid,
        session.userId,
      )
      if (!linked.active || linked.sessionId !== session.id) throw new AuthError('SESSION_INVALID')
      await this.options.authServices.logout(session)
      const redirect = await this.options.admin.acceptLogout(challenge)
      return this.validRedirect(redirect)
    })
  }

  private approved(request: HydraRequest) {
    const clientId = request.client?.client_id
    const config =
      clientId && Object.hasOwn(this.options.clients, clientId) && this.options.clients[clientId]
    if (!config || !request.client?.redirect_uris?.includes(config.redirectUri)) {
      throw new AuthError('IDENTITY_CLIENT_FORBIDDEN')
    }
    const scopes = request.requested_scope
    if (
      !scopes ||
      !scopes.includes('openid') ||
      scopes.some((scope) => !config.scopes.includes(scope))
    ) {
      throw new AuthError('IDENTITY_CLIENT_FORBIDDEN')
    }
    let requestedRedirect: string | null = null
    try {
      requestedRedirect = new URL(request.request_url ?? '').searchParams.get('redirect_uri')
    } catch {
      /* reject below */
    }
    if (requestedRedirect !== config.redirectUri) throw new AuthError('IDENTITY_CLIENT_FORBIDDEN')
    return { clientId, config, scopes }
  }

  private async startFlow(
    phase: string,
    challenge: string,
    session: SessionIdentity,
    clientId: string,
    sid: string,
  ): Promise<{ redirectUrl: string } | undefined> {
    await this.options.authServices.assertSessionCurrent(session)
    const challengeHash = digest(challenge)
    const existing = await this.readFlow(phase, challenge)
    if (existing) {
      if (
        existing.session_id !== session.id ||
        existing.client_id !== clientId ||
        existing.hydra_sid !== sid ||
        existing.expires_at <= this.now() ||
        existing.state !== 'completed' ||
        !existing.encrypted_redirect
      ) {
        throw new AuthError('IDENTITY_RESTART_REQUIRED')
      }
      return { redirectUrl: this.decrypt(existing.encrypted_redirect) }
    }
    const expiresAt = Math.min(this.now() + 10 * 60 * 1000, session.expiresAt)
    await this.options.db.transaction(async (tx) => {
      await this.options.authServices.assertSessionCurrent(session, tx, true)
      const inserted = await tx.query(
        `INSERT INTO auth_oidc_flows
        (phase, challenge_hash, session_id, client_id, hydra_sid, state, expires_at)
        VALUES ($1, $2, $3, $4, $5, 'processing', $6) ON CONFLICT DO NOTHING`,
        [phase, challengeHash, session.id, clientId, sid, expiresAt],
      )
      if (inserted.rowCount !== 1) throw new AuthError('IDENTITY_RESTART_REQUIRED')
    })
    return undefined
  }

  private async readFlow(phase: string, challenge: string) {
    return (
      await this.options.db.query<FlowRow>(
        'SELECT session_id, client_id, hydra_sid, state, expires_at, encrypted_redirect FROM auth_oidc_flows WHERE phase = $1 AND challenge_hash = $2',
        [phase, digest(challenge)],
      )
    ).rows[0]
  }
  private async completeFlow(phase: string, challenge: string, redirect: HydraRedirect) {
    const result = this.validRedirect(redirect)
    const encrypted = this.encrypt(result.redirectUrl)
    const updated = await this.options.db.query(
      `UPDATE auth_oidc_flows SET state = 'completed', encrypted_redirect = $1
      WHERE phase = $2 AND challenge_hash = $3 AND state = 'processing'`,
      [encrypted, phase, digest(challenge)],
    )
    if (updated.rowCount !== 1) throw new AuthError('IDENTITY_RESTART_REQUIRED')
    return result
  }
  private async restartFlow(phase: string, challenge: string) {
    await this.options.db.query(
      `UPDATE auth_oidc_flows SET state = 'restart_required'
      WHERE phase = $1 AND challenge_hash = $2 AND state = 'processing'`,
      [phase, digest(challenge)],
    )
  }
  private validRedirect(redirect: HydraRedirect) {
    let url: URL
    try {
      url = new URL(redirect.redirect_to)
    } catch {
      throw new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    }
    if (url.origin !== this.issuer.origin || !url.pathname.startsWith('/oauth2/')) {
      throw new AuthError('IDENTITY_UPSTREAM_UNAVAILABLE')
    }
    return { redirectUrl: url.toString() }
  }
  private encrypt(value: string) {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.options.flowKey, nonce)
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64url')
  }
  private decrypt(value: string) {
    try {
      const bytes = Buffer.from(value, 'base64url')
      const decipher = createDecipheriv('aes-256-gcm', this.options.flowKey, bytes.subarray(0, 12))
      decipher.setAuthTag(bytes.subarray(12, 28))
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
    } catch {
      throw new AuthError('IDENTITY_RESTART_REQUIRED')
    }
  }
}

function digest(challenge: string): string {
  return createHash('sha256').update(challenge).digest('hex')
}
