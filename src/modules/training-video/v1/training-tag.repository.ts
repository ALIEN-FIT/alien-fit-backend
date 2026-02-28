import { Op, Transaction, WhereOptions } from 'sequelize';
import { sequelize } from '../../../database/db-config.js';
import { TrainingTagEntity } from './entity/training-video.entity.js';

const SEARCH_OPERATOR = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

export interface TrainingTagFilters {
    search?: string;
}

export interface TagPaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'title' | 'priority';
    sortDirection?: 'asc' | 'desc';
}

export class TrainingTagRepository {
    static createTag(
        payload: { title: string; description?: string | null; imageId: string; priority?: number },
        transaction?: Transaction,
    ) {
        return TrainingTagEntity.create(
            {
                title: payload.title,
                description: payload.description ?? null,
                imageId: payload.imageId,
                priority: payload.priority ?? 1,
            },
            { transaction },
        );
    }

    static findById(id: string) {
        return TrainingTagEntity.findByPk(id);
    }

    static async findByIds(ids: string[]): Promise<TrainingTagEntity[]> {
        if (!ids.length) {
            return [];
        }
        return TrainingTagEntity.findAll({ where: { id: ids } });
    }

    static async updateTag(
        id: string,
        payload: { title?: string; description?: string | null; imageId?: string; priority?: number },
        transaction?: Transaction,
    ) {
        const tag = await TrainingTagEntity.findByPk(id, { transaction });
        if (!tag) {
            return null;
        }

        await tag.update(
            {
                title: payload.title ?? tag.title,
                description: payload.description ?? tag.description,
                imageId: payload.imageId ?? tag.imageId,
                priority: payload.priority ?? tag.priority,
            },
            { transaction },
        );

        return tag;
    }

    static deleteTag(id: string, transaction?: Transaction) {
        return TrainingTagEntity.destroy({ where: { id }, transaction });
    }

    static async listTags(filters: TrainingTagFilters, pagination: TagPaginationOptions) {
        const where: WhereOptions = {};
        if (filters.search) {
            (where as any)[Op.or] = [
                { title: { [SEARCH_OPERATOR]: `%${filters.search}%` } },
                { description: { [SEARCH_OPERATOR]: `%${filters.search}%` } },
            ];
        }

        const limit = Number.isFinite(pagination.limit) && pagination.limit! > 0 ? Number(pagination.limit) : 25;
        const page = Number.isFinite(pagination.page) && pagination.page! > 0 ? Number(pagination.page) : 1;
        const offset = (page - 1) * limit;
        const order = [
            [pagination.sortBy ?? 'priority', (pagination.sortDirection ?? 'asc').toUpperCase()],
            ['title', 'ASC'],
        ];

        const { rows, count } = await TrainingTagEntity.findAndCountAll({
            where,
            limit,
            offset,
            order: order as any,
        });

        return {
            tags: rows,
            pagination: {
                page,
                limit,
                totalItems: count,
                totalPages: Math.ceil(count / limit) || 1,
            },
        };
    }
}
