import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { BeforeAfterHomeService } from './before-after-home.service.js';

interface SerializedMedia {
    id: string;
    url: string;
    originalName: string | null;
    contentType: string;
    mediaType: string;
    size: number | null;
    thumbnails: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

interface BeforeAfterHomeResponse {
    id: string;
    beforeImageId: string;
    beforeImage: SerializedMedia | null;
    afterImageId: string;
    afterImage: SerializedMedia | null;
    title: string | null;
    description: string | null;
    priority: number;
    isActive: boolean;
    transformationTimeInDays: number;
    createdAt: Date;
    updatedAt: Date;
}

function serializeMedia(media: SerializedMedia | null | undefined): SerializedMedia | null {
    if (!media) {
        return null;
    }

    return media;
}

function serializeBeforeAfterHome(item: { toJSON: () => BeforeAfterHomeResponse }): BeforeAfterHomeResponse {
    const json = item.toJSON();
    return {
        id: json.id,
        beforeImageId: json.beforeImageId,
        beforeImage: serializeMedia(json.beforeImage),
        afterImageId: json.afterImageId,
        afterImage: serializeMedia(json.afterImage),
        title: json.title ?? null,
        description: json.description ?? null,
        priority: json.priority,
        isActive: json.isActive,
        transformationTimeInDays: json.transformationTimeInDays,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
    };
}

export async function listActiveBeforeAfterHomesController(req: Request, res: Response): Promise<void> {
    const items = await BeforeAfterHomeService.listActive();
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { beforeAfterHomes: items.map(serializeBeforeAfterHome) },
    });
}

export async function adminListBeforeAfterHomesController(req: Request, res: Response): Promise<void> {
    const items = await BeforeAfterHomeService.adminListAll();
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { beforeAfterHomes: items.map(serializeBeforeAfterHome) },
    });
}

export async function adminGetBeforeAfterHomeController(req: Request, res: Response): Promise<void> {
    const { beforeAfterHomeId } = req.params;
    const item = await BeforeAfterHomeService.adminGetById(beforeAfterHomeId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { beforeAfterHome: serializeBeforeAfterHome(item) },
    });
}

export async function adminCreateBeforeAfterHomeController(req: Request, res: Response): Promise<void> {
    const item = await BeforeAfterHomeService.adminCreate(req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { beforeAfterHome: serializeBeforeAfterHome(item) },
    });
}

export async function adminUpdateBeforeAfterHomeController(req: Request, res: Response): Promise<void> {
    const { beforeAfterHomeId } = req.params;
    const item = await BeforeAfterHomeService.adminUpdate({ ...req.body, beforeAfterHomeId });
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { beforeAfterHome: serializeBeforeAfterHome(item) },
    });
}

export async function adminDeleteBeforeAfterHomeController(req: Request, res: Response): Promise<void> {
    const { beforeAfterHomeId } = req.params;
    await BeforeAfterHomeService.adminDelete(beforeAfterHomeId);
    res.status(StatusCodes.NO_CONTENT).send();
}
