import { StatusCodes } from 'http-status-codes';
import { Op } from 'sequelize';
import { HttpResponseError } from '../../../utils/appError.js';
import { NotificationRepository } from './notification.repository.js';
import { NotificationType, NotificationTypes } from '../../../constants/notification-type.js';
import { enqueueBroadcastNotification, enqueueUserNotification } from '../../../utils/notification.utils.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { SubscriptionEntity } from '../../subscription/v1/entity/subscription.entity.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';
import { Roles } from '../../../constants/roles.js';
import { errorLogger } from '../../../config/logger.config.js';

export const ADMIN_CHAT_NOTIFICATION_DISPLAY_NAME = 'coach mahmoud ali';

interface ListInput {
    page?: number;
    limit?: number;
    isRead?: boolean;
    isSeen?: boolean;
}

export class NotificationService {
    static async buildChatMessageNotificationPreview(content?: string | null, mediaIds?: string[] | null) {
        const trimmed = typeof content === 'string' ? content.trim() : '';
        if (trimmed) {
            return trimmed.slice(0, 280);
        }

        const sanitizedMediaIds = Array.isArray(mediaIds)
            ? mediaIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            : [];

        if (!sanitizedMediaIds.length) {
            return 'New message';
        }

        const media = await MediaEntity.findAll({
            where: { id: { [Op.in]: [...new Set(sanitizedMediaIds)] } },
            attributes: ['mediaType'],
        });

        const mediaTypes = [...new Set(media.map((item) => String(item.mediaType)))];
        if (!mediaTypes.length) {
            return sanitizedMediaIds.length === 1 ? '[Attachment]' : `[${sanitizedMediaIds.length} attachments]`;
        }

        if (mediaTypes.length === 1) {
            return buildSingleTypeAttachmentPreview(mediaTypes[0], sanitizedMediaIds.length);
        }

        return `[${sanitizedMediaIds.length} attachments: ${mediaTypes.join(', ')}]`;
    }

    static async notifyUserAboutAdminMessage(payload: {
        userId: string;
        adminId?: string | null;
        preview: string;
        // Used to deep-link the user straight into the chat when they tap the push.
        chatId?: string;
    }) {
        await enqueueUserNotification({
            userId: payload.userId,
            byUserId: payload.adminId ?? null,
            type: NotificationTypes.ADMIN_MESSAGE,
            title: `New message from ${ADMIN_CHAT_NOTIFICATION_DISPLAY_NAME}`,
            body: payload.preview,
            data: payload.chatId ? { route: 'chat', chatId: payload.chatId } : undefined,
        });
    }

    static async notifyAdminsAndTrainers(payload: {
        type: NotificationType;
        title: string;
        body: string;
        byUserId?: string | null;
        excludeUserId?: string;
        // When true, only notify admins/trainers if the related user (byUserId)
        // currently has an active subscription. Used to keep admins focused on
        // paying members and silence noise from non-subscribers.
        onlyIfSubscriber?: boolean;
        // Optional deep-link hints forwarded into the FCM data payload so the
        // admin/trainer app can open the relevant screen on tap (e.g. the chat).
        data?: Record<string, string>;
    }) {
        try {
            if (payload.onlyIfSubscriber) {
                if (!payload.byUserId) {
                    return;
                }
                const subscriber = await SubscriptionEntity.findOne({
                    where: { userId: payload.byUserId, isSubscribed: true },
                    attributes: ['id'],
                });
                if (!subscriber) {
                    return;
                }
            }

            const where: Record<string, unknown> = {
                role: {
                    [Op.in]: [Roles.ADMIN, Roles.TRAINER],
                },
            };

            if (payload.excludeUserId) {
                where.id = { [Op.ne]: payload.excludeUserId };
            }

            const recipients = await UserEntity.findAll({
                where,
                attributes: ['id'],
            });

            if (recipients.length === 0) {
                return;
            }

            // Enrich the deep-link payload with the sender's identity so the
            // admin/trainer app can open the right chat and render the peer's
            // name/avatar immediately (no flash of "User" while it loads).
            // userId is intentionally the SENDER (byUserId), used by the app as
            // the chat peer. All FCM data values must be strings.
            let data = payload.data;
            if (payload.byUserId) {
                const sender = await UserEntity.findByPk(payload.byUserId, {
                    attributes: ['id', 'name', 'gender', 'imageId'],
                    include: [{ model: MediaEntity, as: 'image', attributes: ['url'] }],
                });
                if (sender) {
                    const avatarUrl = (sender as unknown as { image?: { url?: string } }).image?.url;
                    data = {
                        ...payload.data,
                        userId: String(sender.id),
                        senderName: sender.name,
                        ...(sender.gender ? { gender: sender.gender } : {}),
                        ...(sender.imageId ? { imageId: sender.imageId } : {}),
                        ...(avatarUrl ? { avatarUrl } : {}),
                    };
                }
            }

            await Promise.all(
                recipients.map((recipient) =>
                    enqueueUserNotification({
                        userId: String(recipient.id),
                        byUserId: payload.byUserId ?? null,
                        type: payload.type,
                        title: payload.title,
                        body: payload.body,
                        data,
                    })
                )
            );
        } catch (err) {
            errorLogger.error('Failed to notify admins/trainers', err);
        }
    }

    static async getMyUnseenCount(userId: string) {
        const count = await NotificationRepository.countUnseenByUser(userId);
        return { count };
    }

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

function buildSingleTypeAttachmentPreview(mediaType: string, count: number) {
    const normalizedType = mediaType.trim().toLowerCase();

    if (count === 1) {
        return `[${capitalize(normalizedType)}]`;
    }

    const pluralByType: Record<string, string> = {
        image: 'images',
        video: 'videos',
        audio: 'audio files',
        document: 'documents',
    };

    return `[${count} ${pluralByType[normalizedType] ?? 'attachments'}]`;
}

function capitalize(value: string) {
    if (!value) {
        return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}
