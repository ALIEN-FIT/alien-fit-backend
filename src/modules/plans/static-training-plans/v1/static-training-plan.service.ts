import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { Roles } from '../../../../constants/roles.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';
import {
    StaticTrainingPlanDayPayload,
    StaticTrainingPlanRepository,
} from './static-training-plan.repository.js';

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

interface StaticTrainingPlanDayInput {
    dayNumber?: number;
    items: TrainingPlanItemInput[];
}

interface CreateStaticTrainingPlanPayload {
    name: string;
    subTitle?: string | null;
    description?: string | null;
    imageId: string;
    durationInMinutes?: number | null;
    level?: string | null;
    days: StaticTrainingPlanDayInput[];
}

interface UpdateStaticTrainingPlanPayload {
    name?: string;
    subTitle?: string | null;
    description?: string | null;
    imageId?: string;
    durationInMinutes?: number | null;
    level?: string | null;
    days?: StaticTrainingPlanDayInput[];
}

export class StaticTrainingPlanService {
    static async createStaticPlan(actor: UserEntity, payload: CreateStaticTrainingPlanPayload) {
        this.ensureAdmin(actor);
        this.assertExactlySevenDays(payload.days);

        const videoIds = this.collectVideoIds(payload.days);
        const videoMap = await TrainingVideoService.ensureVideosExist(videoIds);
        const daysPayload = this.buildDaysPayload(this.normalizeDays(payload.days, videoMap));

        const plan = await StaticTrainingPlanRepository.createPlan(
            payload.name,
            payload.subTitle ?? null,
            payload.description ?? null,
            payload.imageId,
            payload.durationInMinutes ?? null,
            payload.level ?? null,
            daysPayload,
        );

        const saved = await StaticTrainingPlanRepository.findById(plan.id);
        if (!saved) {
            throw new HttpResponseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load static training plan');
        }

        return saved;
    }

    static async updateStaticPlan(actor: UserEntity, planId: string, payload: UpdateStaticTrainingPlanPayload) {
        this.ensureAdmin(actor);

        const meta: { name?: string; subTitle?: string | null; description?: string | null; imageId?: string; durationInMinutes?: number | null; level?: string | null } = {};
        if (payload.name !== undefined) {
            meta.name = payload.name;
        }
        if (payload.subTitle !== undefined) {
            meta.subTitle = payload.subTitle ?? null;
        }
        if (payload.description !== undefined) {
            meta.description = payload.description ?? null;
        }
        if (payload.imageId !== undefined) {
            meta.imageId = payload.imageId;
        }
        if (payload.durationInMinutes !== undefined) {
            meta.durationInMinutes = payload.durationInMinutes ?? null;
        }
        if (payload.level !== undefined) {
            meta.level = payload.level ?? null;
        }

        let daysPayload: StaticTrainingPlanDayPayload[] | undefined;
        if (payload.days) {
            this.assertExactlySevenDays(payload.days);
            const videoIds = this.collectVideoIds(payload.days);
            const videoMap = await TrainingVideoService.ensureVideosExist(videoIds);
            daysPayload = this.buildDaysPayload(this.normalizeDays(payload.days, videoMap));
        }

        const updated = await StaticTrainingPlanRepository.updatePlan(planId, meta, daysPayload);
        if (!updated) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }

        const saved = await StaticTrainingPlanRepository.findById(planId);
        if (!saved) {
            throw new HttpResponseError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to load static training plan');
        }

        return saved;
    }

    static async deleteStaticPlan(actor: UserEntity, planId: string) {
        this.ensureAdmin(actor);
        const deleted = await StaticTrainingPlanRepository.deletePlan(planId);
        if (!deleted) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }
        return { deleted: true };
    }

    static async getStaticPlan(planId: string) {
        const plan = await StaticTrainingPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Static training plan not found');
        }
        return plan;
    }

    static listStaticPlans() {
        return StaticTrainingPlanRepository.listPlans();
    }

    private static collectVideoIds(days: StaticTrainingPlanDayInput[]) {
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

    private static normalizeDays(days: StaticTrainingPlanDayInput[], videoMap: Map<string, TrainingVideoEntity>) {
        const template: NormalizedTrainingPlanItem[][] = Array.from({ length: 7 }, () => []);

        days.forEach((day, index) => {
            const position = day.dayNumber ? day.dayNumber - 1 : index;
            if (position < 0 || position > 6) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dayNumber must be between 1 and 7');
            }
            template[position] = (day.items ?? []).map((item) => this.normalizeItem(item, videoMap));
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

    private static buildDaysPayload(template: NormalizedTrainingPlanItem[][]): StaticTrainingPlanDayPayload[] {
        return template.map((dayItems, index) => ({
            dayIndex: index + 1,
            weekNumber: Math.floor(index / 7) + 1,
            items: dayItems.map((item, orderIndex) => ({
                order: orderIndex + 1,
                title: item.trainingVideo.title,
                videoLink: item.trainingVideo.videoUrl,
                description: item.trainingVideo.description ?? null,
                duration: null,
                repeats: item.repeats,
                sets: item.sets,
                trainingVideoId: item.trainingVideoId,
                isSuperset: item.isSuperset,
                supersetItems: item.isSuperset ? item.supersetItems ?? [] : null,
            })),
        }));
    }

    private static assertExactlySevenDays(days: StaticTrainingPlanDayInput[]) {
        if (!Array.isArray(days) || days.length !== 7) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Plan must include exactly 7 days');
        }
    }

    private static ensureAdmin(actor: UserEntity) {
        if (!actor || actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can manage static training plans');
        }
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
