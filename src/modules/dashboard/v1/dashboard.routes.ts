import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { Roles } from '../../../constants/roles.js';
import { getAdminDashboardStatsController } from './dashboard.controller.js';

export const dashboardRouterV1 = express.Router();

dashboardRouterV1.use(auth, authorizeRoles(Roles.ADMIN));

dashboardRouterV1.get('/admin/stats', getAdminDashboardStatsController);
