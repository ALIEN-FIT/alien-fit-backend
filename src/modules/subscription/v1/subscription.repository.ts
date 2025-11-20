import { SubscriptionEntity } from './entity/subscription.entity.js';

export class SubscriptionRepository {
    static findByUserId(userId: string) {
        return SubscriptionEntity.findOne({ where: { userId } });
    }

    static create(data: Partial<SubscriptionEntity>) {
        return SubscriptionEntity.create(data);
    }

    static async upsert(userId: string, data: Partial<SubscriptionEntity>) {
        const existing = await this.findByUserId(userId);
        if (!existing) {
            return this.create({ userId, ...data });
        }
        await existing.update(data);
        return existing;
    }
}
