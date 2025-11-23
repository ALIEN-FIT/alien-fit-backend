import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { Roles } from '../../../constants/roles.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { TrainingVideoRepository, TrainingVideoFilters, PaginationOptions } from './training-video.repository.js';
import { TrainingTagRepository, TrainingTagFilters, TagPaginationOptions } from './training-tag.repository.js';
import { TrainingVideoEntity } from './entity/training-video.entity.js';

interface CreateTrainingVideoPayload {
    title: string;
    description?: string | null;
    videoUrl: string;
    tagIds?: string[];
}

interface UpdateTrainingVideoPayload {
    title?: string;
    description?: string | null;
    videoUrl?: string;
    tagIds?: string[];
}

export class TrainingVideoService {
    static async createVideo(actor: UserEntity, payload: CreateTrainingVideoPayload) {
        assertAdmin(actor);
        const uniqueTagIds = uniqueIds(payload.tagIds);
        await this.ensureTagsExist(uniqueTagIds);

        return TrainingVideoRepository.createVideo({
            title: payload.title,
            description: payload.description ?? null,
            videoUrl: payload.videoUrl,
            tagIds: uniqueTagIds,
        });
    }

    static async updateVideo(actor: UserEntity, videoId: string, payload: UpdateTrainingVideoPayload) {
        assertAdmin(actor);
        const uniqueTagIds = payload.tagIds ? uniqueIds(payload.tagIds) : undefined;
        if (uniqueTagIds) {
            await this.ensureTagsExist(uniqueTagIds);
        }

        const updated = await TrainingVideoRepository.updateVideo(videoId, {
            title: payload.title,
            description: payload.description,
            videoUrl: payload.videoUrl,
            tagIds: uniqueTagIds ?? null,
        });

        if (!updated) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training video not found');
        }

        return updated;
    }

    static async deleteVideo(actor: UserEntity, videoId: string) {
        assertAdmin(actor);
        const deleted = await TrainingVideoRepository.deleteVideo(videoId);
        if (!deleted) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training video not found');
        }
        return { deleted: true };
    }

    static async getVideo(actor: UserEntity, videoId: string) {
        assertAuthenticated(actor);
        const video = await TrainingVideoRepository.findById(videoId);
        if (!video) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training video not found');
        }
        return video;
    }

    static listVideos(actor: UserEntity, filters: TrainingVideoFilters, pagination: PaginationOptions) {
        assertAuthenticated(actor);
        return TrainingVideoRepository.listVideos(filters, pagination);
    }

    static async ensureVideosExist(ids: string[]): Promise<Map<string, TrainingVideoEntity>> {
        const unique = uniqueIds(ids);
        if (!unique.length) {
            return new Map();
        }

        const videos = await TrainingVideoRepository.findByIds(unique);
        if (videos.length !== unique.length) {
            const foundIds = new Set(videos.map((video) => video.id));
            const missing = unique.filter((id) => !foundIds.has(id));
            throw new HttpResponseError(
                StatusCodes.BAD_REQUEST,
                `Unknown training video ids: ${missing.join(', ')}`,
            );
        }

        const map = new Map<string, TrainingVideoEntity>();
        videos.forEach((video) => {
            map.set(video.id, video);
        });
        return map;
    }

    private static async ensureTagsExist(tagIds?: string[]) {
        if (!tagIds?.length) {
            return;
        }
        const tags = await TrainingTagRepository.findByIds(tagIds);
        if (tags.length !== tagIds.length) {
            const foundIds = new Set(tags.map((tag) => tag.id));
            const missing = tagIds.filter((id) => !foundIds.has(id));
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown tag ids: ${missing.join(', ')}`);
        }
    }
}

interface CreateTrainingTagPayload {
    title: string;
    description?: string | null;
    imageId: string;
}

interface UpdateTrainingTagPayload {
    title?: string;
    description?: string | null;
    imageId?: string;
}

export class TrainingTagService {
    static createTag(actor: UserEntity, payload: CreateTrainingTagPayload) {
        assertAdmin(actor);
        return TrainingTagRepository.createTag(payload);
    }

    static async updateTag(actor: UserEntity, tagId: string, payload: UpdateTrainingTagPayload) {
        assertAdmin(actor);
        const tag = await TrainingTagRepository.updateTag(tagId, payload);
        if (!tag) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training tag not found');
        }
        return tag;
    }

    static async deleteTag(actor: UserEntity, tagId: string) {
        assertAdmin(actor);
        const deleted = await TrainingTagRepository.deleteTag(tagId);
        if (!deleted) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training tag not found');
        }
        return { deleted: true };
    }

    static async getTag(actor: UserEntity, tagId: string) {
        assertAuthenticated(actor);
        const tag = await TrainingTagRepository.findById(tagId);
        if (!tag) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training tag not found');
        }
        return tag;
    }

    static listTags(actor: UserEntity, filters: TrainingTagFilters, pagination: TagPaginationOptions) {
        assertAuthenticated(actor);
        return TrainingTagRepository.listTags(filters, pagination);
    }
}

function uniqueIds(ids?: string[]): string[] {
    return ids ? Array.from(new Set(ids)) : [];
}

function assertAdmin(actor: UserEntity) {
    if (!actor || actor.role !== Roles.ADMIN) {
        throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can perform this action');
    }
}

function assertAuthenticated(actor: UserEntity) {
    if (!actor) {
        throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Authentication required');
    }
}
