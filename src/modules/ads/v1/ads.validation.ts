import Joi from 'joi';
import { DiscountTypes } from './entity/ad.entity.js';

const isoDate = Joi.string().isoDate();

export const adIdParamSchema = Joi.object({
    adId: Joi.string().uuid().required(),
});

export const createAdSchema = Joi.object({
    imageId: Joi.string().uuid().required(),
    appName: Joi.string().min(2).max(255).required(),
    link: Joi.string().uri().allow(null, '').optional(),
    promoCode: Joi.string().max(100).allow(null, '').optional(),
    discountAmount: Joi.number().precision(2).min(0).required(),
    discountType: Joi.string().valid(DiscountTypes.PERCENTAGE, DiscountTypes.FIXED).required(),
    startDate: isoDate.required(),
    endDate: isoDate.required(),
    priority: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
}).custom((value, helpers) => {
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return helpers.error('any.invalid');
    }
    if (end.getTime() < start.getTime()) {
        return helpers.message({ custom: 'endDate must be after startDate' });
    }
    return value;
});

export const updateAdSchema = Joi.object({
    adId: Joi.string().uuid().required(),
    imageId: Joi.string().uuid().optional(),
    appName: Joi.string().min(2).max(255).optional(),
    link: Joi.string().uri().allow(null, '').optional(),
    promoCode: Joi.string().max(100).allow(null, '').optional(),
    discountAmount: Joi.number().precision(2).min(0).optional(),
    discountType: Joi.string().valid(DiscountTypes.PERCENTAGE, DiscountTypes.FIXED).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    priority: Joi.number().integer().min(0).optional(),
    isActive: Joi.boolean().optional(),
}).custom((value, helpers) => {
    if (value.startDate || value.endDate) {
        const start = value.startDate ? new Date(value.startDate) : undefined;
        const end = value.endDate ? new Date(value.endDate) : undefined;
        if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
            return helpers.error('any.invalid');
        }
        if (start && end && end.getTime() < start.getTime()) {
            return helpers.message({ custom: 'endDate must be after startDate' });
        }
    }
    return value;
});
