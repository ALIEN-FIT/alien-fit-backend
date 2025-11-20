import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const mealItemSchema = Joi.object({
    foodName: Joi.string().required(),
    amount: Joi.string().required(),
}).unknown(false);

const mealsSchema = Joi.object({
    breakfast: Joi.array().items(mealItemSchema).default([]),
    lunch: Joi.array().items(mealItemSchema).default([]),
    snacks: Joi.array().items(mealItemSchema).default([]),
    dinner: Joi.array().items(mealItemSchema).default([]),
}).unknown(false);

const dietPlanDaySchema = Joi.object({
    dayNumber: Joi.number().integer().min(1).max(7).optional(),
    meals: mealsSchema.required(),
}).unknown(false);

export const createDietPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    days: Joi.array().length(7).items(dietPlanDaySchema).required(),
});

export const dietPlanUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});
