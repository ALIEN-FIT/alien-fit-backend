import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const pricesSchema = Joi.object()
    // Dynamic currency keys (EGP, USD, etc). Allow future currencies.
    .pattern(/^[A-Z]{3,10}$/, Joi.number().positive().precision(2).required())
    .min(1)
    .required();

export const packageIdParamSchema = Joi.object({
    packageId: JoiCustomValidateObjectId('Package ID', true),
});

export const createSubscriptionPackageSchema = Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    description: Joi.string().trim().max(5000).allow('', null).optional(),
    prices: pricesSchema,
    features: Joi.array().items(Joi.string().trim().min(1).max(200)).default([]),
    cycles: Joi.number().integer().min(1).max(120).required(),
    isActive: Joi.boolean().optional(),
});

export const updateSubscriptionPackageSchema = Joi.object({
    packageId: JoiCustomValidateObjectId('Package ID', true),
    name: Joi.string().trim().min(2).max(120).optional(),
    description: Joi.string().trim().max(5000).allow('', null).optional(),
    prices: pricesSchema.optional(),
    features: Joi.array().items(Joi.string().trim().min(1).max(200)).optional(),
    cycles: Joi.number().integer().min(1).max(120).optional(),
    isActive: Joi.boolean().optional(),
}).or('name', 'description', 'prices', 'features', 'cycles', 'isActive');

export const currencyCodeParamSchema = Joi.object({
    code: Joi.string().trim().uppercase().pattern(/^[A-Z]{3,10}$/).required(),
});

export const upsertCurrencySchema = Joi.object({
    code: Joi.string().trim().uppercase().pattern(/^[A-Z]{3,10}$/).required(),
    isActive: Joi.boolean().default(true),
});

export const updateCurrencySchema = Joi.object({
    code: Joi.string().trim().uppercase().pattern(/^[A-Z]{3,10}$/).required(),
    isActive: Joi.boolean().required(),
});
