import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TrackingService } from './tracking.service.js';

function serializeTracking(record) {
    const json = record.toJSON();
    return {
        userId: json.userId,
        date: json.date,
        trainingDone: json.trainingDone,
        dietDone: json.dietDone,
        waterIntakeMl: json.waterIntakeMl,
        waterIntakeRecords: json.waterIntakeRecords ?? [],
        trainingCompletedItemIds: json.trainingCompletedItemIds ?? [],
        dietCompletedItemIds: json.dietCompletedItemIds ?? [],
        extraTrainingEntries: json.extraTrainingEntries ?? [],
        extraFoodEntries: json.extraFoodEntries ?? [],
        updatedAt: json.updatedAt,
    };
}

export async function markTrainingDoneController(req: Request, res: Response): Promise<void> {
    const tracking = await TrackingService.markTrainingDone(req.user!, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { tracking: serializeTracking(tracking) },
    });
}

export async function markDietDoneController(req: Request, res: Response): Promise<void> {
    const tracking = await TrackingService.markDietDone(req.user!, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { tracking: serializeTracking(tracking) },
    });
}

export async function logExtraTrainingController(req: Request, res: Response): Promise<void> {
    const tracking = await TrackingService.logExtraTraining(req.user!, req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { tracking: serializeTracking(tracking) },
    });
}

export async function logExtraFoodController(req: Request, res: Response): Promise<void> {
    const tracking = await TrackingService.logExtraFood(req.user!, req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { tracking: serializeTracking(tracking) },
    });
}

export async function logWaterIntakeController(req: Request, res: Response): Promise<void> {
    const tracking = await TrackingService.logWaterIntake(req.user!, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { tracking: serializeTracking(tracking) },
    });
}

export async function getDailyStatusController(req: Request, res: Response): Promise<void> {
    const { date } = req.params;
    const tracking = await TrackingService.getDailyStatus(req.user!, date);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { tracking: serializeTracking(tracking) },
    });
}

export async function getLast30DaysWaterIntakeController(req: Request, res: Response): Promise<void> {
    const data = await TrackingService.getLast30DaysWaterIntake(req.user!);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { waterIntake: data },
    });
}
