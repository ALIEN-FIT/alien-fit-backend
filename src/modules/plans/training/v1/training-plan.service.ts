import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { UserService } from '../../../user/v1/user.service.js';
import { TrainingPlanRepository } from './training-plan.repository.js';
import { TrainingPlanEntity } from './entity/training-plan.entity.js';
import { Roles } from '../../../../constants/roles.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { addWeeks, startOfDayUTC } from '../../../../utils/date.utils.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';

interface SupersetItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

interface TrainingPlanItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
    isSuperset?: boolean;
    supersetItems?: SupersetItemInput[];
}

interface TrainingPlanDayInput {
    dayNumber?: number;
    items: TrainingPlanItemInput[];
}

interface CreateTrainingPlanPayload {
    startDate?: string;
    days: TrainingPlanDayInput[];
}

export class TrainingPlanService {
    static async createWeeklyTemplateForUser(
        actor: UserEntity,
        userId: string,
        payload: CreateTrainingPlanPayload,
    ): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can create training plans');
        }

        await UserService.getUserById(userId);

        const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid startDate');
        }
        const normalizedStart = startOfDayUTC(startDate);
        const endDate = addWeeks(normalizedStart, 4);

        if (!Array.isArray(payload.days) || payload.days.length !== 7) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Template must include exactly 7 days');
        }

        const videoIds = this.collectVideoIds(payload.days);
        const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);

        const normalizedTemplate = this.normalizeTemplate(payload.days, trainingVideosMap);
        const daysPayload = this.buildDaysPayload(normalizedStart, normalizedTemplate);

        await TrainingPlanRepository.createPlan(userId, normalizedStart, endDate, daysPayload as any);

        return this.getTrainingPlan(actor, userId);
    }

    static async getTrainingPlan(actor: UserEntity, userId: string): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN && actor.id !== userId) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Not allowed to view this training plan');
        }

        const plan = await TrainingPlanRepository.findByUserId(userId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan not found');
        }
        return plan;
    }

    private static collectVideoIds(days: TrainingPlanDayInput[]): string[] {
        const ids = new Set<string>();
        for (const day of days) {
            for (const item of day.items ?? []) {
                ids.add(item.trainingVideoId);
                if (item.isSuperset) {
                    for (const superset of item.supersetItems ?? []) {
                        ids.add(superset.trainingVideoId);
                    }
                }
            }
        }
        return Array.from(ids);
    }

    private static normalizeTemplate(
        days: TrainingPlanDayInput[],
        videoMap: Map<string, TrainingVideoEntity>,
    ): NormalizedTrainingPlanItem[][] {
        const template: NormalizedTrainingPlanItem[][] = Array.from({ length: 7 }, () => []);

        days.forEach((day, index) => {
            const position = day.dayNumber ? day.dayNumber - 1 : index;
            if (position < 0 || position > 6) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dayNumber must be between 1 and 7');
            }
            template[position] = day.items?.map((item) => this.normalizeItem(item, videoMap)) ?? [];
        });

        return template;
    }

    private static normalizeItem(
        item: TrainingPlanItemInput,
        videoMap: Map<string, TrainingVideoEntity>,
    ): NormalizedTrainingPlanItem {
        const video = videoMap.get(item.trainingVideoId);
        if (!video) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${item.trainingVideoId}`);
        }

        let supersetItems: SupersetItemInput[] | null = null;
        if (item.isSuperset) {
            supersetItems = (item.supersetItems ?? []).map((superset) => {
                const supersetVideo = videoMap.get(superset.trainingVideoId);
                if (!supersetVideo) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${superset.trainingVideoId}`);
                }
                return {
                    trainingVideoId: superset.trainingVideoId,
                    sets: superset.sets,
                    repeats: superset.repeats,
                };
            });
        }

        return {
            trainingVideoId: item.trainingVideoId,
            sets: item.sets,
            repeats: item.repeats,
            isSuperset: Boolean(item.isSuperset),
            supersetItems,
            trainingVideo: video,
        };
    }

    private static buildDaysPayload(
        startDate: Date,
        template: NormalizedTrainingPlanItem[][],
    ) {
        return Array.from({ length: 28 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            const templateItems = template[index % 7];

            const items = templateItems.map((item, orderIndex) => ({
                order: orderIndex + 1,
                title: item.trainingVideo.title,
                videoLink: item.trainingVideo.videoUrl,
                description: item.trainingVideo.description ?? null,
                duration: null,
                repeats: item.repeats,
                sets: item.sets,
                trainingVideoId: item.trainingVideoId,
                isSuperset: Boolean(item.isSuperset),
                supersetItems: item.isSuperset ? item.supersetItems ?? [] : null,
            }));

            return {
                dayIndex: index + 1,
                date,
                weekNumber: Math.floor(index / 7) + 1,
                items,
            };
        });
    }
}

interface NormalizedTrainingPlanItem {
    trainingVideoId: string;
    sets: number;
    repeats: number;
    isSuperset: boolean;
    supersetItems: SupersetItemInput[] | null;
    trainingVideo: TrainingVideoEntity;
}
