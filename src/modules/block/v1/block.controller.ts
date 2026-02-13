import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { BlockService } from './block.service.js';

export async function toggleBlockController(req: Request, res: Response) {
    const { userId } = req.params;
    const result = await BlockService.toggleBlock(req.user!, userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function listBlockedController(req: Request, res: Response) {
    const { page, limit } = req.query;
    const data = await BlockService.listBlocked(req.user!, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}
