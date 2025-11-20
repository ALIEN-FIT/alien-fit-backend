import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const supersetExerciseSchema = Joi.object({
    title: Joi.string().required(),
    videoLink: Joi.string().uri().optional(),
}).unknown(false);

const trainingPlanItemSchema = Joi.object({
    title: Joi.string().required(),
    videoLink: Joi.string().uri().optional(),
    description: Joi.string().allow('', null).optional(),
    duration: Joi.number().integer().positive().optional(),
    repeats: Joi.number().integer().positive().optional(),
    isSuperset: Joi.boolean().optional(),
    supersetExercises: Joi.alternatives().conditional('isSuperset', {
        is: true,
        then: Joi.array().items(supersetExerciseSchema).length(2).required(),
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'supersetExercises is allowed only when isSuperset is true' }),
    }),
}).unknown(false);

const trainingPlanDaySchema = Joi.object({
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
