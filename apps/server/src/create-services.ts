import type { AppDatabase } from '@server/src/db/client.js'
import { ScryptPasswordHasher } from '@server/src/modules/auth/crypto.js'
import { AuthService } from '@server/src/modules/auth/service.js'
import { InvitationService } from '@server/src/domains/join/invitations/service.js'
import { JoinService } from '@server/src/domains/join/applications/service.js'

/** Pure production assembly: no database open, startup checks, migrations or writes. */
export function createAuthServices(options: {
  db: AppDatabase
  codeHmacKey: Buffer
  publicWebBaseUrl?: string
  publicAvatarBaseUrl?: string
}) {
  const passwordHasher = new ScryptPasswordHasher()
  const authServices = new AuthService({
    db: options.db,
    passwordHasher,
    publicAvatarBaseUrl: options.publicAvatarBaseUrl,
  })
  const invitationServices = new InvitationService({
    ...options,
    passwordHasher,
  })
  const joinServices = new JoinService(invitationServices)
  return { authServices, invitationServices, joinServices }
}
