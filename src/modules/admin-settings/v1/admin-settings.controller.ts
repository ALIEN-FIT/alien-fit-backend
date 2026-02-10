import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { AdminSettingsService } from './admin-settings.service.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';

export async function setDefaultFreeDaysController(req: Request, res: Response): Promise<void> {
    const { days } = req.body;
    const actor = req.user as UserEntity;

    await AdminSettingsService.setDefaultFreeDays(actor, days);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'Default free days updated successfully',
    });
}

export async function setDefaultTrainingPlanController(req: Request, res: Response): Promise<void> {
    const actor = req.user as UserEntity;

    const planId = await AdminSettingsService.createAndSetDefaultTrainingPlan(actor, req.body);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'Default training plan created and set successfully',
        data: { planId },
    });
}

export async function setDefaultDietPlanController(req: Request, res: Response): Promise<void> {
    const actor = req.user as UserEntity;

    const planId = await AdminSettingsService.createAndSetDefaultDietPlan(actor, req.body);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'Default diet plan created and set successfully',
        data: { planId },
    });
}

export async function setUserFreeDaysController(req: Request, res: Response): Promise<void> {
    const { userId, freeDays } = req.body;
    const actor = req.user as UserEntity;

    await AdminSettingsService.setUserFreeDays(actor, userId, freeDays);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'User free days updated successfully',
    });
}

export async function getAllSettingsController(req: Request, res: Response): Promise<void> {
    const settings = await AdminSettingsService.getAllSettings();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { settings },
    });
}
