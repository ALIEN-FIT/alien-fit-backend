import { Router } from 'express';
import { getHealth, getLiveness, getReadiness } from './health.controller.js';

const router = Router();

/**
 * Health Check Routes
 * 
 * GET /health        - Comprehensive health status with service details
 * GET /health/live   - Liveness probe (is the app running?)
 * GET /health/ready  - Readiness probe (can the app accept traffic?)
 */

// Main health endpoint with full details
router.get('/', getHealth);

// Kubernetes liveness probe
router.get('/live', getLiveness);

// Kubernetes readiness probe
router.get('/ready', getReadiness);

export const healthRouter = router;
