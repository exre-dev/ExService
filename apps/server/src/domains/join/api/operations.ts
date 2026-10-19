import {
  checkInvitationEligibility,
  requestInvitationCode,
  verifyInvitationCode,
  completeInvitationRegistration,
} from './handlers.js'

export const operations = {
  checkInvitationEligibility,
  requestInvitationCode,
  verifyInvitationCode,
  completeInvitationRegistration,
} as const
