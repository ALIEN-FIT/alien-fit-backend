import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { NotificationService } from './notification.service.js';
import { NotificationType } from '../../../constants/notification-type.js';

export async function listMyNotificationsController(req: Request, res: Response) {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const isRead = typeof req.query.isRead === 'string' ? req.query.isRead === 'true' : undefined;
    const isSeen = typeof req.query.isSeen === 'string' ? req.query.isSeen === 'true' : undefined;

    const result = await NotificationService.listMyNotifications(req.user!.id.toString(), {
        page,
        limit,
        isRead,
        isSeen,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { notifications: result.items, meta: result.meta },
    });
}

export async function markNotificationSeenController(req: Request, res: Response) {
    await NotificationService.markSeen(req.user!.id.toString(), req.params.notificationId);
    res.status(StatusCodes.NO_CONTENT).send();
}

export async function markNotificationReadController(req: Request, res: Response) {
    await NotificationService.markRead(req.user!.id.toString(), req.params.notificationId);
    res.status(StatusCodes.NO_CONTENT).send();
}

export async function markAllSeenController(req: Request, res: Response) {
    await NotificationService.markAllSeen(req.user!.id.toString());
    res.status(StatusCodes.NO_CONTENT).send();
}

export async function markAllReadController(req: Request, res: Response) {
    await NotificationService.markAllRead(req.user!.id.toString());
    res.status(StatusCodes.NO_CONTENT).send();
}

export async function adminBroadcastNotificationController(req: Request, res: Response) {
    await NotificationService.broadcastAsAdmin({
        adminId: req.user!.id.toString(),
        type: req.body.type as NotificationType,
        title: req.body.title,
        body: req.body.body,
        filters: req.body.filters,
    });

    res.status(StatusCodes.ACCEPTED).json({
        status: 'success',
        message: 'Broadcast notification queued',
    });
}
