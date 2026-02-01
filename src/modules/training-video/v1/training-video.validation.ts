import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const tagIdsField = Joi.alternatives().try(
    Joi.array().items(JoiCustomValidateObjectId('Tag ID', false)).unique(),
    Joi.string().custom((value, helpers) => {
        if (typeof value !== 'string') {
            return helpers.error('string.base');
        }
        return value;
    }),
);

export const createTrainingVideoSchema = Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().allow('', null).optional(),
    videoUrl: Joi.string().required(),
    tagIds: tagIdsField.optional(),
}).unknown(false);

export const updateTrainingVideoSchema = Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().allow('', null).optional(),
    videoUrl: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    tagIds: tagIdsField.optional(),
})
    .min(1)
    .messages({ 'object.min': 'At least one field must be provided' });

export const trainingVideoParamSchema = Joi.object({
    videoId: JoiCustomValidateObjectId('Training video ID'),
});

export const listTrainingVideoQuerySchema = Joi.object({
    search: Joi.string().optional(),
    tagIds: tagIdsField.optional(),
    page: Joi.number().integer().positive().optional(),
    limit: Joi.number().integer().positive().optional(),
    sortBy: Joi.string().valid('createdAt', 'title').optional(),
    sortDirection: Joi.string().valid('asc', 'desc').optional(),
}).unknown(true);

export const createTrainingTagSchema = Joi.object({
    title: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().allow('', null).optional(),
    imageId: Joi.string().required(),
}).unknown(false);

export const updateTrainingTagSchema = Joi.object({
    title: Joi.string().trim().min(2).max(100).optional(),
    description: Joi.string().allow('', null).optional(),
    imageId: Joi.string().optional(),
})
    .min(1)
    .messages({ 'object.min': 'At least one field must be provided' });

export const trainingTagParamSchema = Joi.object({
    tagId: JoiCustomValidateObjectId('Training tag ID'),
});

export const listTrainingTagQuerySchema = Joi.object({
    search: Joi.string().optional(),
    page: Joi.number().integer().positive().optional(),
    limit: Joi.number().integer().positive().optional(),
    sortBy: Joi.string().valid('createdAt', 'title').optional(),
    sortDirection: Joi.string().valid('asc', 'desc').optional(),
}).unknown(true);

export const syncTrainingVideosSchema = Joi.object({
    returnUrl: Joi.string().uri().optional(),
}).unknown(false);
