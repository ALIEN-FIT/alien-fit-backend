import Joi from 'joi';
import { userValidationSchema } from '../../user/v1/user.validation.js';

// OTP-based authentication schemas
export const sendOTPForAuthSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?\d{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10-15 digits',
            'any.required': 'Phone number is required',
        }),
});

export const loginWithOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?\d{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10-15 digits',
            'any.required': 'Phone number is required',
        }),
    otp: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': 'OTP must be 6 digits',
            'string.pattern.base': 'OTP must contain only digits',
            'any.required': 'OTP is required',
        }),
});

export const registerWithOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?\d{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10-15 digits',
            'any.required': 'Phone number is required',
        }),
    otp: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': 'OTP must be 6 digits',
            'string.pattern.base': 'OTP must contain only digits',
            'any.required': 'OTP is required',
        }),
    name: userValidationSchema.extract('name'),
    password: userValidationSchema.extract('password').optional().messages({
        'string.min': 'Password must be at least 5 characters long',
        'string.max': 'Password must be at most 1024 characters long',
    }),
    height: userValidationSchema.extract('height'),
    weight: userValidationSchema.extract('weight'),
    age: userValidationSchema.extract('age'),
    gender: userValidationSchema.extract('gender'),
});

export const forgotPasswordSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?\d{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10-15 digits',
            'any.required': 'Phone number is required',
        }),
});

export const resetPasswordSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?\d{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10-15 digits',
            'any.required': 'Phone number is required',
        }),
    otp: Joi.string()
        .length(6)
        .pattern(/^\d{6}$/)
        .required()
        .messages({
            'string.length': 'OTP must be 6 digits',
            'string.pattern.base': 'OTP must contain only digits',
            'any.required': 'OTP is required',
        }),
    newPassword: Joi.string().min(8).required().messages({
        'string.min': 'New password must be at least 8 characters long',
        'any.required': 'New password is required',
    }),
});

// Legacy authentication schemas (kept for backward compatibility)
export const loginSchema = Joi.object({
    provider: userValidationSchema.extract('provider').messages({
        'any.required': 'Provider is required',
        'string.empty': 'Provider cannot be empty'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
        'string.empty': 'Password cannot be empty'
    })
});

export const registerSchema = userValidationSchema
    .fork(['role', 'isVerified'], schema => schema.forbidden())
    .keys({
        password: userValidationSchema.extract('password'),
        height: userValidationSchema.extract('height'),
        weight: userValidationSchema.extract('weight'),
        age: userValidationSchema.extract('age'),
        gender: userValidationSchema.extract('gender'),
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