import Joi from 'joi';
import { platform } from 'os';

export const uploadSchema = Joi.object({
    platform: Joi.string().required(),
    latestVersion: Joi.string().required(),
    minAllowedVersion: Joi.string().allow(null, ''),
    isMandatory: Joi.boolean().optional(),
    releaseNotes: Joi.any().optional(),
});

export const updateSchema = Joi.object({
    platform: Joi.string().optional(),
    latestVersion: Joi.string().optional(),
    minAllowedVersion: Joi.string().allow(null, '').optional(),
    isMandatory: Joi.boolean().optional(),
    releaseNotes: Joi.any().optional(),
});

export default {
    uploadSchema,
    updateSchema,
};
