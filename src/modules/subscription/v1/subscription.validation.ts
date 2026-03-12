import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

export const subscriptionUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});

export const subscriptionActivateSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
    cycles: Joi.number().integer().min(1).max(120).optional(),
    packageId: JoiCustomValidateObjectId('Package ID', true).optional(),
}).oxor('cycles', 'packageId');

export const subscriptionRenewSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
    cycles: Joi.number().integer().min(1).max(120).optional(),
    packageId: JoiCustomValidateObjectId('Package ID', true).optional(),
}).oxor('cycles', 'packageId');

export const subscriptionFreezeRequestSchema = Joi.object({
    requestedDays: Joi.number().integer().min(1).max(365).required(),
    note: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const subscriptionDefrostRequestSchema = Joi.object({
    note: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const subscriptionApproveFreezeRequestSchema = Joi.object({
    requestId: JoiCustomValidateObjectId('Freeze request ID', true),
    freezeDays: Joi.number().integer().min(1).max(365).allow(null).optional(),
    note: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const subscriptionDeclineFreezeRequestSchema = Joi.object({
    requestId: JoiCustomValidateObjectId('Freeze request ID', true),
    note: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const subscriptionApproveDefrostRequestSchema = Joi.object({
    requestId: JoiCustomValidateObjectId('Defrost request ID', true),
    note: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const subscriptionDeclineDefrostRequestSchema = Joi.object({
    requestId: JoiCustomValidateObjectId('Defrost request ID', true),
    note: Joi.string().trim().max(1000).allow('', null).optional(),
});

export const subscriptionAdminDefrostSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});

export const subscriptionCheckoutSchema = Joi.object({
    packageId: JoiCustomValidateObjectId('Package ID', true),
    planType: Joi.string().valid('diet', 'training', 'both').required(),
    currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3,10}$/).required(),
    redirectionUrls: Joi.object({
        successUrl: Joi.string().uri().optional(),
        failUrl: Joi.string().uri().optional(),
        pendingUrl: Joi.string().uri().optional(),
    }).optional(),
});

// Fawaterak webhook (paid/failed) validation (minimal fields we need)
export const fawaterakWebhookSchema = Joi.object({
    hashKey: Joi.string().required(),
    invoice_key: Joi.string().required(),
    invoice_id: Joi.number().required(),
    payment_method: Joi.string().required(),
    invoice_status: Joi.string().optional(),
    pay_load: Joi.any().optional(),
    referenceNumber: Joi.any().optional(),
    amount: Joi.any().optional(),
    paidCurrency: Joi.any().optional(),
    errorMessage: Joi.any().optional(),
}).unknown(true);
