import Joi from 'joi';
import { userValidationSchema } from '../../user/v1/user.validation.js';

const phoneOnlyProviderSchema = Joi.string()
    .trim()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required()
    .messages({
        'string.base': 'Provider must be a string',
        'string.empty': 'Provider cannot be empty',
        'string.pattern.base': 'Provider must be a valid mobile number',
        'any.required': 'Provider is required',
    });

export const loginSchema = Joi.object({
    provider: phoneOnlyProviderSchema,
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
        'string.empty': 'Password cannot be empty'
    })
});

export const registerSchema = userValidationSchema
    .fork(['role', 'isVerified'], schema => schema.forbidden())
    .keys({
        provider: phoneOnlyProviderSchema,
        password: userValidationSchema.extract('password'),
        otp: Joi.string().trim().length(6).required().messages({
            'any.required': 'OTP is required',
            'string.empty': 'OTP cannot be empty',
            'string.length': 'OTP must be 6 digits'
        }),
        height: userValidationSchema.extract('height'),
        weight: userValidationSchema.extract('weight'),
        age: userValidationSchema.extract('age'),
        gender: userValidationSchema.extract('gender'),
    });

export const requestOtpSchema = Joi.object({
    provider: phoneOnlyProviderSchema,
});

export const forgotPasswordRequestOtpSchema = Joi.object({
    provider: phoneOnlyProviderSchema,
});

export const forgotPasswordResetSchema = Joi.object({
    provider: phoneOnlyProviderSchema,
    otp: Joi.string().trim().length(6).required().messages({
        'any.required': 'OTP is required',
        'string.empty': 'OTP cannot be empty',
        'string.length': 'OTP must be 6 digits'
    }),
    newPassword: Joi.string().required().messages({
        'any.required': 'New password is required',
        'string.empty': 'New password cannot be empty'
    }),
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Refresh token is required',
        'string.empty': 'Refresh token cannot be empty'
    })
});

export const logoutSchema = refreshTokenSchema;

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required',
        'string.empty': 'Current password cannot be empty'
    }),
    newPassword: Joi.string().required().messages({
        'any.required': 'New password is required',
        'string.empty': 'New password cannot be empty'
    })
});

export const updateMeSchema = userValidationSchema
    .fork(['provider', 'password', 'role', 'isVerified'], schema => schema.forbidden())
    .keys({
        name: userValidationSchema.extract('name').optional(),
        height: userValidationSchema.extract('height'),
        weight: userValidationSchema.extract('weight'),
        age: userValidationSchema.extract('age'),
        imageId: userValidationSchema.extract('imageId').optional(),
        profileBackgroundImageId: userValidationSchema.extract('profileBackgroundImageId').optional(),
        isProfileComplete: userValidationSchema.extract('isProfileComplete').optional(),
    });