import {
  listNotifications,
  getNotificationSummary,
  getNotification,
  updateNotificationState,
  markNotificationsReadThrough,
  previewNotificationClear,
  clearNotificationsSnapshot,
  getNotificationPreferences,
  updateNotificationPreferences,
} from './handlers.js'

export const operations = {
  listNotifications,
  getNotificationSummary,
  getNotification,
  updateNotificationState,
  markNotificationsReadThrough,
  previewNotificationClear,
  clearNotificationsSnapshot,
  getNotificationPreferences,
  updateNotificationPreferences,
} as const
