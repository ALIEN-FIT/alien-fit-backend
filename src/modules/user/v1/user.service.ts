import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { UserEntity } from './entity/user.entity.js';
import { isStrongPassword } from '../../../utils/password.utils.js';
import { ForeignKeyConstraintError, Op } from 'sequelize';
import { MediaEntity } from '../../media/v1/model/media.model.js';


interface PaginateOptions {
    page?: number;
    limit?: number;
}

interface PaginationResult {
    users: UserEntity[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export class UserService {

    static getUserByProvider(provider: string) {
        return UserEntity.findOne({ where: { provider } });
    }

    static async createUser(userData: Partial<UserEntity>): Promise<UserEntity> {
        const existingUser = await UserEntity.findOne({ where: { provider: userData.provider } });
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this provider already exists');
        }

        if (userData.password && !isStrongPassword(userData.password)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }

        await validateMediaIdIfProvided(userData.imageId, 'Image not found');
        await validateMediaIdIfProvided(userData.profileBackgroundImageId, 'Profile background image not found');

        const user = new UserEntity(userData);
        await user.save();
        return this.getUserById(user.id.toString());
    }

    static async getUserById(userId: string | number, scope = 'default'): Promise<UserEntity> {
        const include = [
            { model: MediaEntity, as: 'image' },
            { model: MediaEntity, as: 'profileBackgroundImage' },
        ];
        let user: UserEntity;
        if (scope !== 'default') {
            user = await UserEntity.scope(scope).findByPk(userId, { include });
        } else {
            user = await UserEntity.findByPk(userId, { include });
        }
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }
        return user;
    }

    static async updateUser(userId: string, updateData: Partial<UserEntity>): Promise<UserEntity> {
        const user = await UserEntity.findByPk(userId);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        await validateMediaIdIfProvided(updateData.imageId, 'Image not found');
        await validateMediaIdIfProvided(updateData.profileBackgroundImageId, 'Profile background image not found');

        await user.update(updateData);
        return this.getUserById(user.id.toString());
    }


    static async deleteUser(userId: string): Promise<UserEntity> {
        const user = await UserEntity.findByPk(userId);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }
        try {
            await user.destroy();
            return user;
        } catch (error) {
            if (error instanceof ForeignKeyConstraintError) {
                throw new HttpResponseError(
                    StatusCodes.CONFLICT,
                    'Cannot delete user because related records exist (plans, requests, sessions, or profiles). Remove dependencies first.'
                );
            }
            throw error;
        }
    }

    static async getUsersByFilter(
        filter: any = {},
        options: PaginateOptions = {}
    ): Promise<PaginationResult> {
        const { page = 1, limit = 10 } = options;
        const skip = (Number(page) - 1) * Number(limit);
        if (filter.name) {
            filter.name = { [Op.iLike]: `%${filter.name}%` }; // Partial, case-insensitive match
        }
        if (filter.provider) {
            filter.provider = { [Op.iLike]: `%${filter.provider}%` }; // Partial, case-insensitive match
        }
        // Handle numeric filters for height and weight
        if (filter.height) {
            filter.height = Number(filter.height);
        }
        if (filter.weight) {
            filter.weight = Number(filter.weight);
        }

        const [users, total] = await Promise.all([
            UserEntity.findAll({
                where: filter,
                offset: skip,
                limit: Number(limit)
            }),
            UserEntity.count({ where: filter })
        ]);

        if (!users.length) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'No users found with the given filter');
        }

        return {
            users,
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
        };
    }
}

async function validateMediaIdIfProvided(mediaId: string | null | undefined, errorMessage: string) {
    if (mediaId === undefined || mediaId === null) {
        return;
    }
    const media = await MediaEntity.findByPk(mediaId);
    if (!media) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, errorMessage);
    }
}