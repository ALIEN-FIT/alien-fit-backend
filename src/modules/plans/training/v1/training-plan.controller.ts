import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TrainingPlanService } from './training-plan.service.js';
import { TrainingPlanEntity } from './entity/training-plan.entity.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';

interface SerializedTrainingPlan {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    weeks: Array<{
        weekNumber: number;
        days: Array<{
            dayIndex: number;
            date: Date;
            items: Array<SerializedTrainingPlanItem>;
        }>;
    }>;
}

interface SerializedTrainingPlanItem {
    id: string;
    order: number;
    sets: number | null;
    repeats: number | null;
    isSuperset: boolean;
    trainingVideo: SerializedTrainingVideo | null;
    supersetItems: Array<SerializedSupersetItem>;
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

async function serializeTrainingPlan(plan: TrainingPlanEntity): Promise<SerializedTrainingPlan> {
    const json = plan.toJSON() as any;
    const weeksMap = new Map<number, WeekAccumulator>();
    const supersetVideoIds = new Set<string>();

    for (const day of json.days ?? []) {
        if (!weeksMap.has(day.weekNumber)) {
            weeksMap.set(day.weekNumber, { weekNumber: day.weekNumber, days: [] });
        }

        const items = (day.items ?? []).map((item) => {
            for (const superset of item.supersetItems ?? []) {
                if (superset.trainingVideoId) {
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
            } as RawTrainingPlanItem;
        });

        weeksMap.get(day.weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            date: day.date,
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
        userId: json.userId,
        startDate: json.startDate,
        endDate: json.endDate,
        weeks: weeks.map((week) => ({
            weekNumber: week.weekNumber,
            days: week.days.map((day) => ({
                dayIndex: day.dayIndex,
                date: day.date,
                items: day.items.map((item) => ({
                    id: item.id,
                    order: item.order,
                    sets: item.sets,
                    repeats: item.repeats,
                    isSuperset: item.isSuperset,
                    trainingVideo: serializeVideo(item.trainingVideo),
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

export async function createTrainingPlanWeekController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await TrainingPlanService.createWeeklyTemplateForUser(req.user!, userId, req.body);
    const trainingPlan = await serializeTrainingPlan(plan);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { trainingPlan },
    });
}

export async function getTrainingPlanController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await TrainingPlanService.getTrainingPlan(req.user!, userId);
    const trainingPlan = await serializeTrainingPlan(plan);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { trainingPlan },
    });
}

function serializeVideo(video: TrainingVideoEntity | undefined): SerializedTrainingVideo | null {
    if (!video) {
        return null;
    }
    // Support both Mongoose documents (with toJSON) and plain objects
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

interface RawTrainingPlanItem {
    id: string;
    order: number;
    sets: number | null;
    repeats: number | null;
    isSuperset: boolean;
    trainingVideo?: TrainingVideoEntity;
    supersetItems: Array<{ trainingVideoId: string; sets: number; repeats: number }>;
}

interface WeekAccumulator {
    weekNumber: number;
    days: Array<{
        dayIndex: number;
        date: Date;
        items: RawTrainingPlanItem[];
    }>;
}
