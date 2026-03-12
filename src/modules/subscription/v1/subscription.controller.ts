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

export async function freezeSubscriptionController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { requestedDays, note } = req.body;
    const request = await SubscriptionService.createFreezeRequest(userId, requestedDays, note);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { request },
    });
}

export async function listPendingFreezeRequestsController(_req: Request, res: Response): Promise<void> {
    const requests = await SubscriptionService.listPendingFreezeRequests();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { requests },
    });
}

export async function approveFreezeRequestController(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.id.toString();
    const { requestId } = req.params;
    const { freezeDays, note } = req.body;

    const result = await SubscriptionService.approveFreezeRequest(requestId, adminId, freezeDays, note);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function declineFreezeRequestController(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.id.toString();
    const { requestId } = req.params;
    const { note } = req.body;

    const request = await SubscriptionService.declineFreezeRequest(requestId, adminId, note);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { request },
    });
}

export async function createDefrostRequestController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { note } = req.body ?? {};
    const request = await SubscriptionService.createDefrostRequest(userId, note);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { request },
    });
}

export async function listPendingDefrostRequestsController(_req: Request, res: Response): Promise<void> {
    const requests = await SubscriptionService.listPendingDefrostRequests();

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { requests },
    });
}

export async function approveDefrostRequestController(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.id.toString();
    const { requestId } = req.params;
    const { note } = req.body;

    const result = await SubscriptionService.approveDefrostRequest(requestId, adminId, note);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function declineDefrostRequestController(req: Request, res: Response): Promise<void> {
    const adminId = req.user!.id.toString();
    const { requestId } = req.params;
    const { note } = req.body;

    const request = await SubscriptionService.declineDefrostRequest(requestId, adminId, note);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { request },
    });
}

export async function adminDefrostSubscriptionController(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const subscription = await SubscriptionService.defrostSubscription(userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { subscription },
    });
}

export async function createSubscriptionCheckoutController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { packageId, planType, currency, redirectionUrls } = req.body;

    const payment = await SubscriptionPaymentService.checkout({
        userId,
        packageId,
        planType,
        currency,
        redirectionUrls,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: {
            payment: {
                id: payment.id,
                status: payment.status,
                planType: payment.planType,
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
