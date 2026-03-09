import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    getUserProfileController,
    createOrUpdateUserProfileController,
    deleteUserProfileController
} from './user-profile.controller.js';
import {
    getUserProfileSchema,
    createUpdateUserProfileSchema
} from './user-profile.validation.js';
import { Roles } from '../../../constants/roles.js';

export const userProfileRouterV1 = express.Router();

// All routes require authentication
userProfileRouterV1.use(auth);

// Routes for current user's profile
userProfileRouterV1.get('/me', getUserProfileController);
userProfileRouterV1.post('/me', validateRequest(createUpdateUserProfileSchema), createOrUpdateUserProfileController);
userProfileRouterV1.patch('/me', validateRequest(createUpdateUserProfileSchema), createOrUpdateUserProfileController);
userProfileRouterV1.delete('/me', deleteUserProfileController);

// Routes for specific user's profile (can be used by admins)
userProfileRouterV1.use(authorizeRoles(Roles.ADMIN));

userProfileRouterV1.get('/:userId', validateRequest(getUserProfileSchema), getUserProfileController);
userProfileRouterV1.post('/:userId', validateRequest(createUpdateUserProfileSchema), createOrUpdateUserProfileController);
userProfileRouterV1.patch('/:userId', validateRequest(createUpdateUserProfileSchema.concat(getUserProfileSchema)), createOrUpdateUserProfileController);
userProfileRouterV1.delete('/:userId', validateRequest(getUserProfileSchema), deleteUserProfileController);
