import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { FeedbackService } from './feedback.service.js';
import { FeedbackStatus, FeedbackType } from './feedback.entity.js';

export async function createFeedbackController(req: Request, res: Response) {
    const feedback = await FeedbackService.createFeedback(
        {
            type: req.body.type as FeedbackType,
            body: req.body.body,
            guestName: req.body.guestName,
            guestPhone: req.body.guestPhone,
        },
        req.user ?? null,
    );

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { feedback },
    });
}

export async function listMyFeedbackController(req: Request, res: Response) {
    const status = typeof req.query.status === 'string' ? (req.query.status as FeedbackStatus) : undefined;
    const type = typeof req.query.type === 'string' ? (req.query.type as FeedbackType) : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await FeedbackService.listUserFeedback(req.user!.id.toString(), {
        status,
        type,
        page,
        limit,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { feedback: result.items, meta: result.meta },
    });
}

export async function adminSearchFeedbackController(req: Request, res: Response) {
    const status = typeof req.query.status === 'string' ? (req.query.status as FeedbackStatus) : undefined;
    const type = typeof req.query.type === 'string' ? (req.query.type as FeedbackType) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    const fromDate = typeof req.query.fromDate === 'string' ? new Date(req.query.fromDate) : undefined;
    const toDate = typeof req.query.toDate === 'string' ? new Date(req.query.toDate) : undefined;

    const result = await FeedbackService.searchAsAdmin({
        status,
        type,
        search,
        page,
        limit,
        userId,
        fromDate,
        toDate,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { feedback: result.items, meta: result.meta },
    });
}

export async function respondToFeedbackController(req: Request, res: Response) {
    const feedbackId = req.params.feedbackId;
    const status = req.body.status as FeedbackStatus | undefined;
    const reply = typeof req.body.reply === 'string' ? req.body.reply : undefined;

    const feedback = await FeedbackService.respondToFeedback(feedbackId, req.user!.id.toString(), {
        status,
        reply,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { feedback },
    });
}
