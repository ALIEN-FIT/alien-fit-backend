import express from 'express';
import { auth, authorizeRoles, optionalAuth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    listActiveSubscriptionPackagesController,
    getSubscriptionPackageController,
    adminListSubscriptionPackagesController,
    adminCreateSubscriptionPackageController,
    adminUpdateSubscriptionPackageController,
    adminDeleteSubscriptionPackageController,
    adminListSupportedCurrenciesController,
    adminUpsertSupportedCurrencyController,
    adminUpdateSupportedCurrencyController,
} from './subscription-package.controller.js';
import {
    packageIdParamSchema,
    createSubscriptionPackageSchema,
    updateSubscriptionPackageSchema,
    upsertCurrencySchema,
    updateCurrencySchema,
} from './subscription-package.validation.js';

export const subscriptionPackageRouterV1 = express.Router();

// Public / user-facing
subscriptionPackageRouterV1.get('/', optionalAuth, listActiveSubscriptionPackagesController);
subscriptionPackageRouterV1.get('/:packageId', optionalAuth, validateRequest(packageIdParamSchema), getSubscriptionPackageController);

// Admin
subscriptionPackageRouterV1.use(auth, authorizeRoles(Roles.ADMIN));

subscriptionPackageRouterV1.get('/admin/all', adminListSubscriptionPackagesController);

subscriptionPackageRouterV1.get('/admin/currencies', adminListSupportedCurrenciesController);

subscriptionPackageRouterV1.post(
    '/admin/currencies',
    validateRequest(upsertCurrencySchema),
    adminUpsertSupportedCurrencyController,
);

subscriptionPackageRouterV1.patch(
    '/admin/currencies/:code',
    validateRequest(updateCurrencySchema),
    adminUpdateSupportedCurrencyController,
);

subscriptionPackageRouterV1.post(
    '/admin',
    validateRequest(createSubscriptionPackageSchema),
    adminCreateSubscriptionPackageController,
);

subscriptionPackageRouterV1.put(
    '/admin/:packageId',
    validateRequest(updateSubscriptionPackageSchema),
    adminUpdateSubscriptionPackageController,
);

subscriptionPackageRouterV1.delete(
    '/admin/:packageId',
    validateRequest(packageIdParamSchema),
    adminDeleteSubscriptionPackageController,
);
