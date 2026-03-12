import { SubscriptionDefrostRequestEntity } from './entity/subscription-defrost-request.entity.js';

export class SubscriptionDefrostRequestRepository {
    static create(data: Partial<SubscriptionDefrostRequestEntity>) {
        return SubscriptionDefrostRequestEntity.create(data);
    }

    static findById(id: string) {
        return SubscriptionDefrostRequestEntity.findByPk(id);
    }

    static findPendingByUserId(userId: string) {
        return SubscriptionDefrostRequestEntity.findOne({
            where: {
                userId,
                status: 'pending',
            },
            order: [['createdAt', 'DESC']],
        });
    }

    static listPending() {
        return SubscriptionDefrostRequestEntity.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'ASC']],
        });
    }
}
