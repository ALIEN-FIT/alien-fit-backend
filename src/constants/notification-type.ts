export const NotificationTypes = {
    MESSAGE: 'message',
    NUTRITION: 'nutrition',
    TRAINING_REMINDER: 'training_reminder',
    BODY_IMAGE_REMINDER: 'body_image_reminder',
    INBODY_REMINDER: 'inbody_reminder',
    GENERAL: 'general',
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

export const NOTIFICATION_TYPES = Object.values(NotificationTypes);
