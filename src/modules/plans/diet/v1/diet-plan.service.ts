import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../../utils/appError.js';
import { Roles } from '../../../../constants/roles.js';
import { UserService } from '../../../user/v1/user.service.js';
import { DietPlanRepository } from './diet-plan.repository.js';
import { DietPlanEntity } from './entity/diet-plan.entity.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { addWeeks, startOfDayUTC } from '../../../../utils/date.utils.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;

type MealType = typeof MEAL_TYPES[number];

interface DietMealInput {
    foodName: string;
    amount: string;
}

interface DietPlanDayInput {
    dayNumber?: number;
    meals: Partial<Record<MealType, DietMealInput[]>>;
}

interface CreateDietPlanPayload {
    startDate?: string;
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

        await DietPlanRepository.createPlan(userId, normalizedStart, endDate, daysPayload);

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

    private static normalizeTemplate(days: DietPlanDayInput[]): Array<Record<MealType, DietMealInput[]>> {
        const template = Array.from({ length: 7 }, () => {
            const mealsRecord: Record<MealType, DietMealInput[]> = {
                breakfast: [],
                lunch: [],
                snacks: [],
                dinner: [],
            };
            return mealsRecord;
        });

        days.forEach((day, index) => {
            const position = day.dayNumber ? day.dayNumber - 1 : index;
            if (position < 0 || position > 6) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'dayNumber must be between 1 and 7');
            }
            const meals = day.meals ?? {};
            for (const mealType of MEAL_TYPES) {
                template[position][mealType] = (meals[mealType] ?? []).map((meal) => ({
                    foodName: meal.foodName,
                    amount: meal.amount,
                }));
            }
        });

        return template;
    }

    private static buildDaysPayload(startDate: Date, template: Array<Record<MealType, DietMealInput[]>>) {
        return Array.from({ length: 28 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            const templateDay = template[index % 7];

            const meals: Array<{
                mealType: MealType;
                order: number;
                foodName: string;
                amount: string;
            }> = [];

            for (const mealType of MEAL_TYPES) {
                const items = templateDay[mealType];
                items.forEach((item, orderIndex) => {
                    meals.push({
                        mealType,
                        order: orderIndex + 1,
                        foodName: item.foodName,
                        amount: item.amount,
                    });
                });
            }

            return {
                dayIndex: index + 1,
                date,
                weekNumber: Math.floor(index / 7) + 1,
                meals,
            };
        });
    }
}
