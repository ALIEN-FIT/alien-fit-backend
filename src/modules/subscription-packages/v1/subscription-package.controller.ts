import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SubscriptionPackageService } from './subscription-package.service.js';
import { SubscriptionCurrencyService } from './subscription-currency.service.js';

export async function listActiveSubscriptionPackagesController(req: Request, res: Response): Promise<void> {
    const packages = await SubscriptionPackageService.listActive();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { packages },
    });
}

export async function getSubscriptionPackageController(req: Request, res: Response): Promise<void> {
    const { packageId } = req.params;
    const pkg = await SubscriptionPackageService.getById(packageId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { package: pkg },
    });
}

export async function adminListSubscriptionPackagesController(req: Request, res: Response): Promise<void> {
    const packages = await SubscriptionPackageService.listAllForAdmin();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { packages },
    });
}

export async function adminCreateSubscriptionPackageController(req: Request, res: Response): Promise<void> {
    const created = await SubscriptionPackageService.create(req.body);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { package: created },
    });
}

export async function adminUpdateSubscriptionPackageController(req: Request, res: Response): Promise<void> {
    const { packageId } = req.params;
    const updated = await SubscriptionPackageService.update(packageId, req.body);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { package: updated },
    });
}

export async function adminDeleteSubscriptionPackageController(req: Request, res: Response): Promise<void> {
    const { packageId } = req.params;
    await SubscriptionPackageService.remove(packageId);

    res.status(StatusCodes.NO_CONTENT).send();
}

export async function adminListSupportedCurrenciesController(req: Request, res: Response): Promise<void> {
    const currencies = await SubscriptionCurrencyService.listAll();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { currencies },
    });
}

export async function adminUpsertSupportedCurrencyController(req: Request, res: Response): Promise<void> {
    const { code, isActive } = req.body;
    const currency = await SubscriptionCurrencyService.upsertCurrency(code, isActive);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { currency },
    });
}

export async function adminUpdateSupportedCurrencyController(req: Request, res: Response): Promise<void> {
    const { code } = req.params;
    const { isActive } = req.body;
    const currency = await SubscriptionCurrencyService.upsertCurrency(code, isActive);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { currency },
    });
}
