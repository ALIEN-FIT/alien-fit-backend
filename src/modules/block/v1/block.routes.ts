import express from 'express';
import { auth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { toggleBlockController, listBlockedController } from './block.controller.js';
import { toggleBlockSchema, listBlockedSchema } from './block.validation.js';

export const blockRouterV1 = express.Router();

blockRouterV1.use(auth);

blockRouterV1.post('/:userId/toggle', validateRequest(toggleBlockSchema), toggleBlockController);
blockRouterV1.get('/me', validateRequest(listBlockedSchema), listBlockedController);
