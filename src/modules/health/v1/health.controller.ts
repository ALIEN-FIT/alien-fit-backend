import { Request, Response } from 'express';
import { healthService } from './health.service.js';
import { StatusCodes } from 'http-status-codes';

/**
 * GET /health
 * Comprehensive health check endpoint
 * Returns detailed status of all services
 */
export async function getHealth(req: Request, res: Response) {
    const health = await healthService.getHealthStatus();

    const statusCode = health.status === 'healthy'
        ? StatusCodes.OK
        : health.status === 'degraded'
            ? StatusCodes.OK
            : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(statusCode).json(health);
}

/**
 * GET /health/live
 * Kubernetes liveness probe endpoint
 * Returns 200 if the app is running (even if dependencies are down)
 */
export async function getLiveness(req: Request, res: Response) {
    const status = await healthService.getLivenessStatus();
    res.status(StatusCodes.OK).json(status);
}

/**
 * GET /health/ready
 * Kubernetes readiness probe endpoint
 * Returns 200 only if app can accept traffic (all dependencies healthy)
 */
export async function getReadiness(req: Request, res: Response) {
    const status = await healthService.getReadinessStatus();

    const statusCode = status.ready
        ? StatusCodes.OK
        : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(statusCode).json(status);
}
