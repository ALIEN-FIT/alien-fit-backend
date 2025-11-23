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
        otherwise: Joi.forbidden().messages({ 'any.unknown': 'supersetItems is allowed only when isSuperset is true' }),
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
