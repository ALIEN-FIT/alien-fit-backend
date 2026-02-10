import { Router } from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    setDefaultFreeDaysController,
    setDefaultTrainingPlanController,
    setDefaultDietPlanController,
    setUserFreeDaysController,
    getAllSettingsController,
} from './admin-settings.controller.js';
import {
    setDefaultFreeDaysSchema,
    setDefaultDietPlanSchema,
    setDefaultTrainingPlanSchema,
    setUserFreeDaysSchema,
} from './admin-settings.validation.js';
import { Roles } from '../../../constants/roles.js';

const adminSettingsRouter = Router();

// All routes require authentication and admin role
adminSettingsRouter.use(auth);
adminSettingsRouter.use(authorizeRoles(Roles.ADMIN));

adminSettingsRouter.post('/free-days/default', validateRequest(setDefaultFreeDaysSchema), setDefaultFreeDaysController);
adminSettingsRouter.post('/training-plan/default', validateRequest(setDefaultTrainingPlanSchema), setDefaultTrainingPlanController);
adminSettingsRouter.post('/diet-plan/default', validateRequest(setDefaultDietPlanSchema), setDefaultDietPlanController);
adminSettingsRouter.post('/user/free-days', validateRequest(setUserFreeDaysSchema), setUserFreeDaysController);
adminSettingsRouter.get('/', getAllSettingsController);

export default adminSettingsRouter;
