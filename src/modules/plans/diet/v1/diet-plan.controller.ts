import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DietPlanService } from './diet-plan.service.js';
import { DietPlanEntity } from './entity/diet-plan.entity.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { TrackingRepository } from '../../../tracking/v1/tracking.repository.js';
import { DailyTrackingEntity } from '../../../tracking/v1/entity/daily-tracking.entity.js';

interface SerializedDietPlan {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    recommendedWaterIntakeMl: number | null;
    weeks: Array<{
        weekNumber: number;
        days: Array<{
            dayIndex: number;
            date: Date;
            isDone: boolean;
            meals: Array<{
                id: string;
                mealName: string | null;
                order: number;
                text: string;
                isDone: boolean;
            }>;
            snacks: Array<{
                id: string;
                mealName: string | null;
                order: number;
                text: string;
                isDone: boolean;
            }>;
        }>;
    }>;
}

function extractMealText(meal: any): string {
    const foods = meal?.foods;
    if (Array.isArray(foods)) {
        const textBlock = foods.find((x) => x && typeof x === 'object' && typeof (x as any).text === 'string');
        if (textBlock && typeof (textBlock as any).text === 'string') {
            return (textBlock as any).text;
        }
    }
    return '';
}

function extractEntryType(meal: any): 'MEAL' | 'SNACK' {
    const foods = meal?.foods;
    if (Array.isArray(foods)) {
        const typed = foods.find((x) => x && typeof x === 'object' && typeof (x as any).itemType === 'string');
        if (typed && (typed as any).itemType === 'SNACK') {
            return 'SNACK';
        }
    }
    return 'MEAL';
}

async function serializeDietPlan(plan: DietPlanEntity): Promise<SerializedDietPlan> {
    const json = plan.toJSON() as any;
    const weeksMap = new Map<number, SerializedDietPlan['weeks'][number]>();
    const trackingMap = await buildTrackingMap(json.userId, json.days ?? []);

    for (const day of json.days ?? []) {
        if (!weeksMap.has(day.weekNumber)) {
            weeksMap.set(day.weekNumber, { weekNumber: day.weekNumber, days: [] });
        }
        const dayDateKey = toDateOnlyString(day.date);
        const isDone = trackingMap.get(dayDateKey)?.dietDone ?? false;
        const completedIds = new Set<string>(trackingMap.get(dayDateKey)?.dietCompletedItemIds ?? []);
        const allEntries = (day.meals ?? [])
            .map((meal: any) => ({
                id: meal.id,
                mealName: meal.mealName ?? null,
                order: meal.order,
                text: extractMealText(meal),
                entryType: extractEntryType(meal),
                isDone: completedIds.has(meal.id),
            }))
            .sort((a: any, b: any) => a.order - b.order);

        const meals = allEntries
            .filter((entry: any) => entry.entryType === 'MEAL')
            .map(({ entryType, ...rest }: any) => rest);

        const snacks = allEntries
            .filter((entry: any) => entry.entryType === 'SNACK')
            .map(({ entryType, ...rest }: any) => rest);

        weeksMap.get(day.weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            date: day.date,
            isDone,
            meals,
            snacks,
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
        recommendedWaterIntakeMl: json.recommendedWaterIntakeMl ?? null,
        weeks,
    };
}

export async function createDietPlanWeekController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await DietPlanService.createWeeklyTemplateForUser(req.user!, userId, req.body);
    const dietPlan = serializeDietPlanTemplate(plan);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { dietPlan },
    });
}

export async function getDietPlanController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await DietPlanService.getDietPlan(req.user!, userId);
    const dietPlan = serializeDietPlanTemplate(plan);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { dietPlan },
    });
}

export async function getMyDietPlanController(req: Request, res: Response): Promise<void> {
    const user = req.user as UserEntity;
    const plan = await DietPlanService.getDietPlan(user, user.id.toString());
    const dietPlan = serializeDietPlanTemplate(plan);

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

function serializeDietPlanTemplate(plan: DietPlanEntity): {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    recommendedWaterIntakeMl: number | null;
    meals: Array<{ id: string; mealName: string | null; order: number; text: string }>;
    snacks: Array<{ id: string; mealName: string | null; order: number; text: string }>;
} {
    const json = plan.toJSON() as any;
    const firstDay = (json.days ?? [])[0] ?? { meals: [] };
    const entries = (firstDay.meals ?? [])
        .map((meal: any) => ({
            id: meal.id,
            mealName: meal.mealName ?? null,
            order: meal.order,
            text: extractMealText(meal),
            entryType: extractEntryType(meal),
        }))
        .sort((a: any, b: any) => a.order - b.order);

    const meals = entries
        .filter((entry: any) => entry.entryType === 'MEAL')
        .map(({ entryType, ...rest }: any) => rest);

    const snacks = entries
        .filter((entry: any) => entry.entryType === 'SNACK')
        .map(({ entryType, ...rest }: any) => rest);

    return {
        id: json.id,
        userId: json.userId,
        startDate: json.startDate,
        endDate: json.endDate,
        recommendedWaterIntakeMl: json.recommendedWaterIntakeMl ?? null,
        meals,
        snacks,
    };
}
