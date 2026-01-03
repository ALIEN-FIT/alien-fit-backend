import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    adminBroadcastNotificationController,
    getMyUnseenCountController,
    listMyNotificationsController,
    markAllReadController,
    markAllSeenController,
    markNotificationReadController,
    markNotificationSeenController,
} from './notification.controller.js';
import {
    adminBroadcastNotificationSchema,
    listMyNotificationsSchema,
    notificationIdParamSchema,
} from './notification.validation.js';

export const notificationRouterV1 = express.Router();

notificationRouterV1.use(auth);

notificationRouterV1.get('/my', validateRequest(listMyNotificationsSchema), listMyNotificationsController);

notificationRouterV1.get('/my/unseen-count', getMyUnseenCountController);

notificationRouterV1.patch('/my/seen', markAllSeenController);
notificationRouterV1.patch('/my/read', markAllReadController);

notificationRouterV1.patch(
    '/:notificationId/seen',
    validateRequest(notificationIdParamSchema),
    markNotificationSeenController
);

notificationRouterV1.patch(
    '/:notificationId/read',
    validateRequest(notificationIdParamSchema),
    markNotificationReadController
);

notificationRouterV1.post(
    '/admin/broadcast',
    authorizeRoles(Roles.ADMIN),
    validateRequest(adminBroadcastNotificationSchema),
    adminBroadcastNotificationController
);
