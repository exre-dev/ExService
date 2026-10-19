import type { AppDatabase } from '@server/src/db/client'
import type { ProfileService } from '@server/src/modules/profile/service'
import { createClickUpServices } from '@server/src/modules/clickup/factory'
import { createSupportServices } from '@server/src/domains/support/service'
/** Explicit unavailable dependency for unrelated app tests; no network or worker. */
export function unavailableSupport(db: AppDatabase, profile: Pick<ProfileService, 'snapshot'>) {
  const clickupServices = createClickUpServices({ kind: 'disabled' })
  return {
    clickupServices,
    supportServices: createSupportServices({ db, clickup: clickupServices, profile }),
  }
}
