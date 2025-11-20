import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    createPlanUpdateRequestController,
    listPlanUpdateRequestsController,
    approvePlanUpdateRequestController,
} from './plan-update-request.controller.js';
import {
    createPlanUpdateRequestSchema,
    listPlanUpdateRequestSchema,
    approvePlanUpdateRequestSchema,
} from './plan-update-request.validation.js';

export const planUpdateRequestRouterV1 = express.Router();

planUpdateRequestRouterV1.use(auth);

planUpdateRequestRouterV1.post(
    '/request-update',
    validateRequest(createPlanUpdateRequestSchema),
    createPlanUpdateRequestController,
);

planUpdateRequestRouterV1.use(authorizeRoles(Roles.ADMIN));

planUpdateRequestRouterV1.get(
    '/request-update',
    validateRequest(listPlanUpdateRequestSchema),
    listPlanUpdateRequestsController,
);

planUpdateRequestRouterV1.post(
    '/request-update/:requestId/approve',
    validateRequest(approvePlanUpdateRequestSchema),
    approvePlanUpdateRequestController,
);
