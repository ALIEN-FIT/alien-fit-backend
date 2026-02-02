import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TrainingVideoService, TrainingTagService } from './training-video.service.js';
import { Roles } from '../../../constants/roles.js';
import { env } from '../../../config/env.js';
import { exchangeYouTubeCodeForTokens } from '../../../config/youtube-client.js';
import { createSignedState, verifySignedState } from '../../../utils/signed-state.js';

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

export async function toggleTrainingVideoActiveController(req: Request, res: Response) {
    const video = await TrainingVideoService.getVideo(req.user!, req.params.videoId);
    const updated = await TrainingVideoService.updateVideo(req.user!, req.params.videoId, { isActive: !video.isActive });
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { video: updated },
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

export async function syncTrainingVideosFromYouTubeController(req: Request, res: Response) {
    const returnUrl = typeof (req.body as any)?.returnUrl === 'string' ? String((req.body as any).returnUrl) : undefined;
    const result = await TrainingVideoService.syncFromYouTube(req.user!, { returnUrl });
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

type YouTubeOAuthStatePayload = {
    returnUrl: string;
    exp: number;
};

export async function youtubeOAuthCallbackController(req: Request, res: Response) {
    const error = typeof req.query.error === 'string' ? req.query.error : undefined;
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;

    const secret = env.YOUTUBE_OAUTH_STATE_SECRET ?? env.JWT_PRIVATE_KEY;
    let payload: YouTubeOAuthStatePayload | null = null;

    try {
        if (state) {
            payload = verifySignedState<YouTubeOAuthStatePayload>(state, secret);
            if (Date.now() > payload.exp) {
                throw new Error('State expired');
            }
        }
    } catch {
        payload = null;
    }

    const fallbackReturnUrl = env.APP_URL;
    const returnUrl = payload?.returnUrl || fallbackReturnUrl;

    const redirect = (params: Record<string, string>) => {
        const url = new URL(returnUrl);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
        res.redirect(url.toString());
    };

    if (error) {
        return redirect({ youtubeAuth: 'error', reason: error });
    }

    if (!code) {
        return redirect({ youtubeAuth: 'error', reason: 'missing_code' });
    }

    try {
        await exchangeYouTubeCodeForTokens(code);

        // Run sync using a system admin actor (no JWT in OAuth callback).
        const systemAdmin = { role: Roles.ADMIN } as any;
        const result = await TrainingVideoService.syncFromYouTube(systemAdmin, { returnUrl });

        if ((result as any)?.requiresAuth) {
            // Rare: if Google didn’t grant offline access.
            const exp = Date.now() + 10 * 60 * 1000;
            const signed = createSignedState<YouTubeOAuthStatePayload>({ returnUrl, exp }, secret);
            return redirect({ youtubeAuth: 'ok', youtubeSync: 'auth_required', authUrl: String((result as any).authUrl ?? ''), state: signed.state });
        }

        return redirect({
            youtubeAuth: 'ok',
            youtubeSync: 'success',
            added: String((result as any).added ?? 0),
            skipped: String((result as any).skipped ?? 0),
            total: String((result as any).total ?? 0),
        });
    } catch (e: any) {
        return redirect({ youtubeAuth: 'error', reason: e?.message ? String(e.message) : 'sync_failed' });
    }
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
