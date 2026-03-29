export const NotificationTypes = {
    MESSAGE: 'message',
    ADMIN_MESSAGE: 'admin_message',
    SUBSCRIPTION_ENDS_TODAY: 'subscription_ends_today',
    NUTRITION: 'nutrition',
    TRAINING_REMINDER: 'training_reminder',
    BODY_IMAGE_REMINDER: 'body_image_reminder',
    INBODY_REMINDER: 'inbody_reminder',
    GENERAL: 'general',
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export const NOTIFICATION_TYPES = Object.values(NotificationTypes);
