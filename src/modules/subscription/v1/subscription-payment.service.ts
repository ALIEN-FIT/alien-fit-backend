import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { createFawaterakHttpClient, getFawaterakApiKeyForWebhookVerification } from '../../../config/fawaterak.client.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { SubscriptionService } from './subscription.service.js';
import { resolvePackageAmount, SubscriptionPackageService } from '../../subscription-packages/v1/subscription-package.service.js';
import { SubscriptionPaymentEntity } from './entity/subscription-payment.entity.js';
import { SubscriptionPaymentRepository } from './subscription-payment.repository.js';
import { SubscriptionPlanType } from '../../subscription-packages/v1/subscription-plan-type.js';

export interface SubscriptionCheckoutInput {
    userId: string;
    packageId: string;
    planType: SubscriptionPlanType;
    currency: string;
    redirectionUrls?: {
        successUrl?: string;
        failUrl?: string;
        pendingUrl?: string;
    };
}

type FawaterakCreateInvoiceResponse = {
    status: 'success' | 'failed';
    data?: {
        url: string;
        invoiceKey: string;
        invoiceId: number;
    };
    message?: string;
};

export type FawaterakWebhookPayload = {
    hashKey: string;
    invoice_key: string;
    invoice_id: number;
    payment_method: string;
    invoice_status?: string;
    pay_load?: any;
    referenceNumber?: any;
    amount?: any;
    paidCurrency?: any;
    errorMessage?: any;
};

function splitName(fullName: string): { first_name: string; last_name: string } {
    const cleaned = String(fullName ?? '').trim();
    if (!cleaned) {
        return { first_name: 'User', last_name: 'Unknown' };
    }
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return { first_name: parts[0], last_name: parts[0] };
    }
    return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function timingSafeEqualHex(a: string, b: string): boolean {
    const aBuf = Buffer.from(String(a), 'utf8');
    const bBuf = Buffer.from(String(b), 'utf8');
    if (aBuf.length !== bBuf.length) {
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export class SubscriptionPaymentService {
    static async checkout(input: SubscriptionCheckoutInput): Promise<SubscriptionPaymentEntity> {
        const user = await UserService.getUserById(input.userId);
        const pkg = await SubscriptionPackageService.requireActiveById(input.packageId);

        const currency = String(input.currency).trim().toUpperCase();
        const planType = String(input.planType).trim().toLowerCase() as SubscriptionPlanType;
        const amount = resolvePackageAmount(pkg, planType, currency);

        const payment = await SubscriptionPaymentRepository.create({
            userId: user.id,
            packageId: pkg.id,
            planType,
            provider: 'fawaterak',
            status: 'pending',
            currency,
            amount,
        });

        const { first_name, last_name } = splitName(user.name);

        const body: any = {
            cartTotal: String(amount),
            currency,
            customer: {
                first_name,
                last_name,
                // Fawaterak allows optional email/phone; we don't store them in user entity currently.
            },
            cartItems: [
                {
                    name: pkg.name,
                    price: String(amount),
                    quantity: '1',
                },
            ],
            payLoad: {
                paymentId: payment.id,
                userId: user.id,
                packageId: pkg.id,
                planType,
            },
        };

        if (input.redirectionUrls) {
            body.redirectionUrls = {
                ...(input.redirectionUrls.successUrl ? { successUrl: input.redirectionUrls.successUrl } : {}),
                ...(input.redirectionUrls.failUrl ? { failUrl: input.redirectionUrls.failUrl } : {}),
                ...(input.redirectionUrls.pendingUrl ? { pendingUrl: input.redirectionUrls.pendingUrl } : {}),
            };
        }

        const client = createFawaterakHttpClient();
        let response: FawaterakCreateInvoiceResponse;
        try {
            console.log('Creating Fawaterak invoice with body:', body);
            const { data } = await client.post<FawaterakCreateInvoiceResponse>('/api/v2/createInvoiceLink', body);
            response = data;
        } catch (error: any) {
            console.error('Error creating Fawaterak invoice:', error?.response?.data ?? error?.message ?? error);
            await SubscriptionPaymentRepository.markStatus(payment.id, 'failed', {
                webhookPayload: {
                    kind: 'create-invoice-error',
                    error: error?.response?.data ?? error?.message ?? String(error),
                },
            });
            console.log('Marked payment as failed due to invoice creation error:', payment.id);
            throw new HttpResponseError(StatusCodes.BAD_GATEWAY, 'Failed to create payment invoice');
        }

        console.log('Fawaterak create invoice response:', response);
        if (response.status !== 'success' || !response.data?.invoiceId || !response.data?.invoiceKey || !response.data?.url) {
            await SubscriptionPaymentRepository.markStatus(payment.id, 'failed', { webhookPayload: response as any });
            throw new HttpResponseError(StatusCodes.BAD_GATEWAY, response.message ?? 'Failed to create payment invoice');
        }

        await payment.update({
            invoiceId: response.data.invoiceId,
            invoiceKey: response.data.invoiceKey,
            paymentUrl: response.data.url,
        });

        return payment;
    }

    static verifyPaidWebhookHash(payload: FawaterakWebhookPayload): boolean {
        const secretKey = getFawaterakApiKeyForWebhookVerification();
        const queryParam = `InvoiceId=${payload.invoice_id}&InvoiceKey=${payload.invoice_key}&PaymentMethod=${payload.payment_method}`;
        const expected = crypto.createHmac('sha256', secretKey).update(queryParam).digest('hex');
        return timingSafeEqualHex(expected, String(payload.hashKey));
    }

    static async handleWebhook(payload: FawaterakWebhookPayload): Promise<{ payment: SubscriptionPaymentEntity; subscriptionActivated: boolean }> {
        const existing = await SubscriptionPaymentRepository.findByInvoiceId(Number(payload.invoice_id));
        if (!existing) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Payment not found');
        }

        // Idempotent: if already paid, just acknowledge.
        if (existing.status === 'paid') {
            return { payment: existing, subscriptionActivated: true };
        }

        const invoiceStatus = String(payload.invoice_status ?? '').toLowerCase();

        if (invoiceStatus === 'paid') {
            await existing.update({
                status: 'paid',
                paidAt: new Date(),
                webhookPayload: payload as any,
            });

            const pkg = await SubscriptionPackageService.requireActiveById(existing.packageId);
            const status = await SubscriptionService.getStatus(existing.userId);
            if (status.isSubscribed) {
                await SubscriptionService.renewSubscription(existing.userId, pkg.cycles, existing.planType);
            } else {
                await SubscriptionService.activateSubscription(existing.userId, pkg.cycles, existing.planType);
            }

            return { payment: existing, subscriptionActivated: true };
        }

        if (invoiceStatus === 'expired') {
            await existing.update({ status: 'expired', webhookPayload: payload as any });
            return { payment: existing, subscriptionActivated: false };
        }

        // failed or unknown
        await existing.update({ status: 'failed', webhookPayload: payload as any });
        return { payment: existing, subscriptionActivated: false };
    }
}
