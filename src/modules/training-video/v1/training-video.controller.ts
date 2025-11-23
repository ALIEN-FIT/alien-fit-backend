import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TrainingVideoService, TrainingTagService } from './training-video.service.js';

export async function createTrainingVideoController(req: Request, res: Response) {
    const payload = {
        ...req.body,
        tagIds: normalizeBodyTagIds((req.body as any).tagIds),
    };
    const video = await TrainingVideoService.createVideo(req.user!, payload);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { video },
    });
}

export async function updateTrainingVideoController(req: Request, res: Response) {
    const payload = {
        ...req.body,
        tagIds: normalizeBodyTagIds((req.body as any).tagIds),
    };
    const video = await TrainingVideoService.updateVideo(req.user!, req.params.videoId, payload);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { video },
    });
}

export async function deleteTrainingVideoController(req: Request, res: Response) {
    const result = await TrainingVideoService.deleteVideo(req.user!, req.params.videoId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function getTrainingVideoController(req: Request, res: Response) {
    const video = await TrainingVideoService.getVideo(req.user!, req.params.videoId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { video },
    });
}

export async function listTrainingVideosController(req: Request, res: Response) {
    const filters = {
        search: toOptionalString(req.query.search),
        tagIds: toOptionalStringArray(req.query.tagIds),
    };

    const pagination = {
        page: toOptionalNumber(req.query.page),
        limit: toOptionalNumber(req.query.limit),
        sortBy: toSortField(req.query.sortBy),
        sortDirection: toSortDirection(req.query.sortDirection),
    } as const;

    const data = await TrainingVideoService.listVideos(req.user!, filters, pagination);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function createTrainingTagController(req: Request, res: Response) {
    const tag = await TrainingTagService.createTag(req.user!, req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { tag },
    });
}

export async function updateTrainingTagController(req: Request, res: Response) {
    const tag = await TrainingTagService.updateTag(req.user!, req.params.tagId, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { tag },
    });
}

export async function deleteTrainingTagController(req: Request, res: Response) {
    const result = await TrainingTagService.deleteTag(req.user!, req.params.tagId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function getTrainingTagController(req: Request, res: Response) {
    const tag = await TrainingTagService.getTag(req.user!, req.params.tagId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { tag },
    });
}

export async function listTrainingTagsController(req: Request, res: Response) {
    const filters = {
        search: toOptionalString(req.query.search),
    };

    const pagination = {
        page: toOptionalNumber(req.query.page),
        limit: toOptionalNumber(req.query.limit),
        sortBy: toTagSortField(req.query.sortBy),
        sortDirection: toSortDirection(req.query.sortDirection),
    } as const;

    const data = await TrainingTagService.listTags(req.user!, filters, pagination);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

function toOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
    const stringValue = toOptionalString(value);
    if (!stringValue) {
        return undefined;
    }
    const parsed = Number(stringValue);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalStringArray(value: unknown): string[] | undefined {
    if (!value) {
        return undefined;
    }
    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean);
    }
    return undefined;
}

function toSortField(value: unknown): 'createdAt' | 'title' | undefined {
    const stringValue = toOptionalString(value);
    if (stringValue === 'createdAt' || stringValue === 'title') {
        return stringValue;
    }
    return undefined;
}

function toTagSortField(value: unknown): 'createdAt' | 'title' | undefined {
    return toSortField(value);
}

function toSortDirection(value: unknown): 'asc' | 'desc' | undefined {
    const stringValue = toOptionalString(value);
    if (!stringValue) {
        return undefined;
    }
    return stringValue.toLowerCase() === 'asc' ? 'asc' : stringValue.toLowerCase() === 'desc' ? 'desc' : undefined;
}

function normalizeBodyTagIds(value: unknown): string[] | undefined {
    const parsed = toOptionalStringArray(value);
    return parsed?.length ? parsed : undefined;
}
