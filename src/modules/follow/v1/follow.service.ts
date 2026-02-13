import { Op } from 'sequelize';
import { StatusCodes } from 'http-status-codes';
import { sequelize } from '../../../database/db-config.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserEntity, UserFollowEntity } from '../../user/v1/entity/user.entity.js';
import { UserService } from '../../user/v1/user.service.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';
import { BlockService } from '../../block/v1/block.service.js';

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

export class FollowService {
    static async toggleFollow(currentUser: UserEntity, targetUserId: string) {
        if (currentUser.id === targetUserId) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'You cannot follow yourself');
        }

        await BlockService.assertNotBlockedBetween(currentUser.id, targetUserId);

        const targetUser = await UserService.getUserById(targetUserId.toString());

        const transaction = await sequelize.transaction();
        try {
            const existing = await UserFollowEntity.findOne({
                where: { followerId: currentUser.id, followingId: targetUserId },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            let isFollowing = false;
            if (existing) {
                await existing.destroy({ transaction });
            } else {
                await UserFollowEntity.create({ followerId: currentUser.id, followingId: targetUserId }, { transaction });
                isFollowing = true;
            }

            await transaction.commit();

            const [targetFollowersCount, currentFollowingCount] = await Promise.all([
                countFollowers(targetUserId),
                countFollowing(currentUser.id),
            ]);

            const targetPlain = targetUser.get({ plain: true });
            targetPlain.isFollowing = isFollowing;

            return {
                isFollowing,
                followerId: currentUser.id,
                followingId: targetUserId,
                counts: {
                    targetFollowersCount,
                    currentFollowingCount,
                },
                user: targetPlain,
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async listFollowers(targetUserId: string, viewer: UserEntity | null, options: PaginationOptions = {}) {
        const targetUser = await UserService.getUserById(targetUserId);
        const { page, limit, offset } = normalizePagination(options);

        const viewerId = viewer?.id ?? null;
        if (viewerId && (await BlockService.isBlockedBetween(viewerId, targetUserId))) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        const blockedUserIds = viewerId ? await BlockService.getBlockedUserIdsFor(viewerId) : [];

        const { rows, count } = await UserFollowEntity.findAndCountAll({
            where: { followingId: targetUserId },
            include: [
                {
                    model: UserEntity,
                    as: 'follower',
                    ...(blockedUserIds.length ? { where: { id: { [Op.notIn]: blockedUserIds } } } : {}),
                    include: [
                        { model: MediaEntity, as: 'image' },
                        { model: MediaEntity, as: 'profileBackgroundImage' },
                    ],
                    required: true,
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        const followers = rows
            .map((row) => row.get('follower') as UserEntity | undefined)
            .filter((user): user is UserEntity => Boolean(user));

        const viewerFollowing = viewerId ? await getFollowingSet(viewerId, followers.map((f) => f.id)) : new Set<string>();
        const viewerFollowsTarget = viewerId ? await isUserFollowing(viewerId, targetUserId) : false;

        const items = followers.map((follower) => {
            const plain = follower.get({ plain: true }) as any;
            plain.isFollowing = viewerId ? viewerFollowing.has(follower.id) : false;
            return plain;
        });

        const targetPlain = targetUser.get({ plain: true }) as any;
        targetPlain.isFollowing = viewerFollowsTarget;
        targetPlain.followersCount = await countFollowers(targetUserId);
        targetPlain.followingCount = await countFollowing(targetUserId);

        return {
            user: targetPlain,
            followers: buildPaginatedResponse(items, count, page, limit),
        };
    }

    static async listFollowing(targetUserId: string, viewer: UserEntity | null, options: PaginationOptions = {}) {
        const targetUser = await UserService.getUserById(targetUserId);
        const { page, limit, offset } = normalizePagination(options);

        const viewerId = viewer?.id ?? null;
        if (viewerId && (await BlockService.isBlockedBetween(viewerId, targetUserId))) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        const blockedUserIds = viewerId ? await BlockService.getBlockedUserIdsFor(viewerId) : [];

        const { rows, count } = await UserFollowEntity.findAndCountAll({
            where: { followerId: targetUserId },
            include: [
                {
                    model: UserEntity,
                    as: 'following',
                    ...(blockedUserIds.length ? { where: { id: { [Op.notIn]: blockedUserIds } } } : {}),
                    include: [
                        { model: MediaEntity, as: 'image' },
                        { model: MediaEntity, as: 'profileBackgroundImage' },
                    ],
                    required: true,
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        const following = rows
            .map((row) => row.get('following') as UserEntity | undefined)
            .filter((user): user is UserEntity => Boolean(user));

        const viewerFollowing = viewerId ? await getFollowingSet(viewerId, following.map((f) => f.id)) : new Set<string>();
        const viewerFollowsTarget = viewerId ? await isUserFollowing(viewerId, targetUserId) : false;

        const items = following.map((followUser) => {
            const plain = followUser.get({ plain: true }) as any;
            plain.isFollowing = viewerId ? viewerFollowing.has(followUser.id) : false;
            return plain;
        });

        const targetPlain = targetUser.get({ plain: true }) as any;
        targetPlain.isFollowing = viewerFollowsTarget;
        targetPlain.followersCount = await countFollowers(targetUserId);
        targetPlain.followingCount = await countFollowing(targetUserId);

        return {
            user: targetPlain,
            following: buildPaginatedResponse(items, count, page, limit),
        };
    }
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

async function getFollowingSet(viewerId: string, candidateIds: string[]) {
    if (!candidateIds.length) {
        return new Set<string>();
    }
    const links = await UserFollowEntity.findAll({
        where: {
            followerId: viewerId,
            followingId: { [Op.in]: candidateIds },
        },
        attributes: ['followingId'],
    });
    return new Set(links.map((link) => link.followingId));
}

async function isUserFollowing(followerId: string, followingId: string) {
    const existing = await UserFollowEntity.count({
        where: { followerId, followingId },
    });
    return existing > 0;
}

async function countFollowers(userId: string) {
    return UserFollowEntity.count({ where: { followingId: userId } });
}

async function countFollowing(userId: string) {
    return UserFollowEntity.count({ where: { followerId: userId } });
}
