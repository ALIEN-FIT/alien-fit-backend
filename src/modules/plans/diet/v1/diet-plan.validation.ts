import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const foodSchema = Joi.object({
    name: Joi.string().required(),
    grams: Joi.number().integer().min(0).required(),
    calories: Joi.number().integer().min(0).required(),
    fats: Joi.number().integer().min(0).required(),
    carbs: Joi.number().integer().min(0).required(),
}).unknown(false);

const mealSchema = Joi.object({
    mealName: Joi.string().min(1).required(),
    order: Joi.number().integer().min(1).required(),
    foods: Joi.array().items(foodSchema).min(1).required(),
}).unknown(false);

const dietPlanDaySchema = Joi.object({
    dayNumber: Joi.number().integer().min(1).max(7).optional(),
    meals: Joi.array().items(mealSchema).required(),
}).unknown(false);

export const createDietPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    recommendedWaterIntakeMl: Joi.number().integer().min(0).optional(),
    days: Joi.array().length(7).items(dietPlanDaySchema).required(),
});

export const dietPlanUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});
