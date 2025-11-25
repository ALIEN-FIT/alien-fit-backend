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
    weeks: Array<{
        weekNumber: number;
        days: Array<SerializedStaticPlanDay>;
    }>;
}

interface SerializedStaticPlanDay {
    dayIndex: number;
    weekNumber: number;
    items: SerializedStaticPlanItem[];
}

interface SerializedStaticPlanItem {
    id: string;
    order: number;
    sets: number | null;
    repeats: number | null;
    isSuperset: boolean;
    trainingVideo: SerializedTrainingVideo | null;
    supersetItems: SerializedSupersetItem[];
}

interface SerializedSupersetItem {
    trainingVideoId: string;
    sets: number;
    repeats: number;
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
    const weeksMap = new Map<number, { weekNumber: number; days: SerializedStaticPlanDay[] }>();
    const supersetVideoIds = new Set<string>();

    for (const day of json.days ?? []) {
        const weekNumber = day.weekNumber ?? 1;
        if (!weeksMap.has(weekNumber)) {
            weeksMap.set(weekNumber, { weekNumber, days: [] });
        }

        const items = (day.items ?? []).map((item: any) => {
            for (const superset of item.supersetItems ?? []) {
                if (superset?.trainingVideoId) {
                    supersetVideoIds.add(superset.trainingVideoId);
                }
            }

            return {
                id: item.id,
                order: item.order,
                sets: item.sets ?? null,
                repeats: item.repeats ?? null,
                isSuperset: item.isSuperset,
                trainingVideo: item.trainingVideo as TrainingVideoEntity | undefined,
                supersetItems: item.supersetItems ?? [],
            } as RawStaticPlanItem;
        });

        weeksMap.get(weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            weekNumber,
            items,
        });
    }

    const supersetVideosMap = await TrainingVideoService.ensureVideosExist(Array.from(supersetVideoIds));

    const weeks = Array.from(weeksMap.values())
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((week) => ({
            weekNumber: week.weekNumber,
            days: week.days.sort((a, b) => a.dayIndex - b.dayIndex),
        }));

    return {
        id: json.id,
        name: json.name,
        subTitle: json.subTitle ?? null,
        description: json.description ?? null,
        imageId: json.imageId,
        durationInMinutes: json.durationInMinutes ?? null,
        level: json.level ?? null,
        weeks: weeks.map((week) => ({
            weekNumber: week.weekNumber,
            days: week.days.map((day) => ({
                dayIndex: day.dayIndex,
                weekNumber: day.weekNumber,
                items: day.items.map((item) => ({
                    id: item.id,
                    order: item.order,
                    sets: item.sets,
                    repeats: item.repeats,
                    isSuperset: item.isSuperset,
                    trainingVideo: serializeVideo(item.trainingVideo as any),
                    supersetItems: item.supersetItems.map((superset) => ({
                        trainingVideoId: superset.trainingVideoId,
                        sets: superset.sets,
                        repeats: superset.repeats,
                        trainingVideo: serializeVideo(supersetVideosMap.get(superset.trainingVideoId)),
                    })),
                })),
            })),
        })),
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
    const plans = await StaticTrainingPlanService.listStaticPlans();
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            plans: plans.map((plan) => ({
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

interface RawStaticPlanItem {
    id: string;
    order: number;
    sets: number | null;
    repeats: number | null;
    isSuperset: boolean;
    trainingVideo?: TrainingVideoEntity;
    supersetItems: Array<{ trainingVideoId: string; sets: number; repeats: number }>;
}
