import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DietPlanService } from './diet-plan.service.js';
import { DietPlanEntity } from './entity/diet-plan.entity.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;

type MealType = typeof MEAL_TYPES[number];

interface SerializedDietPlan {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    weeks: Array<{
        weekNumber: number;
        days: Array<{
            dayIndex: number;
            date: Date;
            meals: Record<MealType, Array<{
                id: string;
                order: number;
                foodName: string;
                amount: string;
            }>>;
        }>;
    }>;
}

function emptyMealsRecord(): Record<MealType, Array<{ id: string; order: number; foodName: string; amount: string }>> {
    return {
        breakfast: [],
        lunch: [],
        snacks: [],
        dinner: [],
    };
}

function serializeDietPlan(plan: DietPlanEntity): SerializedDietPlan {
    const json = plan.toJSON() as any;
    const weeksMap = new Map<number, SerializedDietPlan['weeks'][number]>();

    for (const day of json.days ?? []) {
        if (!weeksMap.has(day.weekNumber)) {
            weeksMap.set(day.weekNumber, { weekNumber: day.weekNumber, days: [] });
        }
        const meals = emptyMealsRecord();
        for (const meal of day.meals ?? []) {
            meals[meal.mealType as MealType].push({
                id: meal.id,
                order: meal.order,
                foodName: meal.foodName,
                amount: meal.amount,
            });
        }
        for (const mealType of MEAL_TYPES) {
            meals[mealType].sort((a, b) => a.order - b.order);
        }
        weeksMap.get(day.weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            date: day.date,
            meals,
        });
    }

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
        weeks,
    };
}

export async function createDietPlanWeekController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await DietPlanService.createWeeklyTemplateForUser(req.user!, userId, req.body);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { dietPlan: serializeDietPlan(plan) },
    });
}

export async function getDietPlanController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await DietPlanService.getDietPlan(req.user!, userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { dietPlan: serializeDietPlan(plan) },
    });
}
