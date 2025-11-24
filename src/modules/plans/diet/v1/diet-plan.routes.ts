import express from 'express';
import { auth, authorizeRoles } from '../../../../middleware/authorization.middleware.js';
import { Roles } from '../../../../constants/roles.js';
import { validateRequest } from '../../../../middleware/validation.middleware.js';
import {
    createDietPlanWeekController,
    getDietPlanController,
    getMyDietPlanController,
} from './diet-plan.controller.js';
import {
    createDietPlanSchema,
    dietPlanUserParamSchema,
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
    '/:userId',
    validateRequest(dietPlanUserParamSchema),
    getDietPlanController,
);
