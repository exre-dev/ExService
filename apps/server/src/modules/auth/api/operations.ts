import {
  createCaptchaChallenge,
  login,
  getCurrentUser,
  logout,
  inspectSsoRequest,
  loginForSso,
  confirmSsoWithSession,
} from './handlers.js'

export const operations = {
  createCaptchaChallenge,
  login,
  getCurrentUser,
  logout,
  inspectSsoRequest,
  loginForSso,
  confirmSsoWithSession,
} as const
