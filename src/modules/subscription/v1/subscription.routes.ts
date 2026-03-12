import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    activateSubscriptionController,
    renewSubscriptionController,
    getSubscriptionStatusController,
    freezeSubscriptionController,
    listPendingFreezeRequestsController,
    approveFreezeRequestController,
    declineFreezeRequestController,
    defrostSubscriptionController,
    adminDefrostSubscriptionController,
    createSubscriptionCheckoutController,
    fawaterakWebhookController,
} from './subscription.controller.js';
import {
    subscriptionActivateSchema,
    subscriptionRenewSchema,
    subscriptionFreezeRequestSchema,
    subscriptionApproveFreezeRequestSchema,
    subscriptionDeclineFreezeRequestSchema,
    subscriptionAdminDefrostSchema,
    subscriptionCheckoutSchema,
    fawaterakWebhookSchema,
} from './subscription.validation.js';

export const subscriptionRouterV1 = express.Router();

// Webhook must be public (Fawaterak server-to-server)
subscriptionRouterV1.post(
    '/webhook/fawaterak_json',
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
subscriptionRouterV1.post('/freeze', auth, validateRequest(subscriptionFreezeRequestSchema), freezeSubscriptionController);
subscriptionRouterV1.post('/defrost', auth, defrostSubscriptionController);

subscriptionRouterV1.get(
    '/freeze/requests/pending',
    auth,
    authorizeRoles(Roles.ADMIN),
    listPendingFreezeRequestsController,
);

subscriptionRouterV1.post(
    '/freeze/requests/:requestId/approve',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionApproveFreezeRequestSchema),
    approveFreezeRequestController,
);

subscriptionRouterV1.post(
    '/freeze/requests/:requestId/decline',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionDeclineFreezeRequestSchema),
    declineFreezeRequestController,
);

subscriptionRouterV1.post(
    '/defrost/:userId',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(subscriptionAdminDefrostSchema),
    adminDefrostSubscriptionController,
);

// User checkout
subscriptionRouterV1.post(
    '/checkout',
    auth,
    validateRequest(subscriptionCheckoutSchema),
    createSubscriptionCheckoutController,
);
