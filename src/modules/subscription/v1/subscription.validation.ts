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

export const subscriptionCheckoutSchema = Joi.object({
    packageId: JoiCustomValidateObjectId('Package ID', true),
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
