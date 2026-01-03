import { startNotificationWorker } from './notification.worker.js';
import { startNotificationCron } from './notification.cron.js';

export function startNotificationWorkers() {
    startNotificationWorker();
    startNotificationCron();
}
