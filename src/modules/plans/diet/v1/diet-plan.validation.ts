import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const mealSchema = Joi.object({
    mealName: Joi.string().min(1).optional(),
    order: Joi.number().integer().min(1).required(),
    text: Joi.string().min(1).required(),
}).unknown(false);

export const createDietPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    recommendedWaterIntakeMl: Joi.number().integer().min(0).optional(),
    meals: Joi.array().items(mealSchema).default([]),
    snacks: Joi.array().items(mealSchema).default([]),
}).custom((value, helpers) => {
    const meals = Array.isArray(value.meals) ? value.meals : [];
    const snacks = Array.isArray(value.snacks) ? value.snacks : [];
    if (meals.length + snacks.length < 1) {
        return helpers.error('any.custom', { message: 'Template must include at least 1 item in meals or snacks' });
    }
    return value;
}, 'meals/snacks minimum total').messages({
    'any.custom': '{{#message}}',
});

export const dietPlanUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});
