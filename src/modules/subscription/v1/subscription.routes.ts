import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    activateSubscriptionController,
    renewSubscriptionController,
    getSubscriptionStatusController,
} from './subscription.controller.js';
import { subscriptionUserParamSchema } from './subscription.validation.js';

export const subscriptionRouterV1 = express.Router();

subscriptionRouterV1.use(auth);

subscriptionRouterV1.post(
    '/activate/:userId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionUserParamSchema),
    activateSubscriptionController,
);

subscriptionRouterV1.post(
    '/renew/:userId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionUserParamSchema),
    renewSubscriptionController,
);

subscriptionRouterV1.get('/status', getSubscriptionStatusController);
