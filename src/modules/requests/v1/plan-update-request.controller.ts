import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PlanUpdateRequestService } from './plan-update-request.service.js';

export async function createPlanUpdateRequestController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const request = await PlanUpdateRequestService.createManualRequest(
        userId,
        req.body.payload ?? null,
        req.body.notes ?? undefined,
    );

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { request },
    });
}

export async function listPlanUpdateRequestsController(req: Request, res: Response): Promise<void> {
    const { status } = req.query;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const { requests, meta } = await PlanUpdateRequestService.listRequests(
        typeof status === 'string' ? status : undefined,
        Number.isNaN(page) ? 1 : page,
        Number.isNaN(limit) ? 20 : limit,
    );

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { requests, meta },
    });
}

export async function approvePlanUpdateRequestController(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.id.toString();
    const { requestId } = req.params;
    const request = await PlanUpdateRequestService.approveRequest(requestId, adminId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { request },
    });
}
