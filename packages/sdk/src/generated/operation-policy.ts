// Generated from apps/php-server/api/generated/openapi.internal.yaml. Do not edit.
export const operationPolicy = {
  "GET /api/account/grants": {
    "requiresSession": true
  },
  "POST /api/account/grants/{client_id}/revoke": {
    "requiresSession": true
  },
  "POST /api/account/login": {
    "requiresSession": false
  },
  "POST /api/account/logout": {
    "requiresSession": true
  },
  "GET /api/account/me": {
    "requiresSession": true
  },
  "POST /api/account/password": {
    "requiresSession": true
  },
  "POST /api/account/register": {
    "requiresSession": false
  },
  "POST /api/account/send-email-code": {
    "requiresSession": false
  },
  "GET /api/account/sessions": {
    "requiresSession": true
  },
  "POST /api/account/sessions/revoke-all": {
    "requiresSession": true
  },
  "POST /api/account/sessions/{sid}/revoke": {
    "requiresSession": true
  },
  "GET /api/admin/bindings": {
    "requiresSession": true
  },
  "POST /api/admin/bindings/{id}/revoke": {
    "requiresSession": true
  },
  "GET /api/admin/clients": {
    "requiresSession": true
  },
  "POST /api/admin/clients": {
    "requiresSession": true
  },
  "POST /api/admin/clients/{id}/secret-reset": {
    "requiresSession": true
  },
  "POST /api/admin/clients/{id}/status": {
    "requiresSession": true
  },
  "GET /api/admin/dashboard": {
    "requiresSession": true
  },
  "GET /api/admin/doc-categories": {
    "requiresSession": true
  },
  "POST /api/admin/doc-categories": {
    "requiresSession": true
  },
  "DELETE /api/admin/doc-categories/{id}": {
    "requiresSession": true
  },
  "GET /api/admin/docs": {
    "requiresSession": true
  },
  "POST /api/admin/docs": {
    "requiresSession": true
  },
  "PUT /api/admin/docs/{id}": {
    "requiresSession": true
  },
  "DELETE /api/admin/docs/{id}": {
    "requiresSession": true
  },
  "POST /api/admin/docs/{id}/status": {
    "requiresSession": true
  },
  "GET /api/admin/feedback": {
    "requiresSession": true
  },
  "GET /api/admin/feedback/{id}": {
    "requiresSession": true
  },
  "POST /api/admin/feedback/{id}/status": {
    "requiresSession": true
  },
  "GET /api/admin/logs": {
    "requiresSession": true
  },
  "GET /api/admin/notifications": {
    "requiresSession": true
  },
  "POST /api/admin/notifications": {
    "requiresSession": true
  },
  "DELETE /api/admin/notifications/{batch}": {
    "requiresSession": true
  },
  "POST /api/admin/notifications/{batch}/expire": {
    "requiresSession": true
  },
  "GET /api/admin/plugin-options": {
    "requiresSession": true
  },
  "GET /api/admin/plugins": {
    "requiresSession": true
  },
  "POST /api/admin/plugins": {
    "requiresSession": true
  },
  "PUT /api/admin/plugins/{id}": {
    "requiresSession": true
  },
  "GET /api/admin/plugins/{id}/features": {
    "requiresSession": true
  },
  "POST /api/admin/plugins/{id}/features": {
    "requiresSession": true
  },
  "PUT /api/admin/plugins/{id}/features/{fid}": {
    "requiresSession": true
  },
  "DELETE /api/admin/plugins/{id}/features/{fid}": {
    "requiresSession": true
  },
  "POST /api/admin/plugins/{id}/status": {
    "requiresSession": true
  },
  "GET /api/admin/server-options": {
    "requiresSession": true
  },
  "GET /api/admin/servers": {
    "requiresSession": true
  },
  "POST /api/admin/servers": {
    "requiresSession": true
  },
  "GET /api/admin/servers/{sid}": {
    "requiresSession": true
  },
  "PUT /api/admin/servers/{sid}": {
    "requiresSession": true
  },
  "POST /api/admin/servers/{sid}/status": {
    "requiresSession": true
  },
  "GET /api/admin/sso-requests": {
    "requiresSession": true
  },
  "POST /api/admin/sso-requests/{deviceCode}/revoke": {
    "requiresSession": true
  },
  "GET /api/admin/tags": {
    "requiresSession": true
  },
  "POST /api/admin/tags": {
    "requiresSession": true
  },
  "DELETE /api/admin/tags/{id}": {
    "requiresSession": true
  },
  "GET /api/admin/users": {
    "requiresSession": true
  },
  "GET /api/admin/users/{id}": {
    "requiresSession": true
  },
  "POST /api/admin/users/{id}/ban": {
    "requiresSession": true
  },
  "POST /api/admin/users/{id}/platform-role": {
    "requiresSession": true
  },
  "POST /api/admin/users/{id}/tags": {
    "requiresSession": true
  },
  "POST /api/auth/captcha/challenges": {
    "requiresSession": false
  },
  "POST /api/auth/invitations/check": {
    "requiresSession": false
  },
  "POST /api/auth/invitations/code": {
    "requiresSession": false
  },
  "POST /api/auth/invitations/complete": {
    "requiresSession": false
  },
  "POST /api/auth/invitations/verify": {
    "requiresSession": false
  },
  "POST /api/auth/login": {
    "requiresSession": false
  },
  "POST /api/auth/logout": {
    "requiresSession": true
  },
  "GET /api/auth/me": {
    "requiresSession": true
  },
  "PATCH /api/auth/me": {
    "requiresSession": true
  },
  "POST /api/auth/me/avatar": {
    "requiresSession": true
  },
  "POST /api/auth/sso/confirm": {
    "requiresSession": true
  },
  "POST /api/auth/sso/inspect": {
    "requiresSession": false
  },
  "POST /api/auth/sso/login": {
    "requiresSession": false
  },
  "GET /api/avatars/{avatarId}": {
    "requiresSession": false
  },
  "GET /api/docs": {
    "requiresSession": false
  },
  "GET /api/docs/{slug}": {
    "requiresSession": false
  },
  "GET /api/health": {
    "requiresSession": false
  },
  "POST /api/installation/install": {
    "requiresSession": false
  },
  "GET /api/installation/status": {
    "requiresSession": false
  },
  "GET /api/notification-preferences": {
    "requiresSession": true
  },
  "PUT /api/notification-preferences": {
    "requiresSession": true
  },
  "GET /api/notifications": {
    "requiresSession": true
  },
  "POST /api/notifications/clear-all": {
    "requiresSession": true
  },
  "POST /api/notifications/clear-preview": {
    "requiresSession": true
  },
  "POST /api/notifications/read-all": {
    "requiresSession": true
  },
  "GET /api/notifications/summary": {
    "requiresSession": true
  },
  "GET /api/notifications/{notificationId}": {
    "requiresSession": true
  },
  "PATCH /api/notifications/{notificationId}/state": {
    "requiresSession": true
  },
  "GET /api/oauth/authorize-info": {
    "requiresSession": true
  },
  "POST /api/oauth/authorize/confirm": {
    "requiresSession": true
  },
  "POST /api/oauth/device/verify": {
    "requiresSession": true
  },
  "GET /api/server/mine": {
    "requiresSession": true
  },
  "GET /api/server/{sid}": {
    "requiresSession": true
  },
  "PUT /api/server/{sid}": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/bindings": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/bindings": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/bindings/{id}/disable": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/bindings/{id}/enable": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/bindings/{id}/reset": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/clients": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/clients/connect": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/clients/disconnect": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/doc-categories": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/doc-categories": {
    "requiresSession": true
  },
  "DELETE /api/server/{sid}/doc-categories/{id}": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/docs": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/docs": {
    "requiresSession": true
  },
  "PUT /api/server/{sid}/docs/{id}": {
    "requiresSession": true
  },
  "DELETE /api/server/{sid}/docs/{id}": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/docs/{id}/status": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/idents": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/idents/bind": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/idents/{id}/unbind": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/member-perms": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/members": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/members": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/members/{uid}/ban": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/members/{uid}/remove": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/members/{uid}/role": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/members/{uid}/unban": {
    "requiresSession": true
  },
  "GET /api/server/{sid}/plugin-perms": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/plugin-perms": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/plugin-perms/push": {
    "requiresSession": true
  },
  "POST /api/server/{sid}/plugin-perms/reset": {
    "requiresSession": true
  },
  "GET /api/storage/files": {
    "requiresSession": false
  },
  "POST /api/storage/uploads": {
    "requiresSession": true
  },
  "POST /api/storage/uploads/complete": {
    "requiresSession": true
  },
  "POST /api/storage/uploads/prepare": {
    "requiresSession": true
  },
  "GET /api/support/feedback/options": {
    "requiresSession": true
  },
  "POST /api/support/feedback/submissions": {
    "requiresSession": true
  },
  "GET /api/support/feedback/submissions/lookup": {
    "requiresSession": true
  },
  "GET /api/support/feedback/submissions/{submissionId}": {
    "requiresSession": true
  },
  "POST /api/support/feedback/submissions/{submissionId}/advance": {
    "requiresSession": true
  },
  "PUT /api/support/feedback/submissions/{submissionId}/attachments/{attachmentId}": {
    "requiresSession": true
  }
} as const
