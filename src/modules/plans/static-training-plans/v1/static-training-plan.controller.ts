import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { StaticTrainingPlanService } from './static-training-plan.service.js';
import { StaticTrainingPlanEntity } from './entity/static-training-plan.entity.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';

interface SerializedStaticTrainingPlan {
    id: string;
    name: string;
    subTitle: string | null;
    description: string | null;
    imageId: string;
    durationInMinutes: number | null;
    level: string | null;
    trainings: SerializedStaticTraining[];
}

type StaticTrainingType = 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';

interface SerializedStaticTraining {
    id: string;
    order: number;
    type: StaticTrainingType;
    title: string | null;
    description: string | null;
    sets: number | null;
    repeats: number | null;
    duration: number | null;
    config: Record<string, unknown> | null;
    trainingVideo: SerializedTrainingVideo | null;
    items: SerializedStaticTrainingItem[];
}

interface SerializedStaticTrainingItem {
    trainingVideoId: string;
    title: string | null;
    description: string | null;
    repeats: number | null;
    duration: number | null;
    trainingVideo: SerializedTrainingVideo | null;
}

interface SerializedTrainingVideo {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string;
    tags: Array<{
        id: string;
        title: string;
        description: string | null;
        imageUrl: string;
    }>;
}

async function serializeStaticPlan(plan: StaticTrainingPlanEntity): Promise<SerializedStaticTrainingPlan> {
    const json = plan.toJSON() as any;
    const nestedVideoIds = new Set<string>();
    for (const training of json.trainings ?? []) {
        for (const item of training.items ?? []) {
            if (item?.trainingVideoId) {
                nestedVideoIds.add(item.trainingVideoId);
            }
        }
    }
    const nestedVideosMap = nestedVideoIds.size
        ? await TrainingVideoService.ensureVideosExist(Array.from(nestedVideoIds))
        : new Map<string, TrainingVideoEntity>();

    return {
        id: json.id,
        name: json.name,
        subTitle: json.subTitle ?? null,
        description: json.description ?? null,
        imageId: json.imageId,
        durationInMinutes: json.durationInMinutes ?? null,
        level: json.level ?? null,
        trainings: (json.trainings ?? []).map((training: any) => {
            const items = (training.items ?? []).map((item: any) => {
                const video = item?.trainingVideoId ? nestedVideosMap.get(item.trainingVideoId) : undefined;
                return {
                    trainingVideoId: item.trainingVideoId,
                    title: item.title ?? null,
                    description: item.description ?? null,
                    repeats: item.repeats ?? null,
                    duration: item.duration ?? null,
                    trainingVideo: serializeVideo(video),
                } as SerializedStaticTrainingItem;
            });

            return {
                id: training.id,
                order: training.order,
                type: training.type as StaticTrainingType,
                title: training.title ?? null,
                description: training.description ?? null,
                sets: training.sets ?? null,
                repeats: training.repeats ?? null,
                duration: training.duration ?? null,
                config: training.config ?? null,
                trainingVideo: serializeVideo(training.trainingVideo as TrainingVideoEntity | undefined),
                items,
            } as SerializedStaticTraining;
        }),
    };
}

export async function createStaticTrainingPlanController(req: Request, res: Response): Promise<void> {
    const plan = await StaticTrainingPlanService.createStaticPlan(req.user!, req.body);
    const serializedPlan = await serializeStaticPlan(plan);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { staticTrainingPlan: serializedPlan },
    });
}

export async function updateStaticTrainingPlanController(req: Request, res: Response): Promise<void> {
    const { planId } = req.params;
    const plan = await StaticTrainingPlanService.updateStaticPlan(req.user!, planId, req.body);
    const serializedPlan = await serializeStaticPlan(plan);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { staticTrainingPlan: serializedPlan },
    });
}

export async function deleteStaticTrainingPlanController(req: Request, res: Response): Promise<void> {
    const { planId } = req.params;
    await StaticTrainingPlanService.deleteStaticPlan(req.user!, planId);
    res.status(StatusCodes.NO_CONTENT).send();
}

export async function listStaticTrainingPlansController(req: Request, res: Response): Promise<void> {
    const filters = {
        search: toOptionalString(req.query.search),
    };

    const pagination = {
        page: toOptionalNumber(req.query.page),
        limit: toOptionalNumber(req.query.limit),
    } as const;

    const data = await StaticTrainingPlanService.listStaticPlans(filters, pagination);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            plans: data.plans.map((plan) => ({
                id: plan.id,
                name: plan.name,
                subTitle: plan.subTitle,
                description: plan.description,
                imageId: plan.imageId,
                durationInMinutes: plan.durationInMinutes,
                level: plan.level,
                createdAt: plan.createdAt,
                updatedAt: plan.updatedAt,
            })),
            pagination: data.pagination,
        },
    });
}

export async function getStaticTrainingPlanController(req: Request, res: Response): Promise<void> {
    const { planId } = req.params;
    const plan = await StaticTrainingPlanService.getStaticPlan(planId);
    const serializedPlan = await serializeStaticPlan(plan);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { staticTrainingPlan: serializedPlan },
    });
}

function serializeVideo(video: TrainingVideoEntity | undefined): SerializedTrainingVideo | null {
    if (!video) {
        return null;
    }
    const json = (typeof (video as any).toJSON === 'function') ? (video as any).toJSON() : (video as any);
    const tags = (json.tags ?? []).map((tag: any) => {
        const t = (typeof tag?.toJSON === 'function') ? tag.toJSON() : tag;
        return {
            id: t.id,
            title: t.title,
            description: t.description ?? null,
            imageUrl: t.imageUrl,
        };
    });

    return {
        id: json.id,
        title: json.title,
        description: json.description ?? null,
        videoUrl: json.videoUrl,
        tags,
    };
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
