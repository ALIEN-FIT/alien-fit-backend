import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';
import { BeforeAfterHomeEntity } from './entity/before-after-home.entity.js';

interface CreateBeforeAfterHomePayload {
    beforeImageId: string;
    afterImageId: string;
    title?: string | null;
    description?: string | null;
    priority?: number;
    isActive?: boolean;
    transformationTimeInDays: number;
}

interface UpdateBeforeAfterHomePayload {
    beforeAfterHomeId: string;
    beforeImageId?: string;
    afterImageId?: string;
    title?: string | null;
    description?: string | null;
    priority?: number;
    isActive?: boolean;
    transformationTimeInDays?: number;
}

function normalizeNullableString(value: unknown): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }
    return value as string;
}

async function validateImageMediaId(mediaId: string, errorMessage: string): Promise<void> {
    const media = await MediaEntity.findByPk(mediaId);
    if (!media || media.mediaType !== 'image') {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, errorMessage);
    }
}

export class BeforeAfterHomeService {
    static async listActive(): Promise<BeforeAfterHomeEntity[]> {
        return BeforeAfterHomeEntity.findAll({
            where: { isActive: true },
            order: [
                ['priority', 'DESC'],
                ['createdAt', 'DESC'],
            ],
            include: [
                { model: MediaEntity, as: 'beforeImage' },
                { model: MediaEntity, as: 'afterImage' },
            ],
        });
    }

    static async adminListAll(): Promise<BeforeAfterHomeEntity[]> {
        return BeforeAfterHomeEntity.findAll({
            order: [
                ['isActive', 'DESC'],
                ['priority', 'DESC'],
                ['createdAt', 'DESC'],
            ],
            include: [
                { model: MediaEntity, as: 'beforeImage' },
                { model: MediaEntity, as: 'afterImage' },
            ],
        });
    }

    static async adminGetById(beforeAfterHomeId: string): Promise<BeforeAfterHomeEntity> {
        const item = await BeforeAfterHomeEntity.findByPk(beforeAfterHomeId, {
            include: [
                { model: MediaEntity, as: 'beforeImage' },
                { model: MediaEntity, as: 'afterImage' },
            ],
        });

        if (!item) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Before after home item not found');
        }

        return item;
    }

    static async adminCreate(payload: CreateBeforeAfterHomePayload): Promise<BeforeAfterHomeEntity> {
        await Promise.all([
            validateImageMediaId(payload.beforeImageId, 'Before image not found or is not an image'),
            validateImageMediaId(payload.afterImageId, 'After image not found or is not an image'),
        ]);

        const item = await BeforeAfterHomeEntity.create({
            beforeImageId: payload.beforeImageId,
            afterImageId: payload.afterImageId,
            title: normalizeNullableString(payload.title),
            description: normalizeNullableString(payload.description),
            priority: payload.priority ?? 0,
            isActive: payload.isActive ?? true,
            transformationTimeInDays: payload.transformationTimeInDays,
        });

        return this.adminGetById(item.id);
    }

    static async adminUpdate(payload: UpdateBeforeAfterHomePayload): Promise<BeforeAfterHomeEntity> {
        const item = await BeforeAfterHomeEntity.findByPk(payload.beforeAfterHomeId);
        if (!item) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Before after home item not found');
        }

        if (payload.beforeImageId !== undefined) {
            await validateImageMediaId(payload.beforeImageId, 'Before image not found or is not an image');
        }

        if (payload.afterImageId !== undefined) {
            await validateImageMediaId(payload.afterImageId, 'After image not found or is not an image');
        }

        const patch: Record<string, unknown> = {};
        if (payload.beforeImageId !== undefined) patch.beforeImageId = payload.beforeImageId;
        if (payload.afterImageId !== undefined) patch.afterImageId = payload.afterImageId;
        if (payload.title !== undefined) patch.title = normalizeNullableString(payload.title);
        if (payload.description !== undefined) patch.description = normalizeNullableString(payload.description);
        if (payload.priority !== undefined) patch.priority = payload.priority;
        if (payload.isActive !== undefined) patch.isActive = payload.isActive;
        if (payload.transformationTimeInDays !== undefined) {
            patch.transformationTimeInDays = payload.transformationTimeInDays;
        }

        await item.update(patch);
        return this.adminGetById(item.id);
    }

    static async adminDelete(beforeAfterHomeId: string): Promise<void> {
        const item = await BeforeAfterHomeEntity.findByPk(beforeAfterHomeId);
        if (!item) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Before after home item not found');
        }

        await item.destroy();
    }
}
