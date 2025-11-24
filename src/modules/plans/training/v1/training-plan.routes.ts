import express from 'express';
import { auth, authorizeRoles } from '../../../../middleware/authorization.middleware.js';
import { Roles } from '../../../../constants/roles.js';
import { validateRequest } from '../../../../middleware/validation.middleware.js';
import {
    createTrainingPlanWeekController,
    getTrainingPlanController,
    getMyTrainingPlanController,
} from './training-plan.controller.js';
import {
    createTrainingPlanSchema,
    trainingPlanUserParamSchema,
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
    getMyTrainingPlanController,
);

trainingPlanRouterV1.get(
    '/:userId',
    validateRequest(trainingPlanUserParamSchema),
    getTrainingPlanController,
);
