import express from 'express';
import { auth, authorizeRoles } from '../../../../middleware/authorization.middleware.js';
import { Roles } from '../../../../constants/roles.js';
import { validateRequest } from '../../../../middleware/validation.middleware.js';
import {
    createDietPlanWeekController,
    getDietPlanController,
    getDietPlanHistoryController,
    getMyDietPlanController,
    adminUpdateDietPlanDayController,
    adminClearDietPlanDayController,
    adminUpdateDietMealController,
    adminDeleteDietMealController,
} from './diet-plan.controller.js';
import {
    createDietPlanSchema,
    dietPlanUserParamSchema,
    dietPlanAdminDayParamSchema,
    dietMealItemParamSchema,
    updateDietPlanDaySchema,
    updateDietMealSchema,
} from './diet-plan.validation.js';

export const dietPlanRouterV1 = express.Router();

dietPlanRouterV1.use(auth);

dietPlanRouterV1.post(
    '/week/:userId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(createDietPlanSchema.concat(dietPlanUserParamSchema)),
    createDietPlanWeekController,
);

dietPlanRouterV1.get(
    '/me',
    getMyDietPlanController,
);

dietPlanRouterV1.get(
    '/me/history',
    getDietPlanHistoryController,
);

dietPlanRouterV1.get(
    '/:userId',
    validateRequest(dietPlanUserParamSchema),
    getDietPlanController,
);

dietPlanRouterV1.get(
    '/:userId/history',
    authorizeRoles(Roles.ADMIN),
    validateRequest(dietPlanUserParamSchema),
    getDietPlanHistoryController,
);

dietPlanRouterV1.patch(
    '/admin/:planId/day/:dayIndex',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateDietPlanDaySchema.concat(dietPlanAdminDayParamSchema)),
    adminUpdateDietPlanDayController,
);

dietPlanRouterV1.delete(
    '/admin/:planId/day/:dayIndex',
    authorizeRoles(Roles.ADMIN),
    validateRequest(dietPlanAdminDayParamSchema),
    adminClearDietPlanDayController,
);

dietPlanRouterV1.patch(
    '/admin/meal/:mealItemId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateDietMealSchema.concat(dietMealItemParamSchema)),
    adminUpdateDietMealController,
);

dietPlanRouterV1.delete(
    '/admin/meal/:mealItemId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(dietMealItemParamSchema),
    adminDeleteDietMealController,
);
