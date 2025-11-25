import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const supersetExerciseSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Superset training video ID'),
    sets: Joi.number().integer().positive().required(),
    repeats: Joi.number().integer().positive().required(),
}).unknown(false);

const trainingPlanItemSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Training video ID'),
    sets: Joi.number().integer().positive().required(),
    repeats: Joi.number().integer().positive().required(),
    isSuperset: Joi.boolean().optional(),
    supersetItems: Joi.alternatives().conditional('isSuperset', {
        is: true,
        then: Joi.array().items(supersetExerciseSchema).length(2).required(),
        otherwise: Joi.forbidden().messages({
            'any.unknown': 'supersetItems is allowed only when isSuperset is true',
        }),
    }),
}).unknown(false);

const trainingPlanDaySchema = Joi.object({
    dayNumber: Joi.number().integer().min(1).max(7).optional(),
    items: Joi.array().items(trainingPlanItemSchema).required(),
}).unknown(false);

export const createStaticTrainingPlanSchema = Joi.object({
    name: Joi.string().trim().required(),
    subTitle: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    imageId: JoiCustomValidateObjectId('Image ID'),
    durationInMinutes: Joi.number().integer().positive().optional(),
    level: Joi.string().trim().optional(),
    days: Joi.array().length(7).items(trainingPlanDaySchema).required(),
}).unknown(false);

export const updateStaticTrainingPlanSchema = Joi.object({
    name: Joi.string().trim().optional(),
    subTitle: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    imageId: JoiCustomValidateObjectId('Image ID', true),
    durationInMinutes: Joi.number().integer().positive().optional(),
    level: Joi.string().trim().optional(),
    days: Joi.array().length(7).items(trainingPlanDaySchema).optional(),
})
    .or('name', 'subTitle', 'description', 'imageId', 'durationInMinutes', 'level', 'days')
    .unknown(false);

export const staticTrainingPlanParamSchema = Joi.object({
    planId: JoiCustomValidateObjectId('Static training plan ID'),
}).unknown(false);
