import { Op } from 'sequelize';
import { FeedbackEntity, FeedbackStatus, FeedbackType } from './feedback.entity.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';

interface PaginationOptions {
    limit: number;
    offset: number;
}

interface AdminSearchFilters {
    status?: FeedbackStatus;
    type?: FeedbackType;
    search?: string;
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
}

export class FeedbackRepository {
    static create(data: Partial<FeedbackEntity>) {
        return FeedbackEntity.create(data);
    }

    static findById(id: string) {
        return FeedbackEntity.findByPk(id);
    }

    static listByUser(userId: string, filters: Partial<AdminSearchFilters>, pagination: PaginationOptions) {
        const where: Record<string, unknown> = { userId };
        if (filters.status) where.status = filters.status;
        if (filters.type) where.type = filters.type;

        return FeedbackEntity.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: pagination.limit,
            offset: pagination.offset,
        });
    }

    static searchForAdmin(filters: AdminSearchFilters, pagination: PaginationOptions) {
        const where: Record<string, unknown> = {};

        if (filters.status) where.status = filters.status;
        if (filters.type) where.type = filters.type;
        if (filters.userId) where.userId = filters.userId;

        if (filters.fromDate || filters.toDate) {
            where.createdAt = {};
            if (filters.fromDate) (where.createdAt as any)[Op.gte] = filters.fromDate;
            if (filters.toDate) (where.createdAt as any)[Op.lte] = filters.toDate;
        }

        if (filters.search) {
            const pattern = `%${filters.search}%`;
            (where as any)[Op.or] = [
                { body: { [Op.iLike]: pattern } },
                { adminReply: { [Op.iLike]: pattern } },
                { guestName: { [Op.iLike]: pattern } },
                { guestPhone: { [Op.iLike]: pattern } },
            ];
        }

        return FeedbackEntity.findAndCountAll({
            where,
            include: [
                {
                    model: UserEntity,
                    as: 'user',
                    attributes: ['id', 'name', 'provider', 'role'],
                },
            ],
            order: [['createdAt', 'DESC']],
            limit: pagination.limit,
            offset: pagination.offset,
        });
    }
}
