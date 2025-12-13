import express from 'express';
import { auth, authorizeRoles, optionalAuth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    createFeedbackController,
    listMyFeedbackController,
    adminSearchFeedbackController,
    respondToFeedbackController,
} from './feedback.controller.js';
import {
    createFeedbackSchema,
    listMyFeedbackSchema,
    adminSearchFeedbackSchema,
    respondToFeedbackSchema,
} from './feedback.validation.js';

export const feedbackRouterV1 = express.Router();

feedbackRouterV1.post(
    '/',
    optionalAuth,
    validateRequest(createFeedbackSchema),
    createFeedbackController,
);

feedbackRouterV1.get(
    '/my',
    auth,
    validateRequest(listMyFeedbackSchema),
    listMyFeedbackController,
);

feedbackRouterV1.use(auth, authorizeRoles(Roles.ADMIN));

feedbackRouterV1.get(
    '/',
    validateRequest(adminSearchFeedbackSchema),
    adminSearchFeedbackController,
);

feedbackRouterV1.patch(
    '/:feedbackId/reply',
    validateRequest(respondToFeedbackSchema),
    respondToFeedbackController,
);
