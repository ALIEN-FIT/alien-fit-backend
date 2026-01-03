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
    await notificationQueue.add('send', data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
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
