import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { Roles } from '../../../constants/roles.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { TrainingVideoRepository, TrainingVideoFilters, PaginationOptions } from './training-video.repository.js';
import { TrainingTagRepository, TrainingTagFilters, TagPaginationOptions } from './training-tag.repository.js';
import { TrainingVideoEntity } from './entity/training-video.entity.js';
import { generateYouTubeAuthUrl, getYouTubeClient, hasYouTubeAuthConfigured } from '../../../config/youtube-client.js';
import { env } from '../../../config/env.js';
import { createSignedState } from '../../../utils/signed-state.js';
import { clearYouTubeStoredTokens } from '../../../config/youtube-token-store.js';

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
    isActive?: boolean;
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
            isActive: payload.isActive,
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
        if (actor.role !== Roles.ADMIN && !video.isActive) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training video not found');
        }
        return video;
    }

    static listVideos(actor: UserEntity, filters: TrainingVideoFilters, pagination: PaginationOptions) {
        assertAuthenticated(actor);
        const isAdmin = actor.role === Roles.ADMIN;
        return TrainingVideoRepository.listVideos(filters, pagination, isAdmin);
    }

    static async syncFromYouTube(actor: UserEntity, options?: { returnUrl?: string }) {
        assertAdmin(actor);

        if (!hasYouTubeAuthConfigured()) {
            const returnUrl = options?.returnUrl || env.APP_URL;
            const exp = Date.now() + 10 * 60 * 1000;
            const secret = env.YOUTUBE_OAUTH_STATE_SECRET ?? env.JWT_PRIVATE_KEY;
            const signed = createSignedState({ returnUrl, exp }, secret);
            const authUrl = generateYouTubeAuthUrl(signed.state);

            return {
                requiresAuth: true as const,
                authUrl,
            };
        }

        let uploads: YouTubeUploadItem[];
        try {
            uploads = await fetchYouTubeUploads();
        } catch (e: any) {
            if (isInvalidGrantError(e)) {
                await clearYouTubeStoredTokens();

                const returnUrl = options?.returnUrl || env.APP_URL;
                const exp = Date.now() + 10 * 60 * 1000;
                const secret = env.YOUTUBE_OAUTH_STATE_SECRET ?? env.JWT_PRIVATE_KEY;
                const signed = createSignedState({ returnUrl, exp }, secret);
                const authUrl = generateYouTubeAuthUrl(signed.state);

                return {
                    requiresAuth: true as const,
                    authUrl,
                };
            }

            throw e;
        }

        let added = 0;
        let skipped = 0;

        for (const item of uploads) {
            const existingByYoutubeId = await TrainingVideoRepository.findByYoutubeVideoId(item.youtubeVideoId);
            if (existingByYoutubeId) {
                skipped += 1;
                continue;
            }

            const existingByUrl = await TrainingVideoRepository.findByVideoUrl(item.videoUrl);
            if (existingByUrl) {
                skipped += 1;
                continue;
            }

            await TrainingVideoRepository.createVideo({
                title: item.title,
                description: item.description ?? null,
                videoUrl: item.videoUrl,
                youtubeVideoId: item.youtubeVideoId,
                isActive: false,
            });

            added += 1;
        }

        return {
            requiresAuth: false as const,
            added,
            skipped,
            total: uploads.length,
        };
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
    priority?: number;
}

interface UpdateTrainingTagPayload {
    title?: string;
    description?: string | null;
    imageId?: string;
    priority?: number;
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

interface YouTubeUploadItem {
    youtubeVideoId: string;
    title: string;
    description?: string | null;
    videoUrl: string;
}

async function fetchYouTubeUploads(): Promise<YouTubeUploadItem[]> {
    const youtube = getYouTubeClient();

    const channels = await youtube.channels.list({
        part: ['contentDetails'],
        mine: true,
    });

    const channel = channels.data.items?.[0];
    const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'No uploads playlist found for the channel');
    }

    const results: YouTubeUploadItem[] = [];
    let nextPageToken: string | undefined;

    do {
        const page = await youtube.playlistItems.list({
            part: ['snippet', 'contentDetails'],
            playlistId: uploadsPlaylistId,
            maxResults: 50,
            pageToken: nextPageToken,
        });

        for (const item of page.data.items ?? []) {
            const youtubeVideoId = item.contentDetails?.videoId;
            const title = item.snippet?.title?.trim();
            if (!youtubeVideoId || !title) {
                continue;
            }

            results.push({
                youtubeVideoId,
                title,
                description: item.snippet?.description ?? null,
                videoUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
            });
        }

        nextPageToken = page.data.nextPageToken ?? undefined;
    } while (nextPageToken);

    return results;
}

function isInvalidGrantError(error: any): boolean {
    const message = typeof error?.message === 'string' ? error.message : '';
    const responseError = error?.response?.data?.error;
    return message.includes('invalid_grant') || responseError === 'invalid_grant';
}
