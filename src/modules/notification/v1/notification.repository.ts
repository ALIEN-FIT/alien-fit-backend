import { FindOptions, Op, WhereOptions } from 'sequelize';
import { NotificationEntity } from './entity/notification.entity.js';

export interface NotificationListFilters {
    isRead?: boolean;
    isSeen?: boolean;
}

export class NotificationRepository {
    static async create(data: {
        userId: string;
        byUserId?: string | null;
        type: string;
        title: string;
        body: string;
        isSeen?: boolean;
        isRead?: boolean;
    }) {
        return NotificationEntity.create({
            userId: data.userId,
            byUserId: data.byUserId ?? null,
            type: data.type,
            title: data.title,
            body: data.body,
            isSeen: data.isSeen ?? false,
            isRead: data.isRead ?? false,
        });
    }

    static async findById(id: string) {
        return NotificationEntity.findByPk(id);
    }

    static async listByUser(
        userId: string,
        filters: NotificationListFilters,
        pagination: { limit: number; offset: number }
    ) {
        const where: WhereOptions = { userId };
        if (typeof filters.isRead === 'boolean') {
            where.isRead = filters.isRead;
        }
        if (typeof filters.isSeen === 'boolean') {
            where.isSeen = filters.isSeen;
        }

        return NotificationEntity.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: pagination.limit,
            offset: pagination.offset,
        });
    }

    static async markSeen(id: string, userId: string) {
        return NotificationEntity.update(
            { isSeen: true },
            { where: { id, userId } }
        );
    }

    static async markRead(id: string, userId: string) {
        return NotificationEntity.update(
            { isRead: true, isSeen: true },
            { where: { id, userId } }
        );
    }

    static async markAllSeen(userId: string) {
        return NotificationEntity.update(
            { isSeen: true },
            { where: { userId, isSeen: false } }
        );
    }

    static async markAllRead(userId: string) {
        return NotificationEntity.update(
            { isRead: true, isSeen: true },
            { where: { userId, isRead: false } }
        );
    }
}
