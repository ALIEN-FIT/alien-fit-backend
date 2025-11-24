import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DietPlanService } from './diet-plan.service.js';
import { DietPlanEntity } from './entity/diet-plan.entity.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { TrackingRepository } from '../../../tracking/v1/tracking.repository.js';
import { DailyTrackingEntity } from '../../../tracking/v1/entity/daily-tracking.entity.js';

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
            isDone: boolean;
            meals: Record<MealType, Array<{
                id: string;
                order: number;
                foodName: string;
                amount: string;
                isDone: boolean;
            }>>;
        }>;
    }>;
}

function emptyMealsRecord(): Record<MealType, Array<{ id: string; order: number; foodName: string; amount: string; isDone: boolean }>> {
    return {
        breakfast: [],
        lunch: [],
        snacks: [],
        dinner: [],
    };
}

async function serializeDietPlan(plan: DietPlanEntity): Promise<SerializedDietPlan> {
    const json = plan.toJSON() as any;
    const weeksMap = new Map<number, SerializedDietPlan['weeks'][number]>();
    const trackingMap = await buildTrackingMap(json.userId, json.days ?? []);

    for (const day of json.days ?? []) {
        if (!weeksMap.has(day.weekNumber)) {
            weeksMap.set(day.weekNumber, { weekNumber: day.weekNumber, days: [] });
        }
        const meals = emptyMealsRecord();
        const dayDateKey = toDateOnlyString(day.date);
        const isDone = trackingMap.get(dayDateKey)?.dietDone ?? false;
        const completedIds = new Set<string>(trackingMap.get(dayDateKey)?.dietCompletedItemIds ?? []);
        for (const meal of day.meals ?? []) {
            meals[meal.mealType as MealType].push({
                id: meal.id,
                order: meal.order,
                foodName: meal.foodName,
                amount: meal.amount,
                isDone: completedIds.has(meal.id),
            });
        }
        for (const mealType of MEAL_TYPES) {
            meals[mealType].sort((a, b) => a.order - b.order);
        }
        weeksMap.get(day.weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            date: day.date,
            isDone,
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
    const dietPlan = await serializeDietPlan(plan);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { dietPlan },
    });
}

export async function getDietPlanController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await DietPlanService.getDietPlan(req.user!, userId);
    const dietPlan = await serializeDietPlan(plan);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { dietPlan },
    });
}

export async function getMyDietPlanController(req: Request, res: Response): Promise<void> {
    const user = req.user as UserEntity;
    const plan = await DietPlanService.getDietPlan(user, user.id.toString());
    const dietPlan = await serializeDietPlan(plan);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { dietPlan },
    });
}

async function buildTrackingMap(
    userId: string,
    days: Array<{ date: Date | string }>,
): Promise<Map<string, DailyTrackingEntity>> {
    const dateStrings = Array.from(new Set(days.map((day) => toDateOnlyString(day.date))));
    const trackings = await TrackingRepository.findByUserAndDates(userId, dateStrings);
    const map = new Map<string, DailyTrackingEntity>();
    for (const tracking of trackings) {
        map.set(toDateOnlyString(tracking.date as Date | string), tracking);
    }
    return map;
}

function toDateOnlyString(date: Date | string): string {
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    const match = typeof date === 'string' ? date.match(/^\d{4}-\d{2}-\d{2}/) : null;
    if (match) {
        return match[0];
    }
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toISOString().split('T')[0];
}
