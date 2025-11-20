import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TrainingPlanService } from './training-plan.service.js';
import { TrainingPlanEntity } from './entity/training-plan.entity.js';

interface SerializedTrainingPlan {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    weeks: Array<{
        weekNumber: number;
        days: Array<{
            dayIndex: number;
            date: Date;
            items: Array<{
                id: string;
                order: number;
                title: string;
                videoLink: string | null;
                description: string | null;
                duration: number | null;
                repeats: number | null;
                isSuperset: boolean;
                supersetExercises: Array<Record<string, unknown>> | null;
            }>;
        }>;
    }>;
}

function serializeTrainingPlan(plan: TrainingPlanEntity): SerializedTrainingPlan {
    const json = plan.toJSON() as any;
    const weeksMap = new Map<number, SerializedTrainingPlan['weeks'][number]>();

    for (const day of json.days ?? []) {
        if (!weeksMap.has(day.weekNumber)) {
            weeksMap.set(day.weekNumber, { weekNumber: day.weekNumber, days: [] });
        }
        weeksMap.get(day.weekNumber)!.days.push({
            dayIndex: day.dayIndex,
            date: day.date,
            items: (day.items ?? []).map((item) => ({
                id: item.id,
                order: item.order,
                title: item.title,
                videoLink: item.videoLink,
                description: item.description,
                duration: item.duration,
                repeats: item.repeats,
                isSuperset: item.isSuperset,
                supersetExercises: item.supersetExercises,
            })),
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

export async function createTrainingPlanWeekController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await TrainingPlanService.createWeeklyTemplateForUser(req.user!, userId, req.body);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { trainingPlan: serializeTrainingPlan(plan) },
    });
}

export async function getTrainingPlanController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const plan = await TrainingPlanService.getTrainingPlan(req.user!, userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { trainingPlan: serializeTrainingPlan(plan) },
    });
}
