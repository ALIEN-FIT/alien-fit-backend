import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { UserService } from '../../../user/v1/user.service.js';
import { TrainingPlanRepository } from './training-plan.repository.js';
import { TrainingPlanEntity } from './entity/training-plan.entity.js';
import { Roles } from '../../../../constants/roles.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { addDays, addWeeks, startOfDayUTC } from '../../../../utils/date.utils.js';
import { TrainingVideoService } from '../../../training-video/v1/training-video.service.js';
import { TrainingVideoEntity } from '../../../training-video/v1/entity/training-video.entity.js';
import { SubscriptionService } from '../../../subscription/v1/subscription.service.js';
import { AdminSettingsService } from '../../../admin-settings/v1/admin-settings.service.js';
import { TrainingPlanDayEntity, TrainingPlanItemEntity } from './entity/training-plan.entity.js';
import { sequelize } from '../../../../database/db-config.js';

interface SupersetItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

interface TrainingPlanItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
    itemType?: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    isSuperset?: boolean; // legacy
    supersetItems?: SupersetItemInput[];
    extraVideos?: Array<{ trainingVideoId: string }>;
    dropsetConfig?: { dropPercents: number[]; restSeconds?: number };
    circuitGroup?: string;
}

interface TrainingPlanDayInput {
    name: string;
    dayNumber?: number;
    items: TrainingPlanItemInput[];
}

interface CreateTrainingPlanPayload {
    startDate?: string;
    days: TrainingPlanDayInput[];
}

interface UpdateTrainingPlanDayPayload {
    name?: string;
    items?: TrainingPlanItemInput[];
}

interface UpdateTrainingPlanItemPayload {
    sets?: number;
    repeats?: number;
    itemType?: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    isSuperset?: boolean;
    trainingVideoId?: string;
    supersetItems?: SupersetItemInput[];
    extraVideos?: Array<{ trainingVideoId: string }>;
    dropsetConfig?: { dropPercents: number[]; restSeconds?: number };
    circuitGroup?: string;
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
        const subscriptionStatus = await SubscriptionService.getStatus(userId);
        if (!subscriptionStatus.capabilities.canAccessTraining) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'User subscription does not allow training plans');
        }

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

        const subscriptionStatus = await SubscriptionService.getStatus(userId);

        if (!subscriptionStatus.capabilities.canAccessTraining) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Training plan is not available for current subscription');
        }

        // Free-tier users get default plan if configured
        if (subscriptionStatus.isFreeTier) {
            const defaultPlanId = await AdminSettingsService.getDefaultTrainingPlanId();
            if (defaultPlanId) {
                const defaultPlan = await TrainingPlanRepository.findById(defaultPlanId);
                if (defaultPlan) {
                    return defaultPlan;
                }
            }
        }

        const plan = await TrainingPlanRepository.findByUserId(userId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan not found');
        }
        return plan;
    }

    static getCurrentWeekNumber(startDate: Date): number {
        const now = startOfDayUTC(new Date());
        const start = startOfDayUTC(startDate);
        const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysDiff / 7) + 1;

        // Clamp between 1 and 4
        return Math.max(1, Math.min(4, weekNumber));
    }

    static async updatePlanDayByPlanId(
        actor: UserEntity,
        planId: string,
        dayIndex: number,
        payload: UpdateTrainingPlanDayPayload,
    ): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const plan = await TrainingPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan not found');
        }

        const day = await TrainingPlanDayEntity.findOne({ where: { planId, dayIndex } });
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        if (payload.items) {
            const videoIds = this.collectVideoIds([{ name: day.name ?? `Day ${dayIndex}`, dayNumber: dayIndex, items: payload.items }]);
            const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);
            const normalizedItems = payload.items.map((item) => this.normalizeItem(item, trainingVideosMap));
            this.assertCircuitGroupsAreValid(normalizedItems);

            await sequelize.transaction(async (transaction) => {
                await TrainingPlanItemEntity.destroy({ where: { dayId: day.id }, transaction });
                if (normalizedItems.length > 0) {
                    await TrainingPlanItemEntity.bulkCreate(
                        normalizedItems.map((item, index) => ({
                            dayId: day.id,
                            order: index + 1,
                            title: item.trainingVideo.title,
                            videoLink: item.trainingVideo.videoUrl,
                            description: item.trainingVideo.description ?? null,
                            duration: null,
                            repeats: item.repeats,
                            sets: item.sets,
                            trainingVideoId: item.trainingVideoId,
                            isSuperset: Boolean(item.isSuperset),
                            itemType: item.itemType,
                            supersetItems: item.itemType === 'SUPERSET' ? item.supersetItems ?? [] : null,
                            extraVideos: item.itemType === 'SUPERSET' ? item.extraVideos ?? [] : null,
                            dropsetConfig: item.itemType === 'DROPSET' ? item.dropsetConfig ?? null : null,
                            circuitGroup: item.itemType === 'CIRCUIT' ? item.circuitGroup ?? null : null,
                        })),
                        { transaction },
                    );
                }

                if (payload.name !== undefined) {
                    await day.update({ name: payload.name?.trim() || null }, { transaction });
                }
            });
        } else if (payload.name !== undefined) {
            await day.update({ name: payload.name?.trim() || null });
        }

        return (await TrainingPlanRepository.findById(planId)) as TrainingPlanEntity;
    }

    static async clearPlanDayByPlanId(actor: UserEntity, planId: string, dayIndex: number): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const day = await TrainingPlanDayEntity.findOne({ where: { planId, dayIndex } });
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        await TrainingPlanItemEntity.destroy({ where: { dayId: day.id } });
        return (await TrainingPlanRepository.findById(planId)) as TrainingPlanEntity;
    }

    static async updatePlanItemById(
        actor: UserEntity,
        itemId: string,
        payload: UpdateTrainingPlanItemPayload,
    ): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const item = await TrainingPlanItemEntity.findByPk(itemId, {
            include: [{ model: TrainingPlanDayEntity, as: 'day' }],
        });
        if (!item || !(item as any).day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan item not found');
        }

        const currentData: TrainingPlanItemInput = {
            trainingVideoId: payload.trainingVideoId ?? item.trainingVideoId,
            sets: payload.sets ?? Number(item.sets ?? 0),
            repeats: payload.repeats ?? Number(item.repeats ?? 0),
            itemType: payload.itemType ?? (item.itemType as any),
            isSuperset: payload.isSuperset,
            supersetItems: payload.supersetItems ?? (Array.isArray(item.supersetItems) ? (item.supersetItems as any) : undefined),
            extraVideos: payload.extraVideos ?? (Array.isArray(item.extraVideos) ? (item.extraVideos as any) : undefined),
            dropsetConfig: payload.dropsetConfig ?? ((item.dropsetConfig as any) ?? undefined),
            circuitGroup: payload.circuitGroup ?? item.circuitGroup ?? undefined,
        };

        const videoIds = this.collectVideoIds([{ name: 'day', items: [currentData] }]);
        const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);
        const normalized = this.normalizeItem(currentData, trainingVideosMap);

        await item.update({
            title: normalized.trainingVideo.title,
            videoLink: normalized.trainingVideo.videoUrl,
            description: normalized.trainingVideo.description ?? null,
            repeats: normalized.repeats,
            sets: normalized.sets,
            trainingVideoId: normalized.trainingVideoId,
            isSuperset: normalized.itemType === 'SUPERSET',
            itemType: normalized.itemType,
            supersetItems: normalized.itemType === 'SUPERSET' ? normalized.supersetItems ?? [] : null,
            extraVideos: normalized.itemType === 'SUPERSET' ? normalized.extraVideos ?? [] : null,
            dropsetConfig: normalized.itemType === 'DROPSET' ? normalized.dropsetConfig ?? null : null,
            circuitGroup: normalized.itemType === 'CIRCUIT' ? normalized.circuitGroup ?? null : null,
        });

        const day = (item as any).day as TrainingPlanDayEntity;
        return (await TrainingPlanRepository.findById(day.planId)) as TrainingPlanEntity;
    }

    static async deletePlanItemById(actor: UserEntity, itemId: string): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const item = await TrainingPlanItemEntity.findByPk(itemId, {
            include: [{ model: TrainingPlanDayEntity, as: 'day' }],
        });
        if (!item || !(item as any).day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan item not found');
        }

        const day = (item as any).day as TrainingPlanDayEntity;

        await sequelize.transaction(async (transaction) => {
            await item.destroy({ transaction });
            const remaining = await TrainingPlanItemEntity.findAll({
                where: { dayId: day.id },
                order: [['order', 'ASC']],
                transaction,
            });

            for (let index = 0; index < remaining.length; index += 1) {
                const current = remaining[index];
                if (current.order !== index + 1) {
                    await current.update({ order: index + 1 }, { transaction });
                }
            }
        });

        return (await TrainingPlanRepository.findById(day.planId)) as TrainingPlanEntity;
    }

    private static collectVideoIds(days: TrainingPlanDayInput[]): string[] {
        const ids = new Set<string>();
        for (const day of days) {
            for (const item of day.items ?? []) {
                ids.add(item.trainingVideoId);
                if (item.isSuperset || item.itemType === 'SUPERSET') {
                    for (const superset of item.supersetItems ?? []) {
                        ids.add(superset.trainingVideoId);
                    }
                    for (const extra of item.extraVideos ?? []) {
                        ids.add(extra.trainingVideoId);
                    }
                }
            }
        }
        return Array.from(ids);
    }

    private static normalizeTemplate(
        days: TrainingPlanDayInput[],
        videoMap: Map<string, TrainingVideoEntity>,
    ): NormalizedTrainingPlanDay[] {
        const template: NormalizedTrainingPlanDay[] = Array.from({ length: 7 }, (_, index) => ({
            name: `Day ${index + 1}`,
            items: [],
        }));

        days.forEach((day, index) => {
            const position = day.dayNumber ? day.dayNumber - 1 : index;
            if (position < 0 || position > 6) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dayNumber must be between 1 and 7');
            }
            const normalizedItems = day.items?.map((item) => this.normalizeItem(item, videoMap)) ?? [];
            this.assertCircuitGroupsAreValid(normalizedItems);
            template[position] = {
                name: String(day.name ?? '').trim() || `Day ${position + 1}`,
                items: normalizedItems,
            };
        });

        return template;
    }

    private static assertCircuitGroupsAreValid(items: NormalizedTrainingPlanItem[]) {
        const circuitGroups = new Map<string, number>();
        for (const item of items) {
            if (item.itemType !== 'CIRCUIT') {
                continue;
            }
            const key = (item.circuitGroup ?? '').trim();
            circuitGroups.set(key, (circuitGroups.get(key) ?? 0) + 1);
        }

        for (const [group, count] of circuitGroups.entries()) {
            if (!group) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT items must include circuitGroup');
            }
            if (count < 3) {
                throw new HttpResponseError(
                    StatusCodes.BAD_REQUEST,
                    `CIRCUIT group "${group}" must include at least 3 exercises (received ${count})`,
                );
            }
        }
    }

    private static normalizeItem(
        item: TrainingPlanItemInput,
        videoMap: Map<string, TrainingVideoEntity>,
    ): NormalizedTrainingPlanItem {
        const video = videoMap.get(item.trainingVideoId);
        if (!video) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${item.trainingVideoId}`);
        }

        const itemType = item.itemType ?? (item.isSuperset ? 'SUPERSET' : 'REGULAR');

        if (!['REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT'].includes(itemType)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Invalid itemType: ${String(itemType)}`);
        }

        if (!Number.isFinite(item.sets) || item.sets < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'sets must be a positive number');
        }
        if (!Number.isFinite(item.repeats) || item.repeats < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'repeats must be a positive number');
        }

        let supersetItems: SupersetItemInput[] | null = null;
        let extraVideos: Array<{ trainingVideoId: string }> | null = null;
        let dropsetConfig: { dropPercents: number[]; restSeconds?: number } | null = null;
        let circuitGroup: string | null = null;

        if (itemType === 'SUPERSET') {
            if (!Array.isArray(item.supersetItems) || item.supersetItems.length < 1) {
                throw new HttpResponseError(
                    StatusCodes.BAD_REQUEST,
                    'SUPERSET must include at least 2 exercises (provide supersetItems with length >= 1)',
                );
            }
            supersetItems = (item.supersetItems ?? []).map((superset) => {
                const supersetVideo = videoMap.get(superset.trainingVideoId);
                if (!supersetVideo) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${superset.trainingVideoId}`);
                }
                if (!Number.isFinite(superset.sets) || superset.sets < 1) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'supersetItem.sets must be a positive number');
                }
                if (!Number.isFinite(superset.repeats) || superset.repeats < 1) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'supersetItem.repeats must be a positive number');
                }
                return {
                    trainingVideoId: superset.trainingVideoId,
                    sets: superset.sets,
                    repeats: superset.repeats,
                };
            });
            extraVideos = (item.extraVideos ?? []).map((ev) => {
                const evVideo = videoMap.get(ev.trainingVideoId);
                if (!evVideo) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown training video: ${ev.trainingVideoId}`);
                }
                return { trainingVideoId: ev.trainingVideoId };
            });
        } else if (itemType === 'DROPSET') {
            if (item.supersetItems?.length || item.extraVideos?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'DROPSET cannot include supersetItems or extraVideos');
            }
            if (item.circuitGroup) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'DROPSET cannot include circuitGroup');
            }
            if (!item.dropsetConfig || !Array.isArray(item.dropsetConfig.dropPercents) || item.dropsetConfig.dropPercents.length < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'DROPSET must include dropsetConfig.dropPercents (non-empty array)');
            }

            const dropPercents = item.dropsetConfig.dropPercents.map((p) => Number(p));
            if (dropPercents.some((p) => !Number.isFinite(p) || p <= 0 || p >= 100)) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dropsetConfig.dropPercents must be numbers between 1 and 99');
            }
            if (
                item.dropsetConfig.restSeconds !== undefined &&
                (!Number.isFinite(item.dropsetConfig.restSeconds) || item.dropsetConfig.restSeconds < 0)
            ) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dropsetConfig.restSeconds must be a non-negative number');
            }
            dropsetConfig = { dropPercents, restSeconds: item.dropsetConfig.restSeconds };
        } else if (itemType === 'CIRCUIT') {
            if (item.supersetItems?.length || item.extraVideos?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT cannot include supersetItems or extraVideos');
            }
            if (item.dropsetConfig) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT cannot include dropsetConfig');
            }
            circuitGroup = (item.circuitGroup ?? '').trim() || null;
            if (!circuitGroup) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT must include circuitGroup');
            }
        } else {
            // REGULAR
            if (item.supersetItems?.length || item.extraVideos?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include supersetItems or extraVideos');
            }
            if (item.dropsetConfig) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include dropsetConfig');
            }
            if (item.circuitGroup) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include circuitGroup');
            }
        }

        return {
            trainingVideoId: item.trainingVideoId,
            sets: item.sets,
            repeats: item.repeats,
            isSuperset: itemType === 'SUPERSET',
            supersetItems,
            trainingVideo: video,
            itemType,
            extraVideos,
            dropsetConfig,
            circuitGroup,
        };
    }

    private static buildDaysPayload(
        startDate: Date,
        template: NormalizedTrainingPlanDay[],
    ) {
        return Array.from({ length: 28 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            const templateDay = template[index % 7];

            const items = templateDay.items.map((item, orderIndex) => ({
                order: orderIndex + 1,
                title: item.trainingVideo.title,
                videoLink: item.trainingVideo.videoUrl,
                description: item.trainingVideo.description ?? null,
                duration: null,
                repeats: item.repeats,
                sets: item.sets,
                trainingVideoId: item.trainingVideoId,
                isSuperset: Boolean(item.isSuperset),
                itemType: item.itemType,
                supersetItems: item.isSuperset ? item.supersetItems ?? [] : null,
                extraVideos: item.itemType === 'SUPERSET' ? item.extraVideos ?? [] : null,
                dropsetConfig: item.itemType === 'DROPSET' ? item.dropsetConfig ?? null : null,
                circuitGroup: item.itemType === 'CIRCUIT' ? item.circuitGroup ?? null : null,
            }));

            return {
                dayIndex: index + 1,
                name: templateDay.name,
                date,
                weekNumber: Math.floor(index / 7) + 1,
                items,
            };
        });
    }
}

interface NormalizedTrainingPlanDay {
    name: string;
    items: NormalizedTrainingPlanItem[];
}

interface NormalizedTrainingPlanItem {
    trainingVideoId: string;
    sets: number;
    repeats: number;
    isSuperset: boolean;
    supersetItems: SupersetItemInput[] | null;
    trainingVideo: TrainingVideoEntity;
    itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    extraVideos: Array<{ trainingVideoId: string }> | null;
    dropsetConfig: { dropPercents: number[]; restSeconds?: number } | null;
    circuitGroup: string | null;
}
