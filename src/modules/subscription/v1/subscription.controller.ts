import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SubscriptionService } from './subscription.service.js';

export async function activateSubscriptionController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const subscription = await SubscriptionService.activateSubscription(userId);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { subscription },
    });
}

export async function renewSubscriptionController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const subscription = await SubscriptionService.renewSubscription(userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { subscription },
    });
}

export async function getSubscriptionStatusController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const status = await SubscriptionService.getStatus(userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: status,
    });
}
