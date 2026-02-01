import { FindAndCountOptions, Op, Transaction, WhereOptions } from 'sequelize';
import { sequelize } from '../../../database/db-config.js';
import { TrainingTagEntity, TrainingVideoEntity } from './entity/training-video.entity.js';

const SEARCH_OPERATOR = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

export interface TrainingVideoFilters {
    search?: string;
    tagIds?: string[];
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'title';
    sortDirection?: 'asc' | 'desc';
}

export class TrainingVideoRepository {
    static async createVideo(
        payload: {
            title: string;
            description?: string | null;
            videoUrl: string;
            youtubeVideoId?: string | null;
            isActive?: boolean;
            tagIds?: string[];
        },
        transaction?: Transaction,
    ): Promise<TrainingVideoEntity> {
        const video = await TrainingVideoEntity.create(
            {
                title: payload.title,
                description: payload.description ?? null,
                videoUrl: payload.videoUrl,
                youtubeVideoId: payload.youtubeVideoId ?? null,
                isActive: payload.isActive ?? false,
            },
            { transaction },
        );

        if (payload.tagIds?.length) {
            await (video as any).setTags(payload.tagIds, { transaction });
        }

        return this.findById(video.id, transaction) as Promise<TrainingVideoEntity>;
    }

    static findById(id: string, transaction?: Transaction) {
        return TrainingVideoEntity.findByPk(id, {
            include: [
                {
                    model: TrainingTagEntity,
                    as: 'tags',
                    through: { attributes: [] },
                },
            ],
            transaction,
        });
    }

    static async findByIds(ids: string[], transaction?: Transaction): Promise<TrainingVideoEntity[]> {
        if (!ids.length) {
            return [];
        }

        return TrainingVideoEntity.findAll({
            where: { id: ids },
            include: [
                {
                    model: TrainingTagEntity,
                    as: 'tags',
                    through: { attributes: [] },
                },
            ],
            transaction,
        });
    }

    static async updateVideo(
        id: string,
        payload: {
            title?: string;
            description?: string | null;
            videoUrl?: string;
            isActive?: boolean;
            tagIds?: string[] | null;
        },
        transaction?: Transaction,
    ): Promise<TrainingVideoEntity | null> {
        const video = await TrainingVideoEntity.findByPk(id, { transaction });
        if (!video) {
            return null;
        }

        await video.update(
            {
                title: payload.title ?? video.title,
                description: payload.description ?? video.description,
                videoUrl: payload.videoUrl ?? video.videoUrl,
                isActive: payload.isActive ?? video.isActive,
            },
            { transaction },
        );

        if (payload.tagIds) {
            await (video as any).setTags(payload.tagIds, { transaction });
        }

        return this.findById(id, transaction) as Promise<TrainingVideoEntity>;
    }

    static async deleteVideo(id: string, transaction?: Transaction): Promise<number> {
        return TrainingVideoEntity.destroy({ where: { id }, transaction });
    }

    static findByYoutubeVideoId(youtubeVideoId: string, transaction?: Transaction) {
        return TrainingVideoEntity.findOne({ where: { youtubeVideoId }, transaction });
    }

    static findByVideoUrl(videoUrl: string, transaction?: Transaction) {
        return TrainingVideoEntity.findOne({ where: { videoUrl }, transaction });
    }

    static async listVideos(filters: TrainingVideoFilters, pagination: PaginationOptions, isAdmin: boolean) {
        const where: WhereOptions = {};
        if (!isAdmin) {
            (where as any).isActive = true;
        }
        if (filters.search) {
            (where as any)[Op.or] = [
                { title: { [SEARCH_OPERATOR]: `%${filters.search}%` } },
                { description: { [SEARCH_OPERATOR]: `%${filters.search}%` } },
            ];
        }

        const include: FindAndCountOptions['include'] = [
            {
                model: TrainingTagEntity,
                as: 'tags',
                through: { attributes: [] },
                required: Boolean(filters.tagIds?.length),
                where: filters.tagIds?.length ? { id: filters.tagIds } : undefined,
            },
        ];

        const limit = Number.isFinite(pagination.limit) && pagination.limit! > 0 ? Number(pagination.limit) : 20;
        const page = Number.isFinite(pagination.page) && pagination.page! > 0 ? Number(pagination.page) : 1;
        const offset = (page - 1) * limit;
        const order = [[pagination.sortBy ?? 'createdAt', (pagination.sortDirection ?? 'desc').toUpperCase()]];

        const { rows, count } = await TrainingVideoEntity.findAndCountAll({
            where,
            include,
            distinct: true,
            limit,
            offset,
            order: order as any,
        });

        return {
            videos: rows,
            pagination: {
                page,
                limit,
                totalItems: count,
                totalPages: Math.ceil(count / limit) || 1,
            },
        };
    }
}
