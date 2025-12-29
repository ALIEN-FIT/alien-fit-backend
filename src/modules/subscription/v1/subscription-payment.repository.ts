import { SubscriptionPaymentEntity, SubscriptionPaymentStatus } from './entity/subscription-payment.entity.js';

export class SubscriptionPaymentRepository {
    static create(data: Partial<SubscriptionPaymentEntity>) {
        return SubscriptionPaymentEntity.create(data);
    }

    static findById(id: string) {
        return SubscriptionPaymentEntity.findByPk(id);
    }

    static findByInvoiceId(invoiceId: number) {
        return SubscriptionPaymentEntity.findOne({ where: { invoiceId } });
    }

    static findByInvoiceKey(invoiceKey: string) {
        return SubscriptionPaymentEntity.findOne({ where: { invoiceKey } });
    }

    static async markStatus(id: string, status: SubscriptionPaymentStatus, patch: Partial<SubscriptionPaymentEntity> = {}) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }
        await existing.update({ status, ...patch });
        return existing;
    }
}
