import { Op } from 'sequelize';
import { StatusCodes } from 'http-status-codes';
import { sequelize } from '../../../database/db-config.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { UserService } from '../../user/v1/user.service.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';
import { UserBlockEntity } from './entity/user-block.entity.js';

interface PaginationOptions {
    page?: number;
    limit?: number;
}

interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

function normalizePagination(options: PaginationOptions = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    let limit = Number(options.limit) || 10;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

function buildPaginatedResponse<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    return { items, total, page, limit, totalPages };
}

export class BlockService {
    static async toggleBlock(currentUser: UserEntity, targetUserId: string) {
        if (currentUser.id === targetUserId) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'You cannot block yourself');
        }

        await UserService.getUserById(targetUserId);

        const transaction = await sequelize.transaction();
        try {
            const existing = await UserBlockEntity.findOne({
                where: { blockerId: currentUser.id, blockedId: targetUserId },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            let isBlocked = true;
            if (existing) {
                await existing.destroy({ transaction });
                isBlocked = false;
            } else {
                await UserBlockEntity.create({ blockerId: currentUser.id, blockedId: targetUserId }, { transaction });
            }

            await transaction.commit();
            return {
                isBlocked,
                blockerId: currentUser.id,
                blockedId: targetUserId,
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async listBlocked(currentUser: UserEntity, options: PaginationOptions = {}) {
        const { page, limit, offset } = normalizePagination(options);

        const { rows, count } = await UserBlockEntity.findAndCountAll({
            where: { blockerId: currentUser.id },
            include: [
                {
                    model: UserEntity,
                    as: 'blocked',
                    required: true,
                    include: [
                        { model: MediaEntity, as: 'image' },
                        { model: MediaEntity, as: 'profileBackgroundImage' },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
            offset,
            limit,
        });

        const items = rows
            .map((row) => row.get('blocked') as UserEntity | undefined)
            .filter((u): u is UserEntity => Boolean(u))
            .map((u) => u.get({ plain: true }));

        return buildPaginatedResponse(items, count, page, limit);
    }

    static async isBlockedBetween(userAId: string, userBId: string): Promise<boolean> {
        if (userAId === userBId) return false;

        const count = await UserBlockEntity.count({
            where: {
                [Op.or]: [
                    { blockerId: userAId, blockedId: userBId },
                    { blockerId: userBId, blockedId: userAId },
                ],
            },
        });

        return count > 0;
    }

    static async assertNotBlockedBetween(userAId: string, userBId: string) {
        const blocked = await this.isBlockedBetween(userAId, userBId);
        if (blocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'User is blocked');
        }
    }

    static async getBlockedUserIdsFor(userId: string): Promise<string[]> {
        const links = await UserBlockEntity.findAll({
            where: {
                [Op.or]: [{ blockerId: userId }, { blockedId: userId }],
            },
            attributes: ['blockerId', 'blockedId'],
        });

        const ids = new Set<string>();
        for (const link of links) {
            const blockerId = link.get('blockerId') as string;
            const blockedId = link.get('blockedId') as string;
            if (blockerId && blockerId !== userId) ids.add(blockerId);
            if (blockedId && blockedId !== userId) ids.add(blockedId);
        }

        return Array.from(ids);
    }
}
