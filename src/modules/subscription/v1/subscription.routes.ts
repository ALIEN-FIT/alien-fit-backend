import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    activateSubscriptionController,
    renewSubscriptionController,
    getSubscriptionStatusController,
    createSubscriptionCheckoutController,
    fawaterakWebhookController,
} from './subscription.controller.js';
import {
    subscriptionActivateSchema,
    subscriptionRenewSchema,
    subscriptionCheckoutSchema,
    fawaterakWebhookSchema,
} from './subscription.validation.js';

export const subscriptionRouterV1 = express.Router();

// Webhook must be public (Fawaterak server-to-server)
subscriptionRouterV1.post(
    '/webhook/fawaterak',
    express.json(),
    validateRequest(fawaterakWebhookSchema),
    fawaterakWebhookController,
);

subscriptionRouterV1.post(
    '/activate/:userId',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionActivateSchema),
    activateSubscriptionController,
);

subscriptionRouterV1.post(
    '/renew/:userId',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionRenewSchema),
    renewSubscriptionController,
);

subscriptionRouterV1.get('/status', auth, getSubscriptionStatusController);

// User checkout
subscriptionRouterV1.post(
    '/checkout',
    auth,
    validateRequest(subscriptionCheckoutSchema),
    createSubscriptionCheckoutController,
);
