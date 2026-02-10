import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

export const setDefaultFreeDaysSchema = Joi.object({
    days: Joi.number().integer().min(0).max(365).required().messages({
        'number.base': 'Days must be a number',
        'number.integer': 'Days must be an integer',
        'number.min': 'Days must be at least 0',
        'number.max': 'Days cannot exceed 365',
        'any.required': 'Days is required',
    }),
});

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

export const setDefaultDietPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    recommendedWaterIntakeMl: Joi.number().integer().min(0).optional(),
    days: Joi.array().length(7).items(dietPlanDaySchema).required(),
});

const supersetExerciseSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Superset training video ID'),
    sets: Joi.number().integer().positive().required(),
    repeats: Joi.number().integer().positive().required(),
}).unknown(false);

const trainingPlanItemSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Training video ID'),
    sets: Joi.number().integer().positive().required(),
    repeats: Joi.number().integer().positive().required(),
    itemType: Joi.string().valid('REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT').default('REGULAR'),
    isSuperset: Joi.boolean().optional(),
    supersetItems: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('SUPERSET'),
        then: Joi.array().items(supersetExerciseSchema).min(1).required(),
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'supersetItems is allowed only when itemType is SUPERSET' }),
    }),
    extraVideos: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('SUPERSET'),
        then: Joi.array().items(Joi.object({ trainingVideoId: JoiCustomValidateObjectId('Extra video ID') })).min(1).optional(),
        otherwise: Joi.forbidden(),
    }),
    dropsetConfig: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('DROPSET'),
        then: Joi.object({
            dropPercents: Joi.array().items(Joi.number().min(0).max(100)).min(1).required(),
            restSeconds: Joi.number().integer().min(0).default(0),
        }).required(),
        otherwise: Joi.forbidden(),
    }),
    circuitGroup: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('CIRCUIT'),
        then: Joi.string().min(1).required(),
        otherwise: Joi.forbidden(),
    }),
}).unknown(false);

const trainingPlanDaySchema = Joi.object({
    dayNumber: Joi.number().integer().min(1).max(7).optional(),
    items: Joi.array().items(trainingPlanItemSchema).required(),
}).unknown(false);

export const setDefaultTrainingPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    days: Joi.array().length(7).items(trainingPlanDaySchema).required(),
});

export const setUserFreeDaysSchema = Joi.object({
    userId: Joi.string().uuid().required().messages({
        'string.base': 'User ID must be a string',
        'string.guid': 'User ID must be a valid UUID',
        'any.required': 'User ID is required',
    }),
    freeDays: Joi.number().integer().min(0).max(365).required().messages({
        'number.base': 'Free days must be a number',
        'number.integer': 'Free days must be an integer',
        'number.min': 'Free days must be at least 0',
        'number.max': 'Free days cannot exceed 365',
        'any.required': 'Free days is required',
    }),
});
