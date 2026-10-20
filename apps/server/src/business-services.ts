import type { AuthService } from './modules/auth/service.js'
import type { ProfileService } from './modules/profile/service.js'
import type { JoinService } from './domains/join/applications/service.js'
import type { InvitationService } from './domains/join/invitations/service.js'
import type { OidcService } from './modules/identity/oidc.js'
import type { StorageServices } from './modules/storage/factory.js'
import type { NotificationModule } from './modules/notifications/factory.js'
import type { ClickUpServices } from './modules/clickup/service.js'
import type { SupportServices } from './domains/support/service.js'
import type { DocsService } from './domains/docs/service.js'

/** Application-owned services; freezing the snapshot never freezes these instances. */
export interface BusinessServices {
  readonly authServices: AuthService
  readonly profileServices: ProfileService
  readonly joinServices: JoinService
  readonly invitationServices: InvitationService
  readonly oidcServices?: OidcService
  readonly storageServices: StorageServices
  readonly notifications: NotificationModule
  readonly clickupServices: ClickUpServices
  readonly supportServices: SupportServices
  readonly docsServices: DocsService
}
