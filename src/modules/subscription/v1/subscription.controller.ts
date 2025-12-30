import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SubscriptionService } from './subscription.service.js';
import { SubscriptionPackageService } from '../../subscription-packages/v1/subscription-package.service.js';
import { SubscriptionPaymentService } from './subscription-payment.service.js';

export async function activateSubscriptionController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    const { cycles, packageId } = req.body ?? {};
    const effectiveCycles = packageId
        ? (await SubscriptionPackageService.requireActiveById(packageId)).cycles
        : (cycles ?? 1);

    const subscription = await SubscriptionService.activateSubscription(userId, effectiveCycles);

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { subscription },
    });
}

export async function renewSubscriptionController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    const { cycles, packageId } = req.body ?? {};
    const effectiveCycles = packageId
        ? (await SubscriptionPackageService.requireActiveById(packageId)).cycles
        : (cycles ?? 1);

    const subscription = await SubscriptionService.renewSubscription(userId, effectiveCycles);

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

export async function createSubscriptionCheckoutController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { packageId, currency, redirectionUrls } = req.body;

    const payment = await SubscriptionPaymentService.checkout({
        userId,
        packageId,
        currency,
        redirectionUrls,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: {
            payment: {
                id: payment.id,
                status: payment.status,
                currency: payment.currency,
                amount: payment.amount,
                invoiceId: payment.invoiceId,
                invoiceKey: payment.invoiceKey,
                paymentUrl: payment.paymentUrl,
            },
        },
    });
}

export async function fawaterakWebhookController(req: Request, res: Response): Promise<void> {
    const payload = req.body;

    console.log('Fawaterak Webhook received:', payload);

    if (!SubscriptionPaymentService.verifyPaidWebhookHash(payload)) {
        res.status(StatusCodes.UNAUTHORIZED).json({ status: 'fail', message: 'Invalid hashKey' });
        return;
    }

    const result = await SubscriptionPaymentService.handleWebhook(payload);

    // Fawaterak expects a 200 response; content is not strict per docs.
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            paymentId: result.payment.id,
            paymentStatus: result.payment.status,
            subscriptionActivated: result.subscriptionActivated,
        },
    });
}
