import type { AppDatabase } from '@server/src/db/client.js'
import { withSidSerial } from './sid-serial.js'
import { isIdentityClientId, parseIdentityConfig, type IdentityConfig } from './config.js'

type Target = { clientId: string; hydraSid: string; sessionId?: string; deliveryEventId?: string }
type Delivery = { eventId: string; sessionId: string }
type OutboxRow = {
  event_id: string
  kind: 'session' | 'user'
  session_id: string | null
  user_id: string
  target_bindings: string
  delivered_targets: string
  attempts: number
}

const delays = [1000, 2000, 4000, 8000, 16000, 30000]

export class IdentityOutboxWorker {
  constructor(
    private readonly db: AppDatabase,
    private readonly revokeHydraSid: (target: {
      clientId: string
      hydraSid: string
    }) => Promise<void>,
    private readonly deliverApplication: (clientId: string, message: Delivery) => Promise<void>,
    private readonly now: () => number = Date.now,
    private readonly reportError: (code: string) => void = () => undefined,
    private readonly assertTargetAvailable: (clientId: string) => void = () => undefined,
    private readonly needsApplicationDelivery: (clientId: string) => boolean = () => true,
  ) {}

  /** Returns whether a due event was claimed, including a failed retry. */
  async drainOne(): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query<OutboxRow>(
          `SELECT event_id, kind, session_id, user_id,
        target_bindings, delivered_targets, attempts FROM auth_identity_outbox
        WHERE completed_at IS NULL AND next_attempt_at <= $1
        ORDER BY created_at, event_id FOR UPDATE SKIP LOCKED LIMIT 1`,
          [this.now()],
        )
      ).rows[0]
      if (!row) return false
      const targets = JSON.parse(row.target_bindings) as Target[]
      const delivered = new Set(JSON.parse(row.delivered_targets) as string[])
      let failed = false
      for (const target of targets) {
        if (!isIdentityClientId(target.clientId)) {
          this.reportError('IDENTITY_OUTBOX_UNKNOWN_CLIENT')
          failed = true
          break
        }
        // Recheck availability even when earlier delivery keys already exist;
        // switching configuration must not complete an unconfigured target.
        try {
          this.assertTargetAvailable(target.clientId)
        } catch {
          failed = true
          break
        }
        // A legacy user event without a captured session cannot safely be
        // delivered after the account is re-enabled. Keep it pending instead
        // of broad-revoking every current application session for that user.
        if (row.kind === 'user' && (!target.sessionId || !target.deliveryEventId)) {
          this.reportError('INVALID_USER_TARGET_SNAPSHOT')
          failed = true
          break
        }
        const hydraKey = `hydra:${target.clientId}:${target.hydraSid}`
        if (!delivered.has(hydraKey)) {
          try {
            await withSidSerial(target.hydraSid, () =>
              this.revokeHydraSid({ clientId: target.clientId, hydraSid: target.hydraSid }),
            )
            delivered.add(hydraKey)
          } catch {
            this.reportError('IDENTITY_OUTBOX_HYDRA_PENDING')
            failed = true
            break
          }
        }
        if (this.needsApplicationDelivery(target.clientId)) {
          const applicationKey = `app:${target.clientId}:${target.hydraSid}`
          if (!delivered.has(applicationKey)) {
            try {
              const sessionId = row.kind === 'session' ? row.session_id : target.sessionId
              if (!sessionId) throw new Error('Outbox target session is missing')
              await this.deliverApplication(target.clientId, {
                eventId: row.kind === 'session' ? row.event_id : target.deliveryEventId!,
                sessionId,
              })
              delivered.add(applicationKey)
            } catch {
              this.reportError('IDENTITY_OUTBOX_DELIVERY_PENDING')
              failed = true
              break
            }
          }
        }
      }
      const now = this.now()
      const attempts = row.attempts + 1
      await tx.query(
        `UPDATE auth_identity_outbox SET delivered_targets = $1, attempts = $2,
        next_attempt_at = $3, completed_at = $4 WHERE event_id = $5`,
        [
          JSON.stringify([...delivered]),
          attempts,
          failed ? now + delays[Math.min(attempts - 1, delays.length - 1)]! : now,
          failed ? null : now,
          row.event_id,
        ],
      )
      return true
    })
  }
}

/** External destinations use dedicated internal URLs and one-second calls. */
export function configuredIdentityOutboxWorker(
  db: AppDatabase,
  config: IdentityConfig | Readonly<{ enabled: false }> = parseIdentityConfig(),
  now: () => number = Date.now,
  reportError: (code: string) => void = (code) => {
    console.error(`[identity-outbox] ${code}`)
  },
): IdentityOutboxWorker {
  if (!config.enabled) throw new Error('IDENTITY_OUTBOX_DISABLED')
  const destination = (clientId: string) => {
    const target = Object.hasOwn(config.deliveryTargets, clientId)
      ? config.deliveryTargets[clientId]
      : undefined
    if (!target) {
      reportError('IDENTITY_OUTBOX_TARGET_MISSING')
      throw new Error('IDENTITY_OUTBOX_TARGET_MISSING')
    }
    return target
  }
  return new IdentityOutboxWorker(
    db,
    async ({ clientId, hydraSid }) => {
      const target = destination(clientId)
      const url = new URL('/admin/oauth2/auth/sessions/login', target.hydraAdminUrl)
      url.searchParams.set('sid', hydraSid)
      const response = await fetch(url, {
        method: 'DELETE',
        redirect: 'error',
        signal: AbortSignal.timeout(1000),
      })
      if (!response.ok && response.status !== 404) throw new Error('Hydra sid revocation failed')
    },
    async (clientId, message) => {
      const target = destination(clientId)
      if (!target.revocation) throw new Error('IDENTITY_OUTBOX_TARGET_MISSING')
      const response = await fetch(new URL(target.revocation.url), {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'X-Identity-Delivery-Key': target.revocation.key,
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(1000),
      })
      if (!response.ok) throw new Error('Application revocation delivery failed')
      await response.json()
    },
    now,
    reportError,
    (clientId) => {
      destination(clientId)
    },
    (clientId) => Boolean(destination(clientId).revocation),
  )
}

export function startIdentityOutboxWorker(worker: IdentityOutboxWorker): () => void {
  let busy = false
  const run = async () => {
    if (busy) return
    busy = true
    try {
      while (await worker.drainOne()) {
        /* claim all due work */
      }
    } catch {
      /* durable rows remain due; retry on next tick */
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void run(), 500)
  void run()
  return () => clearInterval(timer)
}
