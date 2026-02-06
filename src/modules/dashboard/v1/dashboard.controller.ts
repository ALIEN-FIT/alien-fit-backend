import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DashboardService } from './dashboard.service.js';

export async function getAdminDashboardStatsController(req: Request, res: Response): Promise<void> {
    const stats = await DashboardService.getAdminStats();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: stats,
    });
}
