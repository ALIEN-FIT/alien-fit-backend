import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    createTrainingVideoController,
    deleteTrainingVideoController,
    getTrainingVideoController,
    listTrainingVideosController,
    syncTrainingVideosFromYouTubeController,
    updateTrainingVideoController,
    youtubeOAuthCallbackController,
    createTrainingTagController,
    deleteTrainingTagController,
    getTrainingTagController,
    listTrainingTagsController,
    updateTrainingTagController,
} from './training-video.controller.js';
import {
    createTrainingVideoSchema,
    updateTrainingVideoSchema,
    trainingVideoParamSchema,
    listTrainingVideoQuerySchema,
    createTrainingTagSchema,
    updateTrainingTagSchema,
    trainingTagParamSchema,
    listTrainingTagQuerySchema,
    syncTrainingVideosSchema,
} from './training-video.validation.js';

export const trainingVideoRouterV1 = express.Router();

// Public OAuth callback (Google redirects the user here; no JWT available)
trainingVideoRouterV1.get('/youtube/callback', youtubeOAuthCallbackController);

trainingVideoRouterV1.use(auth);

trainingVideoRouterV1.post(
    '/',
    authorizeRoles(Roles.ADMIN),
    validateRequest(createTrainingVideoSchema),
    createTrainingVideoController,
);

trainingVideoRouterV1.post(
    '/youtube/sync',
    authorizeRoles(Roles.ADMIN),
    validateRequest(syncTrainingVideosSchema),
    syncTrainingVideosFromYouTubeController,
);

trainingVideoRouterV1.get(
    '/',
    validateRequest(listTrainingVideoQuerySchema),
    listTrainingVideosController,
);


trainingVideoRouterV1.post(
    '/tags',
    authorizeRoles(Roles.ADMIN),
    validateRequest(createTrainingTagSchema),
    createTrainingTagController,
);

trainingVideoRouterV1.get(
    '/tags',
    validateRequest(listTrainingTagQuerySchema),
    listTrainingTagsController,
);

trainingVideoRouterV1.get(
    '/tags/:tagId',
    validateRequest(trainingTagParamSchema),
    getTrainingTagController,
);

trainingVideoRouterV1.patch(
    '/tags/:tagId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateTrainingTagSchema.concat(trainingTagParamSchema)),
    updateTrainingTagController,
);

trainingVideoRouterV1.delete(
    '/tags/:tagId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(trainingTagParamSchema),
    deleteTrainingTagController,
);


trainingVideoRouterV1.get(
    '/:videoId',
    validateRequest(trainingVideoParamSchema),
    getTrainingVideoController,
);

trainingVideoRouterV1.patch(
    '/:videoId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateTrainingVideoSchema.concat(trainingVideoParamSchema)),
    updateTrainingVideoController,
);

trainingVideoRouterV1.delete(
    '/:videoId',
    authorizeRoles(Roles.ADMIN),
    validateRequest(trainingVideoParamSchema),
    deleteTrainingVideoController,
);