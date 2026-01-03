import Joi from 'joi';
import { NOTIFICATION_TYPES } from '../../../constants/notification-type.js';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

export const listMyNotificationsSchema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    isRead: Joi.boolean().optional(),
    isSeen: Joi.boolean().optional(),
});

export const notificationIdParamSchema = Joi.object({
    notificationId: JoiCustomValidateObjectId('Notification ID', true),
});

export const adminBroadcastNotificationSchema = Joi.object({
    type: Joi.string().valid(...NOTIFICATION_TYPES).required(),
    title: Joi.string().trim().min(1).max(255).required(),
    body: Joi.string().trim().min(1).max(4000).required(),
    filters: Joi.object({
        isSubscribed: Joi.boolean().optional(),
        gender: Joi.string().trim().min(1).max(50).optional(),
    }).optional(),
});
