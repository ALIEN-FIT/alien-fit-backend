import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const isoDate = Joi.string().isoDate();

export const markTrainingDoneSchema = Joi.object({
    planItemId: JoiCustomValidateObjectId('Plan Item ID', true),
    date: isoDate.optional(),
    stes: Joi.array()
        .items(
            Joi.object({
                repeats: Joi.number().integer().positive().required(),
                weight: Joi.number().positive().required(),
            })
        )
        .min(1)
        .required(),
    note: Joi.string().max(500).optional(),
});

export const markDietDoneSchema = Joi.object({
    mealItemId: JoiCustomValidateObjectId('Meal Item ID', true),
    date: isoDate.optional(),
});

export const extraTrainingSchema = Joi.object({
    date: isoDate.required(),
    description: Joi.string().min(3).required(),
    durationMinutes: Joi.number().integer().positive().optional(),
});

export const extraFoodSchema = Joi.object({
    date: isoDate.required(),
    description: Joi.string().min(3).required(),
    calories: Joi.number().integer().positive().optional(),
});

export const waterIntakeSchema = Joi.object({
    date: isoDate.required(),
    amountMl: Joi.number().integer().required().messages({
        'number.base': 'Water amount must be a number',
        'number.integer': 'Water amount must be an integer',
        'any.required': 'Water amount is required',
    }),
});

export const dailyStatusParamsSchema = Joi.object({
    date: isoDate.required(),
});
