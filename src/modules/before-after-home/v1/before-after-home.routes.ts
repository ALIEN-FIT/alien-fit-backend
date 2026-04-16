import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    adminCreateBeforeAfterHomeController,
    adminDeleteBeforeAfterHomeController,
    adminGetBeforeAfterHomeController,
    adminListBeforeAfterHomesController,
    adminUpdateBeforeAfterHomeController,
    listActiveBeforeAfterHomesController,
} from './before-after-home.controller.js';
import {
    beforeAfterHomeIdParamSchema,
    createBeforeAfterHomeSchema,
    updateBeforeAfterHomeSchema,
} from './before-after-home.validation.js';

export const beforeAfterHomeRouterV1 = express.Router();

beforeAfterHomeRouterV1.get('/', listActiveBeforeAfterHomesController);

beforeAfterHomeRouterV1.use(auth, authorizeRoles(Roles.ADMIN));

beforeAfterHomeRouterV1.get('/admin/all', adminListBeforeAfterHomesController);
beforeAfterHomeRouterV1.get(
    '/admin/:beforeAfterHomeId',
    validateRequest(beforeAfterHomeIdParamSchema),
    adminGetBeforeAfterHomeController,
);
beforeAfterHomeRouterV1.post(
    '/admin',
    validateRequest(createBeforeAfterHomeSchema),
    adminCreateBeforeAfterHomeController,
);
beforeAfterHomeRouterV1.patch(
    '/admin/:beforeAfterHomeId',
    validateRequest(updateBeforeAfterHomeSchema.concat(beforeAfterHomeIdParamSchema)),
    adminUpdateBeforeAfterHomeController,
);
beforeAfterHomeRouterV1.delete(
    '/admin/:beforeAfterHomeId',
    validateRequest(beforeAfterHomeIdParamSchema),
    adminDeleteBeforeAfterHomeController,
);
