import express from 'express';
import { auth, authorizeRoles } from '../../../../middleware/authorization.middleware.js';
import { Roles } from '../../../../constants/roles.js';
import { validateRequest } from '../../../../middleware/validation.middleware.js';
import {
    createStaticTrainingPlanSchema,
    staticTrainingPlanParamSchema,
    updateStaticTrainingPlanSchema,
} from './static-training-plan.validation.js';
import {
    createStaticTrainingPlanController,
    deleteStaticTrainingPlanController,
    getStaticTrainingPlanController,
    listStaticTrainingPlansController,
    updateStaticTrainingPlanController,
} from './static-training-plan.controller.js';

export const staticTrainingPlanRouterV1 = express.Router();

staticTrainingPlanRouterV1.get('/', listStaticTrainingPlansController);
staticTrainingPlanRouterV1.get(
    '/:planId',
    validateRequest(staticTrainingPlanParamSchema),
    getStaticTrainingPlanController,
);

staticTrainingPlanRouterV1.post(
    '/',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(createStaticTrainingPlanSchema),
    createStaticTrainingPlanController,
);

staticTrainingPlanRouterV1.patch(
    '/:planId',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateStaticTrainingPlanSchema.concat(staticTrainingPlanParamSchema)),
    updateStaticTrainingPlanController,
);

staticTrainingPlanRouterV1.delete(
    '/:planId',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(staticTrainingPlanParamSchema),
    deleteStaticTrainingPlanController,
);
