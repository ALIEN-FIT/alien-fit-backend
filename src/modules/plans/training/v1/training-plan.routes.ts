import express from 'express';
import { auth, authorizeRoles } from '../../../../middleware/authorization.middleware.js';
import { Roles } from '../../../../constants/roles.js';
import { validateRequest } from '../../../../middleware/validation.middleware.js';
import {
    createTrainingPlanWeekController,
    getTrainingPlanController,
    getTrainingPlanHistoryController,
    getMyTrainingPlanController,
    adminUpdateTrainingPlanDayController,
    adminClearTrainingPlanDayController,
    adminAddTrainingPlanItemController,
    adminUpdateTrainingPlanItemController,
    adminDeleteTrainingPlanItemController,
    adminDeleteTrainingPlanDayItemController,
} from './training-plan.controller.js';
import {
    createTrainingPlanSchema,
    trainingPlanUserParamSchema,
    getMyTrainingPlanQuerySchema,
    trainingPlanAdminDayParamSchema,
    trainingPlanAdminDayItemParamSchema,
    trainingPlanItemParamSchema,
    updateTrainingPlanDaySchema,
    addTrainingPlanItemSchema,
    updateTrainingPlanItemSchema,
} from './training-plan.validation.js';

export const trainingPlanRouterV1 = express.Router();

trainingPlanRouterV1.use(auth);

trainingPlanRouterV1.post(
    '/week/:userId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(createTrainingPlanSchema.concat(trainingPlanUserParamSchema)),
    createTrainingPlanWeekController,
);

trainingPlanRouterV1.get(
    '/me',
    validateRequest(getMyTrainingPlanQuerySchema),
    getMyTrainingPlanController,
);

trainingPlanRouterV1.get(
    '/me/history',
    getTrainingPlanHistoryController,
);

trainingPlanRouterV1.get(
    '/:userId',
    validateRequest(trainingPlanUserParamSchema),
    getTrainingPlanController,
);

trainingPlanRouterV1.get(
    '/:userId/history',
    authorizeRoles(Roles.ADMIN),
    validateRequest(trainingPlanUserParamSchema),
    getTrainingPlanHistoryController,
);

trainingPlanRouterV1.patch(
    '/admin/:planId/day/:dayIndex',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateTrainingPlanDaySchema.concat(trainingPlanAdminDayParamSchema)),
    adminUpdateTrainingPlanDayController,
);

trainingPlanRouterV1.delete(
    '/admin/:planId/day/:dayIndex',
    authorizeRoles(Roles.ADMIN),
    validateRequest(trainingPlanAdminDayParamSchema),
    adminClearTrainingPlanDayController,
);

trainingPlanRouterV1.post(
    '/admin/:planId/day/:dayIndex/item',
    authorizeRoles(Roles.ADMIN),
    validateRequest(addTrainingPlanItemSchema.concat(trainingPlanAdminDayParamSchema)),
    adminAddTrainingPlanItemController,
);

trainingPlanRouterV1.delete(
    '/admin/:planId/day/:dayIndex/item/:itemId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(trainingPlanAdminDayItemParamSchema),
    adminDeleteTrainingPlanDayItemController,
);

trainingPlanRouterV1.patch(
    '/admin/item/:itemId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateTrainingPlanItemSchema.concat(trainingPlanItemParamSchema)),
    adminUpdateTrainingPlanItemController,
);

trainingPlanRouterV1.patch(
    '/item/:itemId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateTrainingPlanItemSchema.concat(trainingPlanItemParamSchema)),
    adminUpdateTrainingPlanItemController,
);

trainingPlanRouterV1.delete(
    '/admin/item/:itemId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(trainingPlanItemParamSchema),
    adminDeleteTrainingPlanItemController,
);
