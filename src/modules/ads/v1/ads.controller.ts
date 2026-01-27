import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AdsService } from './ads.service.js';

function serializeAd(ad: any) {
    const json = ad.toJSON();
    return {
        id: json.id,
        imageId: json.imageId,
        image: json.image ?? null,
        appName: json.appName,
        link: json.link,
        promoCode: json.promoCode,
        discountAmount: json.discountAmount,
        discountType: json.discountType,
        startDate: json.startDate,
        endDate: json.endDate,
        priority: json.priority,
        isActive: json.isActive,
        stats: {
            viewCount: json.viewCount,
            uniqueViewersCount: json.uniqueViewersCount,
            clickCount: json.clickCount,
            promoCopyCount: json.promoCopyCount,
        },
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
    };
}

export async function listActiveAdsController(req: Request, res: Response): Promise<void> {
    const ads = await AdsService.listActiveForUser(req.user?.id);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { ads: ads.map(serializeAd) },
    });
}

export async function trackAdClickController(req: Request, res: Response): Promise<void> {
    const { adId } = req.params as any;
    await AdsService.trackClick(adId);
    res.status(StatusCodes.OK).json({ status: 'success' });
}

export async function trackAdPromoCopyController(req: Request, res: Response): Promise<void> {
    const { adId } = req.params as any;
    await AdsService.trackPromoCopy(adId);
    res.status(StatusCodes.OK).json({ status: 'success' });
}

export async function adminListAllAdsController(req: Request, res: Response): Promise<void> {
    const ads = await AdsService.adminListAll();
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { ads: ads.map(serializeAd) },
    });
}

export async function adminGetAdController(req: Request, res: Response): Promise<void> {
    const { adId } = req.params as any;
    const ad = await AdsService.adminGetById(adId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { ad: serializeAd(ad) },
    });
}

export async function adminCreateAdController(req: Request, res: Response): Promise<void> {
    const ad = await AdsService.adminCreate(req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { ad: serializeAd(ad) },
    });
}

export async function adminUpdateAdController(req: Request, res: Response): Promise<void> {
    const { adId } = req.params as any;
    const ad = await AdsService.adminUpdate({ ...req.body, adId });
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { ad: serializeAd(ad) },
    });
}

export async function adminDeleteAdController(req: Request, res: Response): Promise<void> {
    const { adId } = req.params as any;
    await AdsService.adminDelete(adId);
    res.status(StatusCodes.NO_CONTENT).send();
}

export async function adminGetAdStatsController(req: Request, res: Response): Promise<void> {
    const { adId } = req.params as any;
    const stats = await AdsService.adminGetStats(adId);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { stats },
    });
}
