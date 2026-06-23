import { notificationQueue } from '../workers/notification/notification.queue.js';
import { NotificationType } from '../constants/notification-type.js';

export interface SendNotificationJobData {
    userId: string;
    byUserId: string | null;
    type: NotificationType;
    title: string;
    body: string;
}

export interface BroadcastNotificationJobData {
    byUserId: string | null;
    type: NotificationType;
    title: string;
    body: string;
    filters: {
        isSubscribed?: boolean;
        gender?: string;
    };
}

export async function enqueueUserNotification(data: SendNotificationJobData) {
    // attempts: 1 — the worker (handleSend) is responsible for tolerating push
    // failures itself. Whole-job retries are unsafe here because they re-create
    // the in-app notification AND re-deliver the push to devices that already
    // got it, which was the root cause of the duplicate (5x) notifications.
    await notificationQueue.add('send', data, {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
    });
}

export async function enqueueBroadcastNotification(data: BroadcastNotificationJobData) {
    await notificationQueue.add('broadcast', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
    });
}
