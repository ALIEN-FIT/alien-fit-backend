import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { SubscriptionPackageEntity, SubscriptionPackageTypedPrices, SubscriptionType } from './entity/subscription-package.entity.js';
import { SubscriptionPackageRepository } from './subscription-package.repository.js';
import { SubscriptionCurrencyRepository } from './subscription-currency.repository.js';

async function getSupportedCurrencyCodes(): Promise<string[]> {
    const active = await SubscriptionCurrencyRepository.listActive();
    return active.map((c) => String(c.code).toUpperCase());
}

function validatePrices(prices: Record<string, number>, supportedCodes: string[]) {
    if (!supportedCodes.length) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            'No supported currencies configured. Please configure currencies first.'
        );
    }

    const normalizedPrices: Record<string, number> = {};
    for (const [code, amount] of Object.entries(prices ?? {})) {
        const normalizedCode = String(code).trim().toUpperCase();
        normalizedPrices[normalizedCode] = amount;
    }

    const missing = supportedCodes.filter((code) => normalizedPrices[code] === undefined);
    if (missing.length) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            `Missing prices for currencies: ${missing.join(', ')}`
        );
    }

    const unsupported = Object.keys(normalizedPrices).filter((code) => !supportedCodes.includes(code));
    if (unsupported.length) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            `Unsupported currencies provided: ${unsupported.join(', ')}`
        );
    }
}

function validateTypedPrices(prices: SubscriptionPackageTypedPrices, supportedCodes: string[]) {
    const requiredTypes: SubscriptionType[] = ['diet', 'training', 'both'];
    for (const type of requiredTypes) {
        const perTypePrices = (prices as any)?.[type] as Record<string, number> | undefined;
        if (!perTypePrices || typeof perTypePrices !== 'object') {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, `Missing prices for subscription type: ${type}`);
        }
        validatePrices(perTypePrices, supportedCodes);
    }
}

export interface CreateSubscriptionPackageInput {
    name: string;
    description?: string | null;
    prices: SubscriptionPackageTypedPrices;
    features: string[];
    cycles: number;
    isActive?: boolean;
}

export class SubscriptionPackageService {
    static listActive(): Promise<SubscriptionPackageEntity[]> {
        return SubscriptionPackageRepository.listActive();
    }

    static listAllForAdmin(): Promise<SubscriptionPackageEntity[]> {
        return SubscriptionPackageRepository.listAllForAdmin();
    }

    static async getById(packageId: string): Promise<SubscriptionPackageEntity | null> {
        return SubscriptionPackageRepository.findById(packageId);
    }

    static async requireActiveById(packageId: string): Promise<SubscriptionPackageEntity> {
        const existing = await SubscriptionPackageRepository.findById(packageId);
        if (!existing) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Subscription package not found');
        }
        if (!existing.isActive) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription package is not active');
        }
        return existing;
    }

    static async create(input: CreateSubscriptionPackageInput): Promise<SubscriptionPackageEntity> {
        const supportedCodes = await getSupportedCurrencyCodes();
        validateTypedPrices(input.prices, supportedCodes);

        const created = await SubscriptionPackageRepository.create({
            name: input.name,
            description: input.description ?? null,
            prices: input.prices,
            features: input.features,
            cycles: input.cycles,
            isActive: input.isActive ?? true,
        });
        return created;
    }

    static async update(packageId: string, input: Partial<CreateSubscriptionPackageInput>): Promise<SubscriptionPackageEntity> {
        const existing = await SubscriptionPackageRepository.findById(packageId);
        if (!existing) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Subscription package not found');
        }

        const supportedCodes = await getSupportedCurrencyCodes();
        const nextPrices = (input.prices ?? (existing.prices as SubscriptionPackageTypedPrices)) as SubscriptionPackageTypedPrices;
        validateTypedPrices(nextPrices, supportedCodes);

        await existing.update({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.prices !== undefined ? { prices: input.prices } : {}),
            ...(input.features !== undefined ? { features: input.features } : {}),
            ...(input.cycles !== undefined ? { cycles: input.cycles } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        });

        return existing;
    }

    static async remove(packageId: string): Promise<void> {
        const deleted = await SubscriptionPackageRepository.deleteById(packageId);
        if (!deleted) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Subscription package not found');
        }
    }
}
