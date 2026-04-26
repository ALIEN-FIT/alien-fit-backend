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
import { SubscriptionService } from '../../../subscription/v1/subscription.service.js';
import { AdminSettingsService } from '../../../admin-settings/v1/admin-settings.service.js';
import { TrainingPlanDayEntity, TrainingPlanItemEntity } from './entity/training-plan.entity.js';
import {
    buildTrainingPlanItemUpdateInput,
    type UpdateTrainingPlanItemPayload,
} from './training-plan-item-normalization.js';

interface SupersetItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

interface CircuitItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

interface TrainingPlanItemInput {
    trainingVideoId?: string;
    sets?: number;
    repeats?: number;
    itemType?: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    isSuperset?: boolean; // legacy
    supersetItems?: SupersetItemInput[];
    extraVideos?: Array<{ trainingVideoId: string }>;
    dropsetConfig?: { dropPercents: number[]; restSeconds?: number };
    circuitItems?: CircuitItemInput[];
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
    addItems?: TrainingPlanItemInput[];
    removeItemIds?: string[];
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

    static async getTrainingPlanHistory(actor: UserEntity, userId: string): Promise<TrainingPlanEntity[]> {
        if (actor.role !== Roles.ADMIN && actor.id !== userId) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Not allowed to view this training plan history');
        }

        await UserService.getUserById(userId);
        return TrainingPlanRepository.listByUserId(userId);
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

        const plan = await this.getEditablePlanVersion(planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const day = snapshot.days.find((currentDay) => currentDay.dayIndex === dayIndex);
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        if (payload.items && ((payload.addItems?.length ?? 0) > 0 || (payload.removeItemIds?.length ?? 0) > 0)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Use either items replacement or addItems/removeItemIds, not both');
        }

        if (payload.items) {
            const videoIds = this.collectVideoIds([{ name: day.name ?? `Day ${dayIndex}`, dayNumber: dayIndex, items: payload.items }]);
            const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);
            const normalizedItems = payload.items.map((item) => this.normalizeItem(item, trainingVideosMap));

            day.items = normalizedItems.map((item, index) => this.buildSnapshotItem(item, index + 1));
        } else {
            if (payload.removeItemIds?.length) {
                const requestedIds = new Set(payload.removeItemIds);
                const existingIds = new Set(day.items.map((item) => item.id).filter(Boolean));
                const missingIds = payload.removeItemIds.filter((itemId) => !existingIds.has(itemId));
                if (missingIds.length > 0) {
                    throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan item not found');
                }

                day.items = day.items
                    .filter((item) => !item.id || !requestedIds.has(item.id))
                    .map((item, index) => ({
                        ...item,
                        order: index + 1,
                    }));
            }

            if (payload.addItems?.length) {
                const videoIds = this.collectVideoIds([{ name: day.name ?? `Day ${dayIndex}`, dayNumber: dayIndex, items: payload.addItems }]);
                const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);
                const normalizedItems = payload.addItems.map((item) => this.normalizeItem(item, trainingVideosMap));

                day.items.push(...normalizedItems.map((item, index) => this.buildSnapshotItem(item, day.items.length + index + 1)));
            }
        }

        if (payload.name !== undefined) {
            day.name = payload.name?.trim() || null;
        }

        return this.createPlanVersion(snapshot);
    }

    static async clearPlanDayByPlanId(actor: UserEntity, planId: string, dayIndex: number): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const plan = await this.getEditablePlanVersion(planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const day = snapshot.days.find((currentDay) => currentDay.dayIndex === dayIndex);
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        day.items = [];
        return this.createPlanVersion(snapshot);
    }

    static async addPlanItemByPlanId(
        actor: UserEntity,
        planId: string,
        dayIndex: number,
        payload: TrainingPlanItemInput,
    ): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const plan = await this.getEditablePlanVersion(planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const day = snapshot.days.find((currentDay) => currentDay.dayIndex === dayIndex);
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        const videoIds = this.collectVideoIds([{ name: day.name ?? `Day ${dayIndex}`, dayNumber: dayIndex, items: [payload] }]);
        const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);
        const normalized = this.normalizeItem(payload, trainingVideosMap);

        day.items.push(this.buildSnapshotItem(normalized, day.items.length + 1));

        return this.createPlanVersion(snapshot);
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

        const currentData: TrainingPlanItemInput = buildTrainingPlanItemUpdateInput(item, payload);

        const videoIds = this.collectVideoIds([{ name: 'day', items: [currentData] }]);
        const trainingVideosMap = await TrainingVideoService.ensureVideosExist(videoIds);
        const normalized = this.normalizeItem(currentData, trainingVideosMap);
        const day = (item as any).day as TrainingPlanDayEntity;
        const plan = await this.getEditablePlanVersion(day.planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const targetDay = snapshot.days.find((currentDay) => currentDay.id === day.id);
        const targetItem = targetDay?.items.find((currentItem) => currentItem.id === itemId);
        if (!targetDay || !targetItem) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan item not found');
        }

        targetItem.title = normalized.trainingVideo.title;
        targetItem.videoLink = normalized.trainingVideo.videoUrl;
        targetItem.description = normalized.trainingVideo.description ?? null;
        targetItem.repeats = normalized.repeats;
        targetItem.sets = normalized.sets;
        targetItem.trainingVideoId = normalized.trainingVideoId;
        targetItem.isSuperset = normalized.itemType === 'SUPERSET';
        targetItem.itemType = normalized.itemType;
        targetItem.supersetItems = normalized.itemType === 'SUPERSET'
            ? (normalized.supersetItems ?? []).map((superset) => ({
                trainingVideoId: superset.trainingVideoId,
                sets: superset.sets,
                repeats: superset.repeats,
            }))
            : null;
        targetItem.extraVideos = normalized.itemType === 'SUPERSET'
            ? (normalized.extraVideos ?? []).map((video) => ({ trainingVideoId: video.trainingVideoId }))
            : null;
        targetItem.dropsetConfig = normalized.itemType === 'DROPSET'
            ? {
                dropPercents: normalized.dropsetConfig?.dropPercents ?? [],
                ...(normalized.dropsetConfig?.restSeconds !== undefined ? { restSeconds: normalized.dropsetConfig.restSeconds } : {}),
            }
            : null;
        targetItem.circuitItems = normalized.itemType === 'CIRCUIT'
            ? (normalized.circuitItems ?? []).map((circuitItem) => ({
                trainingVideoId: circuitItem.trainingVideoId,
                sets: circuitItem.sets,
                repeats: circuitItem.repeats,
            }))
            : null;
        targetItem.circuitGroup = normalized.itemType === 'CIRCUIT' ? normalized.circuitGroup ?? null : null;

        return this.createPlanVersion(snapshot);
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
        const plan = await this.getEditablePlanVersion(day.planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const targetDay = snapshot.days.find((currentDay) => currentDay.id === day.id);
        if (!targetDay) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        targetDay.items = targetDay.items
            .filter((currentItem) => currentItem.id !== itemId)
            .map((currentItem, index) => ({
                ...currentItem,
                order: index + 1,
            }));

        return this.createPlanVersion(snapshot);
    }

    static async deletePlanItemByPlanId(
        actor: UserEntity,
        planId: string,
        dayIndex: number,
        itemId: string,
    ): Promise<TrainingPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust training plans');
        }

        const plan = await this.getEditablePlanVersion(planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const targetDay = snapshot.days.find((currentDay) => currentDay.dayIndex === dayIndex);
        if (!targetDay) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan day not found');
        }

        const itemExists = targetDay.items.some((currentItem) => currentItem.id === itemId);
        if (!itemExists) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan item not found');
        }

        targetDay.items = targetDay.items
            .filter((currentItem) => currentItem.id !== itemId)
            .map((currentItem, index) => ({
                ...currentItem,
                order: index + 1,
            }));

        return this.createPlanVersion(snapshot);
    }

    private static collectVideoIds(days: TrainingPlanDayInput[]): string[] {
        const ids = new Set<string>();
        for (const day of days) {
            for (const item of day.items ?? []) {
                if (item.itemType === 'CIRCUIT') {
                    for (const circuitItem of item.circuitItems ?? []) {
                        ids.add(circuitItem.trainingVideoId);
                    }
                    if (item.trainingVideoId) {
                        ids.add(item.trainingVideoId);
                    }
                    continue;
                }
                if (item.trainingVideoId) {
                    ids.add(item.trainingVideoId);
                }
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
            template[position] = {
                name: String(day.name ?? '').trim() || `Day ${position + 1}`,
                items: normalizedItems,
            };
        });

        return template;
    }

    private static normalizeItem(
        item: TrainingPlanItemInput,
        videoMap: Map<string, TrainingVideoEntity>,
    ): NormalizedTrainingPlanItem {
        const itemType = item.itemType ?? (item.isSuperset ? 'SUPERSET' : 'REGULAR');

        if (!['REGULAR', 'SUPERSET', 'DROPSET', 'CIRCUIT'].includes(itemType)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Invalid itemType: ${String(itemType)}`);
        }

        let supersetItems: SupersetItemInput[] | null = null;
        let extraVideos: Array<{ trainingVideoId: string }> | null = null;
        let dropsetConfig: { dropPercents: number[]; restSeconds?: number } | null = null;
        let circuitItems: CircuitItemInput[] | null = null;
        let circuitGroup: string | null = null;
        let trainingVideoId: string;
        let sets: number;
        let repeats: number;

        const resolveVideo = (videoId: string, errorLabel = 'training video') => {
            const video = videoMap.get(videoId);
            if (!video) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, `Unknown ${errorLabel}: ${videoId}`);
            }
            return video;
        };

        if (itemType === 'SUPERSET') {
            if (!item.trainingVideoId) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'SUPERSET must include trainingVideoId');
            }
            if (!Number.isFinite(item.sets) || item.sets < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'sets must be a positive number');
            }
            if (!Number.isFinite(item.repeats) || item.repeats < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'repeats must be a positive number');
            }
            if (item.circuitItems?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'SUPERSET cannot include circuitItems');
            }
            if (!Array.isArray(item.supersetItems) || item.supersetItems.length < 1) {
                throw new HttpResponseError(
                    StatusCodes.BAD_REQUEST,
                    'SUPERSET must include at least 2 exercises (provide supersetItems with length >= 1)',
                );
            }
            trainingVideoId = item.trainingVideoId;
            sets = item.sets;
            repeats = item.repeats;
            supersetItems = (item.supersetItems ?? []).map((superset) => {
                resolveVideo(superset.trainingVideoId);
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
                resolveVideo(ev.trainingVideoId);
                return { trainingVideoId: ev.trainingVideoId };
            });
        } else if (itemType === 'DROPSET') {
            if (!item.trainingVideoId) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'DROPSET must include trainingVideoId');
            }
            if (!Number.isFinite(item.sets) || item.sets < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'sets must be a positive number');
            }
            if (!Number.isFinite(item.repeats) || item.repeats < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'repeats must be a positive number');
            }
            if (item.circuitItems?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'DROPSET cannot include circuitItems');
            }
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
            trainingVideoId = item.trainingVideoId;
            sets = item.sets;
            repeats = item.repeats;
            dropsetConfig = { dropPercents, restSeconds: item.dropsetConfig.restSeconds };
        } else if (itemType === 'CIRCUIT') {
            if (item.supersetItems?.length || item.extraVideos?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT cannot include supersetItems or extraVideos');
            }
            if (item.dropsetConfig) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT cannot include dropsetConfig');
            }
            if (item.circuitItems?.length) {
                if (item.circuitGroup) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'CIRCUIT cannot include circuitGroup when circuitItems are provided');
                }
                circuitItems = item.circuitItems.map((circuitItem) => {
                    resolveVideo(circuitItem.trainingVideoId, 'training video');
                    if (!Number.isFinite(circuitItem.sets) || circuitItem.sets < 1) {
                        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'circuitItem.sets must be a positive number');
                    }
                    if (!Number.isFinite(circuitItem.repeats) || circuitItem.repeats < 1) {
                        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'circuitItem.repeats must be a positive number');
                    }
                    return {
                        trainingVideoId: circuitItem.trainingVideoId,
                        sets: circuitItem.sets,
                        repeats: circuitItem.repeats,
                    };
                });
                trainingVideoId = circuitItems[0].trainingVideoId;
                sets = circuitItems[0].sets;
                repeats = circuitItems[0].repeats;
            } else {
                if (!item.trainingVideoId) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Legacy CIRCUIT items must include trainingVideoId');
                }
                if (!Number.isFinite(item.sets) || item.sets < 1) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'sets must be a positive number');
                }
                if (!Number.isFinite(item.repeats) || item.repeats < 1) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'repeats must be a positive number');
                }
                circuitGroup = (item.circuitGroup ?? '').trim() || null;
                if (!circuitGroup) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Legacy CIRCUIT items must include circuitGroup');
                }
                trainingVideoId = item.trainingVideoId;
                sets = item.sets;
                repeats = item.repeats;
            }
        } else {
            // REGULAR
            if (!item.trainingVideoId) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR must include trainingVideoId');
            }
            if (!Number.isFinite(item.sets) || item.sets < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'sets must be a positive number');
            }
            if (!Number.isFinite(item.repeats) || item.repeats < 1) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'repeats must be a positive number');
            }
            if (item.circuitItems?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include circuitItems');
            }
            if (item.supersetItems?.length || item.extraVideos?.length) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include supersetItems or extraVideos');
            }
            if (item.dropsetConfig) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include dropsetConfig');
            }
            if (item.circuitGroup) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'REGULAR cannot include circuitGroup');
            }
            trainingVideoId = item.trainingVideoId;
            sets = item.sets;
            repeats = item.repeats;
        }

        const trainingVideo = resolveVideo(trainingVideoId);

        return {
            trainingVideoId,
            sets,
            repeats,
            isSuperset: itemType === 'SUPERSET',
            supersetItems,
            circuitItems,
            trainingVideo,
            itemType,
            extraVideos,
            dropsetConfig,
            circuitGroup,
        };
    }

    private static buildSnapshotItem(item: NormalizedTrainingPlanItem, order: number) {
        return {
            order,
            title: item.trainingVideo.title,
            videoLink: item.trainingVideo.videoUrl,
            description: item.trainingVideo.description ?? null,
            duration: null,
            repeats: item.repeats,
            sets: item.sets,
            trainingVideoId: item.trainingVideoId,
            isSuperset: item.itemType === 'SUPERSET',
            itemType: item.itemType,
            supersetItems: item.itemType === 'SUPERSET'
                ? (item.supersetItems ?? []).map((superset) => ({
                    trainingVideoId: superset.trainingVideoId,
                    sets: superset.sets,
                    repeats: superset.repeats,
                }))
                : null,
            extraVideos: item.itemType === 'SUPERSET'
                ? (item.extraVideos ?? []).map((video) => ({ trainingVideoId: video.trainingVideoId }))
                : null,
            dropsetConfig: item.itemType === 'DROPSET'
                ? {
                    dropPercents: item.dropsetConfig?.dropPercents ?? [],
                    ...(item.dropsetConfig?.restSeconds !== undefined ? { restSeconds: item.dropsetConfig.restSeconds } : {}),
                }
                : null,
            circuitItems: item.itemType === 'CIRCUIT'
                ? (item.circuitItems ?? []).map((circuitItem) => ({
                    trainingVideoId: circuitItem.trainingVideoId,
                    sets: circuitItem.sets,
                    repeats: circuitItem.repeats,
                }))
                : null,
            circuitGroup: item.itemType === 'CIRCUIT' ? item.circuitGroup ?? null : null,
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
                circuitItems: item.itemType === 'CIRCUIT' ? item.circuitItems ?? null : null,
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

    private static clonePlanSnapshot(plan: TrainingPlanEntity) {
        return JSON.parse(JSON.stringify(plan.toJSON())) as {
            id: string;
            userId: string | null;
            startDate: string;
            endDate: string;
            days: Array<{
                id: string;
                dayIndex: number;
                name: string | null;
                date: string;
                weekNumber: number;
                items: Array<{
                    id?: string;
                    order: number;
                    title: string;
                    videoLink: string | null;
                    description: string | null;
                    duration: number | null;
                    repeats: number | null;
                    sets: number | null;
                    trainingVideoId: string;
                    isSuperset: boolean;
                    itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
                    supersetItems: Array<Record<string, unknown>> | null;
                    extraVideos: Array<Record<string, unknown>> | null;
                    dropsetConfig: Record<string, unknown> | null;
                    circuitItems: Array<Record<string, unknown>> | null;
                    circuitGroup: string | null;
                }>;
            }>;
        };
    }

    private static async getEditablePlanVersion(planId: string): Promise<TrainingPlanEntity> {
        const plan = await TrainingPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Training plan not found');
        }

        if (plan.userId) {
            const latestPlan = await TrainingPlanRepository.findByUserId(plan.userId);
            if (latestPlan && latestPlan.id !== plan.id) {
                throw new HttpResponseError(StatusCodes.CONFLICT, 'Only the latest training plan version can be updated');
            }
        }

        return plan;
    }

    private static async createPlanVersion(
        snapshot: ReturnType<typeof TrainingPlanService.clonePlanSnapshot>,
    ): Promise<TrainingPlanEntity> {
        const days = (snapshot.days ?? [])
            .slice()
            .sort((a, b) => a.dayIndex - b.dayIndex)
            .map((day) => ({
                dayIndex: day.dayIndex,
                name: day.name ?? null,
                date: new Date(day.date),
                weekNumber: day.weekNumber,
                items: (day.items ?? [])
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((item, index) => ({
                        order: index + 1,
                        title: item.title,
                        videoLink: item.videoLink ?? null,
                        description: item.description ?? null,
                        duration: item.duration ?? null,
                        repeats: item.repeats ?? null,
                        sets: Number(item.sets ?? 0),
                        trainingVideoId: item.trainingVideoId,
                        isSuperset: Boolean(item.isSuperset),
                        itemType: item.itemType,
                        supersetItems: item.itemType === 'SUPERSET' ? item.supersetItems ?? [] : null,
                        extraVideos: item.itemType === 'SUPERSET' ? item.extraVideos ?? [] : null,
                        dropsetConfig: item.itemType === 'DROPSET' ? item.dropsetConfig ?? null : null,
                        circuitItems: item.itemType === 'CIRCUIT' ? item.circuitItems ?? null : null,
                        circuitGroup: item.itemType === 'CIRCUIT' ? item.circuitGroup ?? null : null,
                    })),
            }));

        const created = snapshot.userId
            ? await TrainingPlanRepository.createPlan(
                snapshot.userId,
                new Date(snapshot.startDate),
                new Date(snapshot.endDate),
                days,
            )
            : await TrainingPlanRepository.createDefaultPlan(
                new Date(snapshot.startDate),
                new Date(snapshot.endDate),
                days,
            );

        return (await TrainingPlanRepository.findById(created.id)) as TrainingPlanEntity;
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
    circuitItems: CircuitItemInput[] | null;
    trainingVideo: TrainingVideoEntity;
    itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    extraVideos: Array<{ trainingVideoId: string }> | null;
    dropsetConfig: { dropPercents: number[]; restSeconds?: number } | null;
    circuitGroup: string | null;
}
