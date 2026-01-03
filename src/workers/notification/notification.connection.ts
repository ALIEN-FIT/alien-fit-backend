import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

// BullMQ recommends `maxRetriesPerRequest: null`
export function createBullConnection() {
    return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
