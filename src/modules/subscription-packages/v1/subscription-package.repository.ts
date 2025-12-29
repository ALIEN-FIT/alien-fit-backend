import { SubscriptionPackageEntity } from './entity/subscription-package.entity.js';

export class SubscriptionPackageRepository {
    static create(data: Partial<SubscriptionPackageEntity>) {
        return SubscriptionPackageEntity.create(data);
    }

    static findById(id: string) {
        return SubscriptionPackageEntity.findByPk(id);
    }

    static listActive() {
        return SubscriptionPackageEntity.findAll({
            where: { isActive: true },
            order: [['createdAt', 'DESC']],
        });
    }

    static listAllForAdmin() {
        return SubscriptionPackageEntity.findAll({
            order: [['createdAt', 'DESC']],
        });
    }

    static async updateById(id: string, data: Partial<SubscriptionPackageEntity>) {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }
        await existing.update(data);
        return existing;
    }

    static async deleteById(id: string): Promise<boolean> {
        const existing = await this.findById(id);
        if (!existing) {
            return false;
        }
        await existing.destroy();
        return true;
    }
}
