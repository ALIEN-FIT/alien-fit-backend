export interface PaymentGatewayChargePayload {
    userId: string;
    amountCents: number;
    currency: string;
    metadata?: Record<string, unknown>;
}

export interface PaymentGatewayChargeResult {
    transactionId: string;
    status: 'pending' | 'succeeded' | 'failed';
    expiresAt?: Date;
}

export interface PaymentGatewayAdapter {
    initializeCharge(payload: PaymentGatewayChargePayload): Promise<PaymentGatewayChargeResult>;
    confirmCharge(transactionId: string): Promise<void>;
    cancelCharge(transactionId: string): Promise<void>;
}

export class NullPaymentGatewayAdapter implements PaymentGatewayAdapter {
    // Placeholder adapter until payment integration is ready
    async initializeCharge(payload: PaymentGatewayChargePayload): Promise<PaymentGatewayChargeResult> {
        return {
            transactionId: `mock-${payload.userId}-${Date.now()}`,
            status: 'pending',
        };
    }

    async confirmCharge(): Promise<void> {
        return undefined;
    }

    async cancelCharge(): Promise<void> {
        return undefined;
    }
}
