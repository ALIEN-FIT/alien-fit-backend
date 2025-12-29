import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { SubscriptionCurrencyEntity } from './entity/subscription-currency.entity.js';
import { SubscriptionCurrencyRepository } from './subscription-currency.repository.js';

export class SubscriptionCurrencyService {
    static listActive(): Promise<SubscriptionCurrencyEntity[]> {
        return SubscriptionCurrencyRepository.listActive();
    }

    static listAll(): Promise<SubscriptionCurrencyEntity[]> {
        return SubscriptionCurrencyRepository.listAll();
    }

    static async upsertCurrency(code: string, isActive: boolean): Promise<SubscriptionCurrencyEntity> {
        const normalized = String(code).trim().toUpperCase();
        if (!/^[A-Z]{3,10}$/.test(normalized)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Invalid currency code');
        }
        return SubscriptionCurrencyRepository.upsert(normalized, isActive);
    }
}
