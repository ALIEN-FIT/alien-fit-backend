import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

export const subscriptionUserParamSchema = Joi.object({
    userId: JoiCustomValidateObjectId('User ID', true),
});
