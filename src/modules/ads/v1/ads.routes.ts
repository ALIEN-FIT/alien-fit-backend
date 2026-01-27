import express from 'express';
import { auth, authorizeRoles, optionalAuth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    listActiveAdsController,
    trackAdClickController,
    trackAdPromoCopyController,
    adminListAllAdsController,
    adminCreateAdController,
    adminUpdateAdController,
    adminDeleteAdController,
    adminGetAdController,
    adminGetAdStatsController,
} from './ads.controller.js';
import { adIdParamSchema, createAdSchema, updateAdSchema } from './ads.validation.js';

export const adsRouterV1 = express.Router();

// Public / user-facing
adsRouterV1.get('/', optionalAuth, listActiveAdsController);
adsRouterV1.post('/:adId/click', optionalAuth, validateRequest(adIdParamSchema), trackAdClickController);
adsRouterV1.post('/:adId/promo/copy', optionalAuth, validateRequest(adIdParamSchema), trackAdPromoCopyController);

// Admin
adsRouterV1.use(auth, authorizeRoles(Roles.ADMIN));

adsRouterV1.get('/admin/all', adminListAllAdsController);
adsRouterV1.get('/admin/:adId', validateRequest(adIdParamSchema), adminGetAdController);
adsRouterV1.get('/admin/:adId/stats', validateRequest(adIdParamSchema), adminGetAdStatsController);

adsRouterV1.post('/admin', validateRequest(createAdSchema), adminCreateAdController);
adsRouterV1.put('/admin/:adId', validateRequest(updateAdSchema), adminUpdateAdController);
adsRouterV1.delete('/admin/:adId', validateRequest(adIdParamSchema), adminDeleteAdController);
