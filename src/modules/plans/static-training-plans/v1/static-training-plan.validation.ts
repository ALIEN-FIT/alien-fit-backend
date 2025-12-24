import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../../utils/joi-custom-validate-object-id.js';

const trainingGroupItemSchema = Joi.object({
    trainingVideoId: JoiCustomValidateObjectId('Training video ID'),
    title: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    repeats: Joi.number().integer().positive().optional(),
    duration: Joi.number().integer().positive().optional(),
}).unknown(false);

const trainingTypeSchema = Joi.string().valid('REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT').required();

const regularTrainingSchema = Joi.object({
    type: Joi.string().valid('REGULAR').required(),
    trainingVideoId: JoiCustomValidateObjectId('Training video ID'),
    title: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    sets: Joi.number().integer().positive().optional(),
    repeats: Joi.number().integer().positive().optional(),
    duration: Joi.number().integer().positive().optional(),
    config: Joi.object().optional(),
}).unknown(false);

const groupTrainingSchema = Joi.object({
    type: trainingTypeSchema.invalid('REGULAR'),
    title: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    sets: Joi.number().integer().positive().optional(),
    repeats: Joi.number().integer().positive().optional(),
    duration: Joi.number().integer().positive().optional(),
    items: Joi.array().items(trainingGroupItemSchema).min(1).required(),
    config: Joi.object().optional(),
}).unknown(false);

const circuitTrainingSchema = groupTrainingSchema.keys({
    type: Joi.string().valid('CIRCUIT').required(),
    config: Joi.object({
        rounds: Joi.number().integer().positive().required(),
    })
        .unknown(true)
        .required(),
});

const supersetTrainingSchema = groupTrainingSchema.keys({
    type: Joi.string().valid('SUPERSET').required(),
    items: Joi.array().items(trainingGroupItemSchema).min(2).required(),
});

const dropsetTrainingSchema = groupTrainingSchema.keys({
    type: Joi.string().valid('DROPSET').required(),
    items: Joi.array().items(trainingGroupItemSchema).min(2).required(),
});

const staticTrainingSchema = Joi.alternatives().try(
    regularTrainingSchema,
    supersetTrainingSchema,
    dropsetTrainingSchema,
    circuitTrainingSchema,
);

export const createStaticTrainingPlanSchema = Joi.object({
    name: Joi.string().trim().required(),
    subTitle: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    imageId: JoiCustomValidateObjectId('Image ID'),
    durationInMinutes: Joi.number().integer().positive().optional(),
    level: Joi.string().trim().optional(),
    trainings: Joi.array().items(staticTrainingSchema).min(1).required(),
}).unknown(false);

export const updateStaticTrainingPlanSchema = Joi.object({
    name: Joi.string().trim().optional(),
    subTitle: Joi.string().trim().optional(),
    description: Joi.string().trim().optional(),
    imageId: JoiCustomValidateObjectId('Image ID', true),
    durationInMinutes: Joi.number().integer().positive().optional(),
    level: Joi.string().trim().optional(),
    trainings: Joi.array().items(staticTrainingSchema).min(1).optional(),
})
    .or('name', 'subTitle', 'description', 'imageId', 'durationInMinutes', 'level', 'trainings')
    .unknown(false);

export const staticTrainingPlanParamSchema = Joi.object({
    planId: JoiCustomValidateObjectId('Static training plan ID'),
}).unknown(false);

export const listStaticTrainingPlansQuerySchema = Joi.object({
    search: Joi.string().trim().optional(),
    page: Joi.number().integer().positive().optional(),
    limit: Joi.number().integer().positive().max(100).optional(),
}).unknown(true);
