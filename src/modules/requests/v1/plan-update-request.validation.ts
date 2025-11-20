import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const payloadSchema = Joi.object().unknown(true);

export const
    createPlanUpdateRequestSchema = Joi.object({
        payload: payloadSchema.optional(),
        notes: Joi.string().max(500).optional(),
    });

export const listPlanUpdateRequestSchema = Joi.object({
    status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
});

export const approvePlanUpdateRequestSchema = Joi.object({
    requestId: JoiCustomValidateObjectId('Request ID', true),
});
