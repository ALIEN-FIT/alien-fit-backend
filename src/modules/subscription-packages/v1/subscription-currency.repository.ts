import { SubscriptionCurrencyEntity } from './entity/subscription-currency.entity.js';

export class SubscriptionCurrencyRepository {
    static listActive() {
        return SubscriptionCurrencyEntity.findAll({
            where: { isActive: true },
            order: [['code', 'ASC']],
        });
    }

    static listAll() {
        return SubscriptionCurrencyEntity.findAll({
            order: [['code', 'ASC']],
        });
    }

    static findByCode(code: string) {
        return SubscriptionCurrencyEntity.findByPk(code);
    }

    static async upsert(code: string, isActive: boolean) {
        const existing = await this.findByCode(code);
        if (!existing) {
            return SubscriptionCurrencyEntity.create({ code, isActive });
        }
        await existing.update({ isActive });
        return existing;
    }
}
