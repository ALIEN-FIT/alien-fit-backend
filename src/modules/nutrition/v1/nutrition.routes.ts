import express from 'express';
import { auth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import upload from '../../../middleware/upload.middleware.js';
import {
    getNutritionController,
    getRecipesController,
    imageTextNutritionController,
} from './nutrition.controller.js';
import { nutritionQuerySchema, recipeQuerySchema } from './nutrition.validation.js';

export const nutritionRouterV1 = express.Router();

nutritionRouterV1.use(auth);

nutritionRouterV1.get('/nutrition', validateRequest(nutritionQuerySchema), getNutritionController);

nutritionRouterV1.get('/recipes', validateRequest(recipeQuerySchema), getRecipesController);

nutritionRouterV1.post('/imagetext', upload.single('image'), imageTextNutritionController);
