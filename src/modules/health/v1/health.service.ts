import { redis } from '../../../config/redis.js';
import { sequelize } from '../../../database/db-config.js';

export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    services: {
        database: ServiceHealth;
        redis: ServiceHealth;
    };
    version: string;
    environment: string;
}

export interface ServiceHealth {
    status: 'up' | 'down';
    latency?: number;
    error?: string;
}

export class HealthService {
    private startTime: Date;

    constructor() {
        this.startTime = new Date();
    }

    /**
     * Get comprehensive health status of all services
     */
    async getHealthStatus(): Promise<HealthStatus> {
        const [dbHealth, redisHealth] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
        ]);

        const allHealthy = dbHealth.status === 'up' && redisHealth.status === 'up';
        const allDown = dbHealth.status === 'down' && redisHealth.status === 'down';

        return {
            status: allHealthy ? 'healthy' : allDown ? 'unhealthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
            services: {
                database: dbHealth,
                redis: redisHealth,
            },
            version: process.env.APP_VERSION || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
        };
    }

    /**
     * Simple liveness check - just confirms the app is running
     */
    async getLivenessStatus(): Promise<{ status: 'ok'; timestamp: string }> {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Readiness check - confirms app can accept traffic
     */
    async getReadinessStatus(): Promise<{ ready: boolean; timestamp: string }> {
        const [dbHealth, redisHealth] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
        ]);

        return {
            ready: dbHealth.status === 'up' && redisHealth.status === 'up',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Check PostgreSQL database connectivity
     */
    private async checkDatabase(): Promise<ServiceHealth> {
        const startTime = Date.now();
        try {
            await sequelize.authenticate();
            return {
                status: 'up',
                latency: Date.now() - startTime,
            };
        } catch (error) {
            return {
                status: 'down',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Database connection failed',
            };
        }
    }

    /**
     * Check Redis connectivity
     */
    private async checkRedis(): Promise<ServiceHealth> {
        const startTime = Date.now();
        try {
            const pong = await redis.ping();
            if (pong === 'PONG') {
                return {
                    status: 'up',
                    latency: Date.now() - startTime,
                };
            }
            return {
                status: 'down',
                latency: Date.now() - startTime,
                error: 'Redis ping failed',
            };
        } catch (error) {
            return {
                status: 'down',
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Redis connection failed',
            };
        }
    }
}

// Singleton instance
export const healthService = new HealthService();
