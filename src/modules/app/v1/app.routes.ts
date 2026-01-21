import express from 'express';
import { getLatestVersion, updateVersion } from './app.controller.js';
import appUploadMiddleware from '../../../middleware/app-upload.middleware.js';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { uploadSchema, updateSchema } from './app.validation.js';

export const appRouterV1 = express.Router();

// Admin update metadata (no file) - useful for iOS
appRouterV1.put('/platforms/:platform',
    auth,
    authorizeRoles(Roles.ADMIN),
    validateRequest(updateSchema),
    updateVersion
);

// Public get version metadata
appRouterV1.get('/platforms/:platform/latest', getLatestVersion);
