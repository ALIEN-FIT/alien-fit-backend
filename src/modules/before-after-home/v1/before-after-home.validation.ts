import Joi from 'joi';

const nullableString = Joi.string().trim().allow(null, '');

export const beforeAfterHomeIdParamSchema = Joi.object({
    beforeAfterHomeId: Joi.string().uuid().required(),
});

export const createBeforeAfterHomeSchema = Joi.object({
    beforeImageId: Joi.string().uuid().required(),
    afterImageId: Joi.string().uuid().required(),
    title: nullableString.max(255).optional(),
    description: nullableString.max(2000).optional(),
    priority: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
    transformationTimeInDays: Joi.number().integer().min(1).required(),
});

export const updateBeforeAfterHomeSchema = Joi.object({
    beforeImageId: Joi.string().uuid().optional(),
    afterImageId: Joi.string().uuid().optional(),
    title: nullableString.max(255).optional(),
    description: nullableString.max(2000).optional(),
    priority: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
    transformationTimeInDays: Joi.number().integer().min(1).optional(),
}).or(
    'beforeImageId',
    'afterImageId',
    'title',
    'description',
    'priority',
    'isActive',
    'transformationTimeInDays',
);
