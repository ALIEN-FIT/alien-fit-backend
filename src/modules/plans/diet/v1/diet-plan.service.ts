import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { Roles } from '../../../../constants/roles.js';
import { UserService } from '../../../user/v1/user.service.js';
import { DietPlanRepository } from './diet-plan.repository.js';
import { DietPlanEntity } from './entity/diet-plan.entity.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { addWeeks, startOfDayUTC } from '../../../../utils/date.utils.js';

interface FoodInput {
    name: string;
    grams: number;
    calories: number;
    fats: number;
    carbs: number;
}

interface DietMealInput {
    mealName: string;
    order: number;
    foods: FoodInput[];
}

interface DietPlanDayInput {
    dayNumber?: number;
    meals: DietMealInput[];
}

interface CreateDietPlanPayload {
    startDate?: string;
    recommendedWaterIntakeMl?: number;
    days: DietPlanDayInput[];
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

        const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid startDate');
        }
        const normalizedStart = startOfDayUTC(startDate);
        const endDate = addWeeks(normalizedStart, 4);

        if (!Array.isArray(payload.days) || payload.days.length !== 7) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Template must include exactly 7 days');
        }

        const template = this.normalizeTemplate(payload.days);
        const daysPayload = this.buildDaysPayload(normalizedStart, template);

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

        const plan = await DietPlanRepository.findByUserId(userId);
        if (!plan) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Diet plan not found');
        }
        return plan;
    }

    private static normalizeTemplate(days: DietPlanDayInput[]): Array<DietMealInput[]> {
        const template: Array<DietMealInput[]> = Array.from({ length: 7 }, () => []);

        days.forEach((day, index) => {
            const position = day.dayNumber ? day.dayNumber - 1 : index;
            if (position < 0 || position > 6) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dayNumber must be between 1 and 7');
            }
            const meals = day.meals ?? [];
            template[position] = meals.map((m) => ({
                mealName: m.mealName,
                order: m.order,
                foods: m.foods.map((f) => ({
                    name: f.name,
                    grams: f.grams,
                    calories: f.calories,
                    fats: f.fats,
                    carbs: f.carbs,
                })),
            }));
        });

        return template;
    }

    private static buildDaysPayload(startDate: Date, template: Array<DietMealInput[]>) {
        return Array.from({ length: 28 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            const templateMeals = template[index % 7];

            const meals = templateMeals
                .sort((a, b) => a.order - b.order)
                .map((m) => ({
                    mealName: m.mealName,
                    order: m.order,
                    foods: m.foods,
                }));

            return {
                dayIndex: index + 1,
                date,
                weekNumber: Math.floor(index / 7) + 1,
                meals,
            };
        });
    }
}
