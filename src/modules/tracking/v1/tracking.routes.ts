import express from 'express';
import { auth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    markTrainingDoneController,
    markDietDoneController,
    logExtraTrainingController,
    logExtraFoodController,
    logWaterIntakeController,
    getDailyStatusController,
} from './tracking.controller.js';
import {
    markTrainingDoneSchema,
    markDietDoneSchema,
    extraTrainingSchema,
    extraFoodSchema,
    waterIntakeSchema,
    dailyStatusParamsSchema,
} from './tracking.validation.js';

export const trackingRouterV1 = express.Router();

trackingRouterV1.use(auth);

trackingRouterV1.post(
    '/training/mark-done',
    validateRequest(markTrainingDoneSchema),
    markTrainingDoneController,
);

trackingRouterV1.post(
    '/diet/mark-done',
    validateRequest(markDietDoneSchema),
    markDietDoneController,
);

trackingRouterV1.post(
    '/extra/training',
    validateRequest(extraTrainingSchema),
    logExtraTrainingController,
);

trackingRouterV1.post(
    '/extra/food',
    validateRequest(extraFoodSchema),
    logExtraFoodController,
);

trackingRouterV1.post(
    '/water',
    validateRequest(waterIntakeSchema),
    logWaterIntakeController,
);

trackingRouterV1.get(
    '/daily-status/:date',
    validateRequest(dailyStatusParamsSchema),
    getDailyStatusController,
);
