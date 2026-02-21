import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { SubscriptionPackageEntity, SubscriptionPackagePrices } from './entity/subscription-package.entity.js';
import { SubscriptionPackageRepository } from './subscription-package.repository.js';
import { SubscriptionCurrencyRepository } from './subscription-currency.repository.js';
import { SUBSCRIPTION_PLAN_TYPE_SET, SUBSCRIPTION_PLAN_TYPES, SubscriptionPlanType } from './subscription-plan-type.js';

async function getSupportedCurrencyCodes(): Promise<string[]> {
    const active = await SubscriptionCurrencyRepository.listActive();
    return active.map((c) => String(c.code).toUpperCase());
}

function normalizePlanTypes(planTypes: SubscriptionPlanType[]): SubscriptionPlanType[] {
    const normalized = Array.from(new Set((planTypes ?? []).map((type) => String(type).trim().toLowerCase()))) as SubscriptionPlanType[];
    if (normalized.length < 1 || normalized.length > 3) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            'Package must include at least one plan type and at most three plan types.'
        );
    }
    for (const planType of normalized) {
        if (!SUBSCRIPTION_PLAN_TYPE_SET.has(planType)) {
            throw new HttpResponseError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                `Invalid plan type: ${planType}`
            );
        }
    }
    return normalized;
}

function normalizeAndValidatePrices(
    prices: SubscriptionPackagePrices,
    selectedPlanTypes: SubscriptionPlanType[],
    supportedCodes: string[]
): SubscriptionPackagePrices {
    if (!supportedCodes.length) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            'No supported currencies configured. Please configure currencies first.'
        );
    }

    const normalizedPrices: SubscriptionPackagePrices = {};
    const allowedSelected = new Set(selectedPlanTypes);

    for (const [typeKey, typePricesRaw] of Object.entries(prices ?? {})) {
        const normalizedType = String(typeKey).trim().toLowerCase();
        if (!SUBSCRIPTION_PLAN_TYPE_SET.has(normalizedType)) {
            throw new HttpResponseError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                `Invalid plan type in prices: ${typeKey}`
            );
        }
        const type = normalizedType as SubscriptionPlanType;
        if (!allowedSelected.has(type)) {
            throw new HttpResponseError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                `Prices provided for unselected plan type: ${type}`
            );
        }

        const normalizedTypePrices: Record<string, number> = {};
        for (const [code, amount] of Object.entries(typePricesRaw ?? {})) {
            const normalizedCode = String(code).trim().toUpperCase();
            normalizedTypePrices[normalizedCode] = Number(amount);
        }

        const missing = supportedCodes.filter((code) => normalizedTypePrices[code] === undefined);
        if (missing.length) {
            throw new HttpResponseError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                `Missing prices for plan type ${type}: ${missing.join(', ')}`
            );
        }

        const unsupported = Object.keys(normalizedTypePrices).filter((code) => !supportedCodes.includes(code));
        if (unsupported.length) {
            throw new HttpResponseError(
                StatusCodes.UNPROCESSABLE_ENTITY,
                `Unsupported currencies for plan type ${type}: ${unsupported.join(', ')}`
            );
        }

        normalizedPrices[type] = normalizedTypePrices;
    }

    const missingPlanTypePrices = selectedPlanTypes.filter((type) => !normalizedPrices[type]);
    if (missingPlanTypePrices.length) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            `Missing price blocks for selected plan types: ${missingPlanTypePrices.join(', ')}`
        );
    }

    return normalizedPrices;
}

export interface CreateSubscriptionPackageInput {
    name: string;
    description?: string | null;
    planTypes: SubscriptionPlanType[];
    prices: SubscriptionPackagePrices;
    features: string[];
    cycles: number;
    isActive?: boolean;
}

export interface SubscriptionPackageView {
    id: string;
    name: string;
    description: string | null;
    planTypes: SubscriptionPlanType[];
    capabilities: {
        canAccessDiet: boolean;
        canAccessTraining: boolean;
    };
    prices: SubscriptionPackagePrices;
    features: string[];
    cycles: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

function getCapabilities(planTypes: SubscriptionPlanType[]) {
    const set = new Set(planTypes);
    return {
        canAccessDiet: set.has('diet') || set.has('both'),
        canAccessTraining: set.has('training') || set.has('both'),
    };
}

function toSubscriptionPackageView(pkg: SubscriptionPackageEntity): SubscriptionPackageView {
    const planTypes = normalizePlanTypes((pkg.planTypes ?? ['both']) as SubscriptionPlanType[]);
    return {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        planTypes,
        capabilities: getCapabilities(planTypes),
        prices: (pkg.prices ?? {}) as SubscriptionPackagePrices,
        features: pkg.features ?? [],
        cycles: pkg.cycles,
        isActive: pkg.isActive,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
    };
}

export function resolvePackageAmount(
    pkg: SubscriptionPackageEntity,
    planType: SubscriptionPlanType,
    currency: string
): number {
    const supportedPlanTypes = normalizePlanTypes((pkg.planTypes ?? ['both']) as SubscriptionPlanType[]);
    if (!supportedPlanTypes.includes(planType)) {
        throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, `Package does not support plan type ${planType}`);
    }

    const upperCurrency = String(currency).trim().toUpperCase();
    const pricesByType = (pkg.prices ?? {}) as SubscriptionPackagePrices;
    const amount = pricesByType[planType]?.[upperCurrency];
    if (amount === undefined) {
        throw new HttpResponseError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            `Package has no price for plan type ${planType} in currency ${upperCurrency}`
        );
    }

    return Number(amount);
}

export class SubscriptionPackageService {
    static async listActive(): Promise<SubscriptionPackageView[]> {
        const packages = await SubscriptionPackageRepository.listActive();
        return packages.map(toSubscriptionPackageView);
    }

    static async listAllForAdmin(): Promise<SubscriptionPackageView[]> {
        const packages = await SubscriptionPackageRepository.listAllForAdmin();
        return packages.map(toSubscriptionPackageView);
    }

    static async getById(packageId: string): Promise<SubscriptionPackageView | null> {
        const pkg = await SubscriptionPackageRepository.findById(packageId);
        return pkg ? toSubscriptionPackageView(pkg) : null;
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
        const planTypes = normalizePlanTypes(input.planTypes);
        const prices = normalizeAndValidatePrices(input.prices, planTypes, supportedCodes);

        const created = await SubscriptionPackageRepository.create({
            name: input.name,
            description: input.description ?? null,
            planTypes,
            prices,
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
        const nextPlanTypes = normalizePlanTypes((input.planTypes ?? existing.planTypes ?? ['both']) as SubscriptionPlanType[]);
        const nextPrices = normalizeAndValidatePrices(
            (input.prices ?? (existing.prices as SubscriptionPackagePrices)) as SubscriptionPackagePrices,
            nextPlanTypes,
            supportedCodes
        );

        await existing.update({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.planTypes !== undefined ? { planTypes: nextPlanTypes } : {}),
            ...(input.prices !== undefined ? { prices: nextPrices } : {}),
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
