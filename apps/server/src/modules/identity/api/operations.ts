import {
  inspectOidcRequest,
  acceptOidcLogin,
  acceptOidcConsent,
  acceptOidcLogout,
  checkLinkedSession,
  revokeLinkedSession,
  inspectIdentityUser,
} from './handlers.js'

export const operations = {
  inspectOidcRequest,
  acceptOidcLogin,
  acceptOidcConsent,
  acceptOidcLogout,
  checkLinkedSession,
  revokeLinkedSession,
  inspectIdentityUser,
} as const
