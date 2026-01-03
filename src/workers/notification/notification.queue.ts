import { Queue } from 'bullmq';
import { createBullConnection } from './notification.connection.js';

export const notificationQueue = new Queue('notifications', {
    connection: createBullConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    },
});
