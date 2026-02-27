import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { Roles } from '../../../../constants/roles.js';
import { UserService } from '../../../user/v1/user.service.js';
import { DietPlanRepository } from './diet-plan.repository.js';
import { DietPlanEntity } from './entity/diet-plan.entity.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { addDays, startOfDayUTC } from '../../../../utils/date.utils.js';
import { SubscriptionService } from '../../../subscription/v1/subscription.service.js';
import { AdminSettingsService } from '../../../admin-settings/v1/admin-settings.service.js';

interface DietMealInput {
    mealName?: string;
    order: number;
    text: string;
}

interface CreateDietPlanPayload {
    startDate?: string;
    recommendedWaterIntakeMl?: number;
    meals?: DietMealInput[];
    snacks?: DietMealInput[];
}

export class DietPlanService {
    static async createWeeklyTemplateForUser(
        actor: UserEntity,
        userId: string,
        payload: CreateDietPlanPayload,
    ): Promise<DietPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can create diet plans');
        }

        await UserService.getUserById(userId);
        const subscriptionStatus = await SubscriptionService.getStatus(userId);
        if (!subscriptionStatus.capabilities.canAccessDiet) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'User subscription does not allow diet plans');
        }

        const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid startDate');
        }
        const normalizedStart = startOfDayUTC(startDate);
        // 30-day plan (endDate is exclusive)
        const endDate = addDays(normalizedStart, 30);

        const mealsInput = Array.isArray(payload.meals) ? payload.meals : [];
        const snacksInput = Array.isArray(payload.snacks) ? payload.snacks : [];
        if (mealsInput.length + snacksInput.length < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Template must include at least 1 item in meals or snacks');
        }

        const templateMeals = this.normalizeMeals(mealsInput);
        const templateSnacks = this.normalizeMeals(snacksInput);
        const daysPayload = this.buildDaysPayload(normalizedStart, templateMeals, templateSnacks);

        await DietPlanRepository.createPlan(
            userId,
            normalizedStart,
            endDate,
            daysPayload,
            payload.recommendedWaterIntakeMl ?? null,
        );

        return this.getDietPlan(actor, userId);
    }

    static async getDietPlan(actor: UserEntity, userId: string): Promise<DietPlanEntity> {
        if (actor.role !== Roles.ADMIN && actor.id !== userId) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Not allowed to view this diet plan');
        }

        const subscriptionStatus = await SubscriptionService.getStatus(userId);

        if (!subscriptionStatus.capabilities.canAccessDiet) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Diet plan is not available for current subscription');
        }

        // Free-tier users get default plan if configured
        if (subscriptionStatus.isFreeTier) {
            const defaultPlanId = await AdminSettingsService.getDefaultDietPlanId();
            if (defaultPlanId) {
                const defaultPlan = await DietPlanRepository.findById(defaultPlanId);
                if (defaultPlan) {
                    return defaultPlan;
                }
            }
        }

        const plan = await DietPlanRepository.findByUserId(userId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet plan not found');
        }
        return plan;
    }

    private static normalizeMeals(meals: DietMealInput[]): DietMealInput[] {
        return (meals ?? []).map((m) => ({
            mealName: m.mealName ? String(m.mealName).trim() : undefined,
            order: Number(m.order),
            text: String(m.text ?? '').trim(),
        }));
    }

    private static buildDaysPayload(startDate: Date, templateMeals: DietMealInput[], templateSnacks: DietMealInput[]) {
        return Array.from({ length: 30 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);

            const usedKeys = new Set<string>();
            const buildUniqueName = (baseName: string, order: number, suffixHint?: string) => {
                let candidate = baseName;
                const keyOf = (name: string) => `${name}::${order}`;
                if (!usedKeys.has(keyOf(candidate))) {
                    usedKeys.add(keyOf(candidate));
                    return candidate;
                }

                let counter = 1;
                while (true) {
                    const suffix = suffixHint ? ` (${suffixHint}${counter > 1 ? ` ${counter}` : ''})` : ` (${counter + 1})`;
                    candidate = `${baseName}${suffix}`;
                    if (!usedKeys.has(keyOf(candidate))) {
                        usedKeys.add(keyOf(candidate));
                        return candidate;
                    }
                    counter += 1;
                }
            };

            const meals = (templateMeals ?? [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((m) => ({
                    mealName: buildUniqueName(
                        m.mealName && m.mealName.length > 0 ? m.mealName : `Meal ${m.order}`,
                        m.order,
                    ),
                    order: m.order,
                    foods: [{ text: m.text, itemType: 'MEAL' }],
                }));

            const snacks = (templateSnacks ?? [])
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((m) => ({
                    mealName: buildUniqueName(
                        m.mealName && m.mealName.length > 0 ? m.mealName : `Snack ${m.order}`,
                        m.order,
                        'Snack',
                    ),
                    order: m.order,
                    foods: [{ text: m.text, itemType: 'SNACK' }],
                }));

            const allItems = [...meals, ...snacks];

            return {
                dayIndex: index + 1,
                date,
                weekNumber: Math.floor(index / 7) + 1,
                meals: allItems,
            };
        });
    }
}
