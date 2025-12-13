import Joi from 'joi';
import { FEEDBACK_TYPES } from './feedback.entity.js';
import { SupportTicketStatus } from '../../../constants/support-ticket-status.js';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

export const createFeedbackSchema = Joi.object({
    type: Joi.string().valid(...FEEDBACK_TYPES).required(),
    body: Joi.string().trim().min(5).max(2000).required(),
    guestName: Joi.string().trim().min(3).max(120).optional(),
    guestPhone: Joi.string().trim().min(6).max(50).optional(),
});

export const listMyFeedbackSchema = Joi.object({
    status: Joi.string().valid(...Object.values(SupportTicketStatus)).optional(),
    type: Joi.string().valid(...FEEDBACK_TYPES).optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
});

export const adminSearchFeedbackSchema = Joi.object({
    status: Joi.string().valid(...Object.values(SupportTicketStatus)).optional(),
    type: Joi.string().valid(...FEEDBACK_TYPES).optional(),
    search: Joi.string().trim().max(255).optional(),
    userId: JoiCustomValidateObjectId('User ID', true),
    fromDate: Joi.date().iso().optional(),
    toDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
});

export const respondToFeedbackSchema = Joi.object({
    feedbackId: JoiCustomValidateObjectId('Feedback ID', true),
    status: Joi.string().valid(...Object.values(SupportTicketStatus)).optional(),
    reply: Joi.string().trim().min(1).max(2000).optional(),
}).or('status', 'reply');
