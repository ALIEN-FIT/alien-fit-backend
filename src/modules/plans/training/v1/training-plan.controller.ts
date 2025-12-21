import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TrainingPlanService } from './training-plan.service.js';
import { TrainingPlanEntity } from './entity/training-plan.entity.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';
import { TrackingRepository } from '../../../tracking/v1/tracking.repository.js';
import { DailyTrackingEntity } from '../../../tracking/v1/entity/daily-tracking.entity.js';

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
            isDone: boolean;
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
    itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    isDone: boolean;
    trainingVideo: SerializedTrainingVideo | null;
    supersetItems: Array<SerializedSupersetItem>;
    extraVideos: Array<{ trainingVideo: SerializedTrainingVideo | null }>;
    dropsetConfig: { dropPercents: number[]; restSeconds?: number } | null;
    circuitGroup: string | null;
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
    const trackingMap = await buildTrackingMap(json.userId, json.days ?? []);

    for (const day of json.days ?? []) {
        if (!weeksMap.has(day.weekNumber)) {
            weeksMap.set(day.weekNumber, { weekNumber: day.weekNumber, days: [] });
        }

        const dayDateKey = toDateOnlyString(day.date);
        const isDone = trackingMap.get(dayDateKey)?.trainingDone ?? false;

        const completedIds = new Set<string>(trackingMap.get(dayDateKey)?.trainingCompletedItemIds ?? []);

        const items = (day.items ?? []).map((item) => {
            for (const superset of item.supersetItems ?? []) {
                if (superset.trainingVideoId) {
                    supersetVideoIds.add(superset.trainingVideoId);
                }
            }
            for (const ev of (item as any).extraVideos ?? []) {
                if (ev.trainingVideoId) {
                    supersetVideoIds.add(ev.trainingVideoId);
                }
            }

            return {
                id: item.id,
                order: item.order,
                sets: item.sets ?? null,
                repeats: item.repeats ?? null,
                isSuperset: item.isSuperset,
                isDone: completedIds.has(item.id),
                trainingVideo: item.trainingVideo as TrainingVideoEntity | undefined,
                supersetItems: item.supersetItems ?? [],
            } as RawTrainingPlanItem;
        });

        weeksMap.get(day.weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            date: day.date,
            isDone,
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
                isDone: day.isDone,
                items: day.items.map((item) => ({
                    id: item.id,
                    order: item.order,
                    sets: item.sets,
                    repeats: item.repeats,
                    isSuperset: item.isSuperset,
                    itemType: (item as any).itemType ?? (item.isSuperset ? 'SUPERSET' : 'REGULAR'),
                    isDone: item.isDone,
                    trainingVideo: serializeVideo(item.trainingVideo),
                    supersetItems: item.supersetItems.map((superset) => ({
                        trainingVideoId: superset.trainingVideoId,
                        sets: superset.sets,
                        repeats: superset.repeats,
                        trainingVideo: serializeVideo(supersetVideosMap.get(superset.trainingVideoId)),
                    })),
                    extraVideos: ((item as any).extraVideos ?? []).map((ev: any) => ({
                        trainingVideo: serializeVideo(supersetVideosMap.get(ev.trainingVideoId)),
                    })),
                    dropsetConfig: (item as any).dropsetConfig ?? null,
                    circuitGroup: (item as any).circuitGroup ?? null,
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

export async function getMyTrainingPlanController(req: Request, res: Response): Promise<void> {
    const user = req.user as UserEntity;
    const plan = await TrainingPlanService.getTrainingPlan(user, user.id.toString());
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
    isDone: boolean;
    trainingVideo?: TrainingVideoEntity;
    supersetItems: Array<{ trainingVideoId: string; sets: number; repeats: number }>;
}

interface WeekAccumulator {
    weekNumber: number;
    days: Array<{
        dayIndex: number;
        date: Date;
        isDone: boolean;
        items: RawTrainingPlanItem[];
    }>;
}

async function buildTrackingMap(
    userId: string,
    days: Array<{ date: Date | string }>,
): Promise<Map<string, DailyTrackingEntity>> {
    const dateStrings = Array.from(new Set(days.map((day) => toDateOnlyString(day.date))));
    const trackings = await TrackingRepository.findByUserAndDates(userId, dateStrings);
    const map = new Map<string, DailyTrackingEntity>();
    for (const tracking of trackings) {
        map.set(toDateOnlyString(tracking.date as Date | string), tracking);
    }
    return map;
}

function toDateOnlyString(date: Date | string): string {
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    const match = typeof date === 'string' ? date.match(/^\d{4}-\d{2}-\d{2}/) : null;
    if (match) {
        return match[0];
    }
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toISOString().split('T')[0];
}
