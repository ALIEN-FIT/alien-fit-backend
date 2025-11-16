import { Redis } from 'ioredis';
import { env } from './env.js';
import { errorLogger, infoLogger } from './logger.config.js';

export const redis = new Redis(env.REDIS_URL);

redis.on('connect', () => {
    infoLogger.info('Redis connection established');
});

redis.on('error', (error) => {
    errorLogger.error('Redis connection error', error);
    process.exit(1);
});
