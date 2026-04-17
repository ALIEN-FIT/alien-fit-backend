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
import { DietMealItemEntity, DietPlanDayEntity } from './entity/diet-plan.entity.js';

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

interface UpdateDietPlanDayPayload {
    meals?: DietMealInput[];
    snacks?: DietMealInput[];
}

interface UpdateDietMealPayload {
    mealName?: string;
    order?: number;
    text?: string;
    itemType?: 'MEAL' | 'SNACK';
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

    static async getDietPlanHistory(actor: UserEntity, userId: string): Promise<DietPlanEntity[]> {
        if (actor.role !== Roles.ADMIN && actor.id !== userId) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Not allowed to view this diet plan history');
        }

        await UserService.getUserById(userId);
        return DietPlanRepository.listByUserId(userId);
    }

    static async updatePlanDayByPlanId(
        actor: UserEntity,
        planId: string,
        dayIndex: number,
        payload: UpdateDietPlanDayPayload,
    ): Promise<DietPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust diet plans');
        }

        const plan = await this.getEditablePlanVersion(planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const day = snapshot.days.find((currentDay) => currentDay.dayIndex === dayIndex);
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet plan day not found');
        }

        const mealsInput = payload.meals ? this.normalizeMeals(payload.meals) : [];
        const snacksInput = payload.snacks ? this.normalizeMeals(payload.snacks) : [];
        day.meals = this.buildDietEntries(mealsInput, snacksInput);

        return this.createPlanVersion(snapshot);
    }

    static async clearPlanDayByPlanId(actor: UserEntity, planId: string, dayIndex: number): Promise<DietPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust diet plans');
        }

        const plan = await this.getEditablePlanVersion(planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const day = snapshot.days.find((currentDay) => currentDay.dayIndex === dayIndex);
        if (!day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet plan day not found');
        }

        day.meals = [];
        return this.createPlanVersion(snapshot);
    }

    static async updateMealById(actor: UserEntity, mealItemId: string, payload: UpdateDietMealPayload): Promise<DietPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust diet plans');
        }

        const meal = await DietMealItemEntity.findByPk(mealItemId, {
            include: [{ model: DietPlanDayEntity, as: 'day' }],
        });
        if (!meal || !(meal as any).day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet meal item not found');
        }

        const day = (meal as any).day as DietPlanDayEntity;
        const plan = await this.getEditablePlanVersion(day.planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const targetDay = snapshot.days.find((currentDay) => currentDay.id === day.id);
        const targetMeal = targetDay?.meals.find((currentMeal) => currentMeal.id === mealItemId);
        if (!targetDay || !targetMeal) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet meal item not found');
        }

        const currentText = String((targetMeal.foods?.[0] as any)?.text ?? '');
        const currentItemType = String((targetMeal.foods?.[0] as any)?.itemType ?? 'MEAL');
        const itemType = payload.itemType ?? (currentItemType === 'SNACK' ? 'SNACK' : 'MEAL');

        targetMeal.mealName = payload.mealName ?? targetMeal.mealName;
        targetMeal.order = payload.order ?? targetMeal.order;
        targetMeal.foods = [{ text: payload.text ?? currentText, itemType }];
        targetDay.meals = this.sortMealsByOrder(targetDay.meals);

        return this.createPlanVersion(snapshot);
    }

    static async deleteMealById(actor: UserEntity, mealItemId: string): Promise<DietPlanEntity> {
        if (actor.role !== Roles.ADMIN) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only admins can adjust diet plans');
        }

        const meal = await DietMealItemEntity.findByPk(mealItemId, {
            include: [{ model: DietPlanDayEntity, as: 'day' }],
        });
        if (!meal || !(meal as any).day) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet meal item not found');
        }

        const day = (meal as any).day as DietPlanDayEntity;
        const plan = await this.getEditablePlanVersion(day.planId);
        const snapshot = this.clonePlanSnapshot(plan);
        const targetDay = snapshot.days.find((currentDay) => currentDay.id === day.id);
        if (!targetDay) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet plan day not found');
        }

        targetDay.meals = this.reorderMeals(targetDay.meals.filter((currentMeal) => currentMeal.id !== mealItemId));
        return this.createPlanVersion(snapshot);
    }

    private static normalizeMeals(meals: DietMealInput[]): DietMealInput[] {
        return (meals ?? []).map((m) => ({
            mealName: m.mealName ? String(m.mealName).trim() : undefined,
            order: Number(m.order),
            text: String(m.text ?? '').trim(),
        }));
    }

    private static buildDietEntries(meals: DietMealInput[], snacks: DietMealInput[]) {
        return this.sortMealsByOrder([
            ...meals.map((meal) => ({
                mealName: meal.mealName && meal.mealName.length > 0 ? meal.mealName : `Meal ${meal.order}`,
                order: meal.order,
                foods: [{ text: meal.text, itemType: 'MEAL' as const }],
            })),
            ...snacks.map((snack) => ({
                mealName: snack.mealName && snack.mealName.length > 0 ? snack.mealName : `Snack ${snack.order}`,
                order: snack.order,
                foods: [{ text: snack.text, itemType: 'SNACK' as const }],
            })),
        ]);
    }

    private static sortMealsByOrder<T extends { order: number }>(meals: T[]): T[] {
        return meals
            .slice()
            .sort((a, b) => a.order - b.order);
    }

    private static reorderMeals<T extends { order: number }>(meals: T[]): T[] {
        return this.sortMealsByOrder(meals)
            .map((meal, index) => ({
                ...meal,
                order: index + 1,
            }));
    }

    private static clonePlanSnapshot(plan: DietPlanEntity) {
        return JSON.parse(JSON.stringify(plan.toJSON())) as {
            id: string;
            userId: string | null;
            startDate: string;
            endDate: string;
            recommendedWaterIntakeMl: number | null;
            days: Array<{
                id: string;
                dayIndex: number;
                date: string;
                weekNumber: number;
                meals: Array<{
                    id?: string;
                    mealName: string | null;
                    order: number;
                    foods: Array<Record<string, unknown>>;
                }>;
            }>;
        };
    }

    private static async getEditablePlanVersion(planId: string): Promise<DietPlanEntity> {
        const plan = await DietPlanRepository.findById(planId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet plan not found');
        }

        if (plan.userId) {
            const latestPlan = await DietPlanRepository.findByUserId(plan.userId);
            if (latestPlan && latestPlan.id !== plan.id) {
                throw new HttpResponseError(StatusCodes.CONFLICT, 'Only the latest diet plan version can be updated');
            }
        }

        return plan;
    }

    private static async createPlanVersion(snapshot: ReturnType<typeof DietPlanService.clonePlanSnapshot>): Promise<DietPlanEntity> {
        const days = (snapshot.days ?? [])
            .slice()
            .sort((a, b) => a.dayIndex - b.dayIndex)
            .map((day) => ({
                dayIndex: day.dayIndex,
                date: new Date(day.date),
                weekNumber: day.weekNumber,
                meals: this.sortMealsByOrder(day.meals ?? []).map((meal) => ({
                    mealName: meal.mealName ?? null,
                    order: meal.order,
                    foods: Array.isArray(meal.foods) ? meal.foods : [],
                })),
            }));

        const created = snapshot.userId
            ? await DietPlanRepository.createPlan(
                snapshot.userId,
                new Date(snapshot.startDate),
                new Date(snapshot.endDate),
                days,
                snapshot.recommendedWaterIntakeMl ?? null,
            )
            : await DietPlanRepository.createDefaultPlan(
                new Date(snapshot.startDate),
                new Date(snapshot.endDate),
                days,
                snapshot.recommendedWaterIntakeMl ?? null,
            );

        return (await DietPlanRepository.findById(created.id)) as DietPlanEntity;
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
