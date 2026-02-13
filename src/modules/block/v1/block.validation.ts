import Joi from 'joi';

const uuidSchema = Joi.string().guid({ version: ['uuidv4'] });

const paginationQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
});

export const toggleBlockSchema = Joi.object({
    userId: uuidSchema.required(),
});

export const listBlockedSchema = paginationQuerySchema;
