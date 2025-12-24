import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const stringListField = (label: string) => Joi.array().items(Joi.string()).allow(null).optional().messages({
    'array.base': `${label} must be an array of strings`,
});

const preferredFoodSchema = Joi.object({
    meats: stringListField('Meats'),
    carbs: stringListField('Carbs'),
    fruits: stringListField('Fruits'),
    vegetables: stringListField('Vegetables'),
    dairy: stringListField('Dairy'),
    legumes: stringListField('Legumes'),
    mealsCount: Joi.number().integer().min(0).allow(null).optional().messages({
        'number.base': 'Meals count must be a number',
    }),
    snacksCount: Joi.number().integer().min(0).allow(null).optional().messages({
        'number.base': 'Snacks count must be a number',
    }),
    others: stringListField('Others'),
})
    .allow(null)
    .optional()
    .messages({
        'object.base': 'Preferred food must be an object',
    });

const trainingSchema = Joi.object({
    teamSport: stringListField('Team sport'),
    individualSports: stringListField('Individual sports'),
    combatSports: stringListField('Combat sports'),
    strengthAndFitness: stringListField('Strength & Fitness'),
    waterSports: stringListField('Water sports'),
    outdoorAndExtreme: stringListField('Outdoor & Extreme'),
    winterSports: stringListField('Winter sports'),
    other: stringListField('Other'),
})
    .allow(null)
    .optional()
    .messages({
        'object.base': 'Training must be an object',
    });

export const userProfileSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),

    whatDoYouWantToAchieve: Joi.string().allow(null).optional().messages({
        'string.base': 'What do you want to achieve must be a string',
    }),
    goal: Joi.string().allow(null).optional().messages({
        'string.base': 'Goal must be a string',
    }),
    activityLevel: Joi.string().allow(null).optional().messages({
        'string.base': 'Activity level must be a string',
    }),
    trainingLevel: Joi.string().allow(null).optional().messages({
        'string.base': 'Training level must be a string',
    }),
    bodyFat: Joi.string().allow(null).optional().messages({
        'string.base': 'Body fat must be a string',
    }),
    trainingSite: Joi.string().allow(null).optional().messages({
        'string.base': 'Training site must be a string',
    }),
    preferredWorkoutTime: Joi.object().pattern(Joi.string(), Joi.string()).allow(null).optional().messages({
        'object.base': 'Preferred workout time must be an object',
    }),
    tools: Joi.array().items(Joi.string()).allow(null).optional().messages({
        'array.base': 'Tools must be an array of strings',
    }),
    injuries: Joi.array().items(Joi.string()).allow(null).optional().messages({
        'array.base': 'Injuries must be an array of strings',
    }),
    diseases: Joi.array().items(Joi.string()).allow(null).optional().messages({
        'array.base': 'Diseases must be an array of strings',
    }),
    workOutBefore: Joi.boolean().allow(null).optional().messages({
        'boolean.base': 'workOutBefore must be a boolean',
    }),
    useSupplements: Joi.boolean().allow(null).optional().messages({
        'boolean.base': 'useSupplements must be a boolean',
    }),
    intolerances: Joi.array().items(Joi.string()).allow(null).optional().messages({
        'array.base': 'Intolerances must be an array of strings',
    }),
    preferredFood: preferredFoodSchema,
    training: trainingSchema,
    bodyImages: Joi.array().items(Joi.string()).allow(null).optional().messages({
        'array.base': 'Body images must be an array of strings',
    }),
});

export const createUpdateUserProfileSchema = userProfileSchema;

export const getUserProfileSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});