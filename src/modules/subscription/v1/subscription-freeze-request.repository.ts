import { SubscriptionFreezeRequestEntity } from './entity/subscription-freeze-request.entity.js';

export class SubscriptionFreezeRequestRepository {
    static create(data: Partial<SubscriptionFreezeRequestEntity>) {
        return SubscriptionFreezeRequestEntity.create(data);
    }

    static findById(id: string) {
        return SubscriptionFreezeRequestEntity.findByPk(id);
    }

    static findPendingByUserId(userId: string) {
        return SubscriptionFreezeRequestEntity.findOne({
            where: {
                userId,
                status: 'pending',
            },
            order: [['createdAt', 'DESC']],
        });
    }

    static listPending() {
        return SubscriptionFreezeRequestEntity.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'ASC']],
        });
    }
}
