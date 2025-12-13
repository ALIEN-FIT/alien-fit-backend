import Joi from 'joi';

const querySchema = Joi.object({
    query: Joi.string().trim().min(1).max(1500).required(),
});

export const nutritionQuerySchema = querySchema;
export const recipeQuerySchema = querySchema;
