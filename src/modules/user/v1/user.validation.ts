import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';
import { Roles } from '../../../constants/roles.js';
import { Gender } from '../../../constants/gender.js';

export const userValidationSchema = Joi.object({
    provider: Joi.string().min(6).max(255).required()
        .pattern(/^(\+?[1-9]\d{1,14}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/)
        .messages({
            'string.base': 'Provider must be a string',
            'string.empty': 'Provider cannot be empty',
            'string.min': 'Provider must be at least 6 characters long',
            'string.max': 'Provider must be at most 255 characters long',
            'string.pattern.base': 'Provider must be a valid mobile number or email address',
            'any.required': 'Provider is required',
        }),
    password: Joi.string().min(5).max(1024).required().messages({
        'string.base': 'Password must be a string',
        'string.empty': 'Password cannot be empty',
        'string.min': 'Password must be at least 5 characters long',
        'string.max': 'Password must be at most 1024 characters long',
        'any.required': 'Password is required',
    }),
    name: Joi.string().min(5).max(30).required().messages({
        'string.base': 'User name must be a string',
        'string.empty': 'User name cannot be empty',
        'string.min': 'User name must be at least 3 characters long',
        'string.max': 'User name must be at most 30 characters long',
        'any.required': 'User name is required',
    }),
    role: Joi.string().valid(...Object.values(Roles)).default(Roles.USER).messages({
        'string.base': 'Role must be a string',
        'any.only': `Role must be one of ${Object.values(Roles).join(', ')}`,
        'any.default': `Role defaults to '${Roles.USER}' if not specified`
    }),
    height: Joi.number().integer().min(50).max(300).optional().messages({
        'number.base': 'Height must be a number',
        'number.integer': 'Height must be an integer',
        'number.min': 'Height must be at least 50 cm',
        'number.max': 'Height cannot exceed 300 cm'
    }),
    weight: Joi.number().integer().min(20).max(500).optional().messages({
        'number.base': 'Weight must be a number',
        'number.integer': 'Weight must be an integer',
        'number.min': 'Weight must be at least 20 kg',
        'number.max': 'Weight cannot exceed 500 kg'
    }),
    age: Joi.number().integer().min(0).optional().messages({
        'number.base': 'Age must be a number',
        'number.integer': 'Age must be an integer',
        'number.min': 'Age must be at least 0'
    }),
    gender: Joi.string().valid(...Object.values(Gender)).optional().messages({
        'string.base': 'Gender must be a string',
        'any.only': `Gender must be one of: ${Object.values(Gender).join(', ')}`
    }),
    isProfileComplete: Joi.boolean().optional().messages({
        'boolean.base': 'isProfileCompleted must be a boolean',
    }),
    isVerified: Joi.boolean().optional().messages({
        'boolean.base': 'isVerified must be a boolean',
    }),
    isBlocked: Joi.boolean().optional().messages({
        'boolean.base': 'isBlocked must be a boolean',
    }),
    imageId: Joi.string().uuid().allow(null).optional().messages({
        'string.base': 'Image ID must be a string',
        'string.guid': 'Image ID must be a valid UUID'
    }),
    profileBackgroundImageId: Joi.string().uuid().allow(null).optional().messages({
        'string.base': 'Profile background image ID must be a string',
        'string.guid': 'Profile background image ID must be a valid UUID'
    }),
    freeDays: Joi.number().integer().min(0).max(365).optional().messages({
        'number.base': 'Free days must be a number',
        'number.integer': 'Free days must be an integer',
        'number.min': 'Free days must be at least 0',
        'number.max': 'Free days cannot exceed 365'
    })
});

export const createUserSchema = userValidationSchema;
export const updateUserSchema = userValidationSchema
    .fork(['password', 'provider'], schema => schema.optional())
    .append({
        id: JoiCustomValidateObjectId('ID', false)
    });

export const deleteUserSchema = Joi.object({
    id: JoiCustomValidateObjectId('ID', false)
});

export const getUserByIdSchema = Joi.object({
    id: JoiCustomValidateObjectId('ID', false)
});

export const getUsersByFilterSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional().messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).optional().messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    provider: Joi.string().trim().optional().messages({
        'string.base': 'Provider must be a string'
    }),
    name: Joi.string().trim().optional().messages({
        'string.base': 'Name must be a string'
    }),
    role: Joi.string().valid(...Object.values(Roles)).optional().messages({
        'any.only': `Role must be one of: ${Object.values(Roles).join(', ')}`
    }),
    height: Joi.number().integer().min(50).max(300).optional().messages({
        'number.base': 'Height must be a number',
        'number.integer': 'Height must be an integer',
        'number.min': 'Height must be at least 50 cm',
        'number.max': 'Height cannot exceed 300 cm'
    }),
    weight: Joi.number().integer().min(20).max(500).optional().messages({
        'number.base': 'Weight must be a number',
        'number.integer': 'Weight must be an integer',
        'number.min': 'Weight must be at least 20 kg',
        'number.max': 'Weight cannot exceed 500 kg'
    }),
    birthDate: Joi.date().optional().messages({
        'date.base': 'Birth date must be a valid date'
    }),
    isVerified: Joi.boolean().optional().messages({
        'boolean.base': 'isVerified must be a boolean'
    }),
    isBlocked: Joi.boolean().optional().messages({
        'boolean.base': 'isBlocked must be a boolean'
    })
}).unknown(false);