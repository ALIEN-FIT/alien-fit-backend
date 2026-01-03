import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { NotificationRepository } from './notification.repository.js';
import { NotificationType } from '../../../constants/notification-type.js';
import { enqueueBroadcastNotification, enqueueUserNotification } from '../../../utils/notification.utils.js';

interface ListInput {
    page?: number;
    limit?: number;
    isRead?: boolean;
    isSeen?: boolean;
}

export class NotificationService {
    static async listMyNotifications(userId: string, input: ListInput) {
        const page = Number.isFinite(input.page) ? Math.max(Math.floor(input.page!), 1) : 1;
        const limit = Number.isFinite(input.limit) ? Math.max(Math.floor(input.limit!), 1) : 20;
        const safeLimit = Math.min(limit, 100);
        const offset = (page - 1) * safeLimit;

        const { rows, count } = await NotificationRepository.listByUser(
            userId,
            { isRead: input.isRead, isSeen: input.isSeen },
            { limit: safeLimit, offset }
        );

        return {
            items: rows,
            meta: {
                total: count,
                page,
                limit: safeLimit,
                totalPages: count === 0 ? 0 : Math.ceil(count / safeLimit),
            },
        };
    }

    static async markSeen(userId: string, notificationId: string) {
        const [updated] = await NotificationRepository.markSeen(notificationId, userId);
        if (!updated) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Notification not found');
        }
    }

    static async markRead(userId: string, notificationId: string) {
        const [updated] = await NotificationRepository.markRead(notificationId, userId);
        if (!updated) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Notification not found');
        }
    }

    static async markAllSeen(userId: string) {
        await NotificationRepository.markAllSeen(userId);
    }

    static async markAllRead(userId: string) {
        await NotificationRepository.markAllRead(userId);
    }

    static async sendToUser(payload: {
        userId: string;
        type: NotificationType;
        title: string;
        body: string;
        byUserId?: string | null;
    }) {
        await enqueueUserNotification({
            userId: payload.userId,
            byUserId: payload.byUserId ?? null,
            type: payload.type,
            title: payload.title,
            body: payload.body,
        });
    }

    static async broadcastAsAdmin(payload: {
        adminId: string;
        type: NotificationType;
        title: string;
        body: string;
        filters?: {
            isSubscribed?: boolean;
            gender?: string;
        };
    }) {
        await enqueueBroadcastNotification({
            type: payload.type,
            title: payload.title,
            body: payload.body,
            byUserId: payload.adminId,
            filters: payload.filters ?? {},
        });
    }
}
