export const NotificationTypes = {
    MESSAGE: 'message',
    NUTRITION: 'nutrition',
    TRAINING_REMINDER: 'training_reminder',
    GENERAL: 'general',
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export const NOTIFICATION_TYPES = Object.values(NotificationTypes);
