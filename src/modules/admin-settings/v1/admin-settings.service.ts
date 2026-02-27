import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { AdminSettingsEntity } from './entity/admin-settings.entity.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { Roles } from '../../../constants/roles.js';
import { DietPlanRepository } from '../../plans/diet/v1/diet-plan.repository.js';
import { TrainingPlanRepository } from '../../plans/training/v1/training-plan.repository.js';
import { addDays, addWeeks, startOfDayUTC } from '../../../utils/date.utils.js';
import { TrainingVideoService } from '../../training-video/v1/training-video.service.js';

export enum SettingKeys {
    DEFAULT_FREE_DAYS = 'DEFAULT_FREE_DAYS',
    DEFAULT_TRAINING_PLAN_ID = 'DEFAULT_TRAINING_PLAN_ID',
    DEFAULT_DIET_PLAN_ID = 'DEFAULT_DIET_PLAN_ID',
}

export class AdminSettingsService {
    static async setSetting(key: string, value: string): Promise<AdminSettingsEntity> {
        const [setting] = await AdminSettingsEntity.upsert({
            settingKey: key,
            settingValue: value,
        });

        return setting;
    }

    static async getSetting(key: string): Promise<string | null> {
        const setting = await AdminSettingsEntity.findOne({
            where: { settingKey: key },
        });

        return setting?.settingValue || null;
    }

    static async getAllSettings(): Promise<Record<string, string>> {
        const settings = await AdminSettingsEntity.findAll();
        const result: Record<string, string> = {};

        settings.forEach((setting) => {
            result[setting.settingKey] = setting.settingValue;
        });

        return result;
    }

    static async setDefaultFreeDays(actor: UserEntity, days: number): Promise<void> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can set default free days');
        }

        if (days < 0 || days > 365) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Free days must be between 0 and 365');
        }

        await this.setSetting(SettingKeys.DEFAULT_FREE_DAYS, days.toString());
    }

    static async getDefaultFreeDays(): Promise<number> {
        const value = await this.getSetting(SettingKeys.DEFAULT_FREE_DAYS);
        return value ? parseInt(value, 10) : 7; // Default to 7 days
    }

    static async setDefaultTrainingPlanId(actor: UserEntity, planId: string): Promise<void> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can set default training plan');
        }

        await this.setSetting(SettingKeys.DEFAULT_TRAINING_PLAN_ID, planId);
    }

    static async getDefaultTrainingPlanId(): Promise<string | null> {
        return this.getSetting(SettingKeys.DEFAULT_TRAINING_PLAN_ID);
    }

    static async setDefaultDietPlanId(actor: UserEntity, planId: string): Promise<void> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can set default diet plan');
        }

        await this.setSetting(SettingKeys.DEFAULT_DIET_PLAN_ID, planId);
    }

    static async getDefaultDietPlanId(): Promise<string | null> {
        return this.getSetting(SettingKeys.DEFAULT_DIET_PLAN_ID);
    }

    static async setUserFreeDays(actor: UserEntity, userId: string, freeDays: number): Promise<void> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can set user free days');
        }

        if (freeDays < 0 || freeDays > 365) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Free days must be between 0 and 365');
        }

        const user = await UserEntity.findByPk(userId);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        user.freeDays = freeDays;
        await user.save();
    }

    static async createAndSetDefaultDietPlan(actor: UserEntity, payload: CreateDefaultDietPlanPayload): Promise<string> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can create default diet plans');
        }

        const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid startDate');
        }
        const normalizedStart = startOfDayUTC(startDate);
        // 30-day plan (endDate is exclusive)
        const endDate = addDays(normalizedStart, 30);

        if (!Array.isArray(payload.meals) || payload.meals.length < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Template must include at least 1 meal item');
        }

        const templateMeals = this.normalizeDietMeals(payload.meals);
        const daysPayload = this.buildDietDaysPayload(normalizedStart, templateMeals);

        const plan = await DietPlanRepository.createDefaultPlan(
            normalizedStart,
            endDate,
            daysPayload,
            payload.recommendedWaterIntakeMl ?? null,
        );

        await this.setSetting(SettingKeys.DEFAULT_DIET_PLAN_ID, plan.id);

        return plan.id;
    }

    static async createAndSetDefaultTrainingPlan(actor: UserEntity, payload: CreateDefaultTrainingPlanPayload): Promise<string> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can create default training plans');
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

        const normalizedTemplate = this.normalizeTrainingTemplate(payload.days, trainingVideosMap);
        const daysPayload = this.buildTrainingDaysPayload(normalizedStart, normalizedTemplate);

        const plan = await TrainingPlanRepository.createDefaultPlan(normalizedStart, endDate, daysPayload as any);

        await this.setSetting(SettingKeys.DEFAULT_TRAINING_PLAN_ID, plan.id);

        return plan.id;
    }

    private static normalizeDietMeals(meals: DietMealInput[]): DietMealInput[] {
        return (meals ?? []).map((m) => ({
            mealName: String(m.mealName ?? '').trim(),
            order: Number(m.order),
            text: String(m.text ?? '').trim(),
        }));
    }

    private static buildDietDaysPayload(startDate: Date, templateMeals: DietMealInput[]) {
        return Array.from({ length: 30 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);

            const meals = (templateMeals ?? [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((m) => ({
                    mealName: m.mealName,
                    order: m.order,
                    foods: [{ text: m.text }],
                }));

            return {
                dayIndex: index + 1,
                date,
                weekNumber: Math.floor(index / 7) + 1,
                meals,
            };
        });
    }

    private static collectVideoIds(days: TrainingDayInput[]): string[] {
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

    private static normalizeTrainingTemplate(days: TrainingDayInput[], videoMap: Map<string, any>): NormalizedTrainingItem[][] {
        const template: NormalizedTrainingItem[][] = Array.from({ length: 7 }, () => []);

        days.forEach((day, index) => {
            const position = day.dayNumber ? day.dayNumber - 1 : index;
            if (position < 0 || position > 6) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dayNumber must be between 1 and 7');
            }
            const normalizedItems = day.items?.map((item) => this.normalizeTrainingItem(item, videoMap)) ?? [];
            this.assertCircuitGroupsAreValid(normalizedItems);
            template[position] = normalizedItems;
        });

        return template;
    }

    private static assertCircuitGroupsAreValid(items: NormalizedTrainingItem[]) {
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

    private static normalizeTrainingItem(item: TrainingItemInput, videoMap: Map<string, any>): NormalizedTrainingItem {
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

    private static buildTrainingDaysPayload(startDate: Date, template: NormalizedTrainingItem[][]) {
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
                itemType: item.itemType,
                supersetItems: item.isSuperset ? item.supersetItems ?? [] : null,
                extraVideos: item.itemType === 'SUPERSET' ? item.extraVideos ?? [] : null,
                dropsetConfig: item.itemType === 'DROPSET' ? item.dropsetConfig ?? null : null,
                circuitGroup: item.itemType === 'CIRCUIT' ? item.circuitGroup ?? null : null,
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

// Type definitions for the new methods
interface DietMealInput {
    mealName: string;
    order: number;
    text: string;
}

interface CreateDefaultDietPlanPayload {
    startDate?: string;
    recommendedWaterIntakeMl?: number;
    meals: DietMealInput[];
}

interface SupersetItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
}

interface TrainingItemInput {
    trainingVideoId: string;
    sets: number;
    repeats: number;
    itemType?: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    isSuperset?: boolean;
    supersetItems?: SupersetItemInput[];
    extraVideos?: Array<{ trainingVideoId: string }>;
    dropsetConfig?: { dropPercents: number[]; restSeconds?: number };
    circuitGroup?: string;
}

interface TrainingDayInput {
    dayNumber?: number;
    items: TrainingItemInput[];
}

interface CreateDefaultTrainingPlanPayload {
    startDate?: string;
    days: TrainingDayInput[];
}

interface NormalizedTrainingItem {
    trainingVideoId: string;
    sets: number;
    repeats: number;
    isSuperset: boolean;
    supersetItems: SupersetItemInput[] | null;
    trainingVideo: any;
    itemType: 'REGULAR' | 'SUPERSET' | 'DROPSET' | 'CIRCUIT';
    extraVideos: Array<{ trainingVideoId: string }> | null;
    dropsetConfig: { dropPercents: number[]; restSeconds?: number } | null;
    circuitGroup: string | null;
}
