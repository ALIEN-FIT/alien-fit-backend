import Joi from 'joi';

export const sendOTPSchema = Joi.object({
    phone: Joi.string()
        .pattern(/^\+?\d{10,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be between 10-15 digits',
            'any.required': 'Phone number is required',
        }),
});

export const verifyOTPSchema = Joi.object({
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
