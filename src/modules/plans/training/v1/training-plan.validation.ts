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

export const createTrainingPlanSchema = Joi.object({
    startDate: Joi.string().isoDate().optional(),
    days: Joi.array().length(7).items(trainingPlanDaySchema).required(),
});

export const trainingPlanUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});
