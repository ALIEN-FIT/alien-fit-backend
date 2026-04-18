import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const supersetExerciseSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Superset training video ID'),
    sets: Joi.number().integer().positive().required(),
    repeats: Joi.number().integer().positive().required(),
}).unknown(false);

const circuitExerciseSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Circuit training video ID'),
    sets: Joi.number().integer().positive().required(),
    repeats: Joi.number().integer().positive().required(),
}).unknown(false);

const trainingPlanItemSchema = Joi.object({
    itemType: Joi.string().valid('REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT').default('REGULAR'),
    trainingVideoId: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('CIRCUIT'),
        then: Joi.forbidden(),
        otherwise: JoiCustomValidateObjectId('Training video ID'),
    }),
    sets: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('CIRCUIT'),
        then: Joi.forbidden(),
        otherwise: Joi.number().integer().positive().required(),
    }),
    repeats: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('CIRCUIT'),
        then: Joi.forbidden(),
        otherwise: Joi.number().integer().positive().required(),
    }),
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
    circuitItems: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('CIRCUIT'),
        then: Joi.array().items(circuitExerciseSchema).min(1).required(),
        otherwise: Joi.forbidden(),
    }),
    circuitGroup: Joi.alternatives().conditional('itemType', {
        is: Joi.valid('CIRCUIT'),
        then: Joi.forbidden(),
        otherwise: Joi.forbidden(),
    }),
}).unknown(false);

const trainingPlanDaySchema = Joi.object({
    name: Joi.string().trim().min(1).required(),
    dayNumber: Joi.number().integer().min(1).max(7).optional(),
    items: Joi.array().items(trainingPlanItemSchema).required(),
}).unknown(false);

export const createTrainingPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    days: Joi.array().length(7).items(trainingPlanDaySchema).required(),
});

export const trainingPlanUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});

export const trainingPlanAdminDayParamSchema = Joi.object({
    planId: JoiCustomValidateObjectId('Training plan ID', true),
    dayIndex: Joi.number().integer().min(1).max(28).required(),
});

export const trainingPlanItemParamSchema = Joi.object({
    itemId: JoiCustomValidateObjectId('Training plan item ID', true),
});

export const updateTrainingPlanDaySchema = Joi.object({
    name: Joi.string().trim().min(1).optional(),
    items: Joi.array().items(trainingPlanItemSchema).optional(),
})
    .min(1)
    .messages({ 'object.min': 'At least one field must be provided' });

export const updateTrainingPlanItemSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Training video ID', false),
    sets: Joi.number().integer().positive().optional(),
    repeats: Joi.number().integer().positive().optional(),
    itemType: Joi.string().valid('REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT').optional(),
    isSuperset: Joi.boolean().optional(),
    supersetItems: Joi.array().items(supersetExerciseSchema).optional(),
    extraVideos: Joi.array().items(Joi.object({ trainingVideoId: JoiCustomValidateObjectId('Extra video ID') })).optional(),
    dropsetConfig: Joi.object({
        dropPercents: Joi.array().items(Joi.number().min(0).max(100)).min(1).required(),
        restSeconds: Joi.number().integer().min(0).optional(),
    }).optional(),
    circuitItems: Joi.array().items(circuitExerciseSchema).min(1).optional(),
    circuitGroup: Joi.string().allow('').optional(),
    note: Joi.string().optional(),
})
    .min(1)
    .messages({ 'object.min': 'At least one field must be provided' });

export const getMyTrainingPlanQuerySchema = Joi.object({
    week: Joi.number().integer().min(1).max(4).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
});
