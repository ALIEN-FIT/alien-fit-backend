import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { SubscriptionRepository } from './subscription.repository.js';
import { SubscriptionEntity } from './entity/subscription.entity.js';
import { addDays } from '../../../utils/date.utils.js';

const SUBSCRIPTION_CYCLE_DAYS = 30;

export type SubscriptionType = 'diet' | 'training' | 'both';

interface SubscriptionTypeDetails {
    isActive: boolean;
    startDate: Date | null;
    endDate: Date | null;
}

interface SubscriptionStatus {
    isSubscribed: boolean;
    profileUpdateRequired: boolean;
    subscriptionType: SubscriptionType | 'none';
    details: {
        diet: SubscriptionTypeDetails;
        training: SubscriptionTypeDetails;
    };
    subscription: SubscriptionEntity | null;
}

function calculateNextProfileDue(lastUpdate: Date | null): Date | null {
    if (!lastUpdate) {
        return null;
    }
    return addDays(lastUpdate, 30);
}

function computeIsActive(subscription: SubscriptionEntity | null, referenceDate = new Date()): boolean {
    if (!subscription || !subscription.endDate) {
        return false;
    }
    return subscription.endDate.getTime() >= referenceDate.getTime();
}

function computeEndDateIsActive(endDate: Date | null, referenceDate = new Date()): boolean {
    if (!endDate) {
        return false;
    }
    return endDate.getTime() >= referenceDate.getTime();
}

function normalizeSubscriptionType(input: unknown): SubscriptionType {
    const value = String(input ?? 'both').trim().toLowerCase();
    if (value === 'diet' || value === 'training' || value === 'both') {
        return value;
    }
    return 'both';
}

function aggregateOverallDates(subscription: SubscriptionEntity | null): { startDate: Date | null; endDate: Date | null } {
    if (!subscription) {
        return { startDate: null, endDate: null };
    }

    const starts = [subscription.dietStartDate, subscription.trainingStartDate, subscription.startDate].filter(Boolean) as Date[];
    const ends = [subscription.dietEndDate, subscription.trainingEndDate, subscription.endDate].filter(Boolean) as Date[];

    const startDate = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
    const endDate = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
    return { startDate, endDate };
}

async function migrateLegacyToTypedIfNeeded(subscription: SubscriptionEntity | null): Promise<SubscriptionEntity | null> {
    if (!subscription) {
        return null;
    }

    // If legacy start/end exist but typed fields are empty, treat legacy as BOTH.
    const hasLegacy = Boolean(subscription.startDate && subscription.endDate);
    const hasTyped = Boolean(subscription.dietStartDate || subscription.dietEndDate || subscription.trainingStartDate || subscription.trainingEndDate);

    if (hasLegacy && !hasTyped) {
        await subscription.update({
            dietStartDate: subscription.startDate,
            dietEndDate: subscription.endDate,
            trainingStartDate: subscription.startDate,
            trainingEndDate: subscription.endDate,
        });
    }

    return subscription;
}

async function hydrateSubscription(subscription: SubscriptionEntity | null): Promise<SubscriptionEntity | null> {
    if (!subscription) {
        return null;
    }

    await migrateLegacyToTypedIfNeeded(subscription);

    const now = new Date();
    const dietActive = computeEndDateIsActive(subscription.dietEndDate, now);
    const trainingActive = computeEndDateIsActive(subscription.trainingEndDate, now);
    const legacyActive = computeIsActive(subscription, now);
    const overallActive = dietActive || trainingActive || legacyActive;

    const { startDate, endDate } = aggregateOverallDates(subscription);

    if (subscription.isActive !== overallActive || subscription.isSubscribed !== overallActive
        || subscription.startDate?.getTime() !== startDate?.getTime()
        || subscription.endDate?.getTime() !== endDate?.getTime()) {
        await subscription.update({
            isActive: overallActive,
            isSubscribed: overallActive,
            startDate,
            endDate,
        });
    }
    return subscription;
}

export class SubscriptionService {
    static async activateSubscription(userId: string, cycles = 1, subscriptionType?: unknown): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const type = normalizeSubscriptionType(subscriptionType);
        const startDate = new Date();
        const endDate = addDays(startDate, SUBSCRIPTION_CYCLE_DAYS * cycles);

        const existing = await hydrateSubscription(await SubscriptionRepository.findByUserId(userId));
        const nextProfileUpdateDue = existing?.lastProfileUpdateAt
            ? calculateNextProfileDue(existing.lastProfileUpdateAt)
            : calculateNextProfileDue(startDate);

        const patch: Partial<SubscriptionEntity> = {
            isSubscribed: true,
            isActive: true,
            nextProfileUpdateDue,
        };

        if (type === 'diet' || type === 'both') {
            patch.dietStartDate = startDate;
            patch.dietEndDate = endDate;
        }
        if (type === 'training' || type === 'both') {
            patch.trainingStartDate = startDate;
            patch.trainingEndDate = endDate;
        }

        // Maintain legacy overall dates for compatibility
        const merged = existing ? await SubscriptionRepository.upsert(userId, { ...patch, ...aggregateOverallDates({ ...existing.toJSON(), ...patch } as any) })
            : await SubscriptionRepository.upsert(userId, { ...patch, startDate, endDate });

        return hydrateSubscription(merged) as Promise<SubscriptionEntity>;
    }

    static async renewSubscription(userId: string, cycles = 1, subscriptionType?: unknown): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const type = normalizeSubscriptionType(subscriptionType);
        const now = new Date();
        const existing = await hydrateSubscription(await SubscriptionRepository.findByUserId(userId));

        const baseDiet = existing?.dietEndDate && existing.dietEndDate > now ? existing.dietEndDate : now;
        const baseTraining = existing?.trainingEndDate && existing.trainingEndDate > now ? existing.trainingEndDate : now;

        const nextDietEnd = addDays(baseDiet, SUBSCRIPTION_CYCLE_DAYS * cycles);
        const nextTrainingEnd = addDays(baseTraining, SUBSCRIPTION_CYCLE_DAYS * cycles);

        const patch: Partial<SubscriptionEntity> = {
            isSubscribed: true,
            isActive: true,
            nextProfileUpdateDue: existing?.lastProfileUpdateAt
                ? calculateNextProfileDue(existing.lastProfileUpdateAt)
                : calculateNextProfileDue(now),
        };

        if (type === 'diet' || type === 'both') {
            patch.dietStartDate = existing?.dietStartDate ?? now;
            patch.dietEndDate = nextDietEnd;
        }
        if (type === 'training' || type === 'both') {
            patch.trainingStartDate = existing?.trainingStartDate ?? now;
            patch.trainingEndDate = nextTrainingEnd;
        }

        // If the user had only legacy dates, preserve them via migration in hydrateSubscription.
        const overall = existing ? aggregateOverallDates({ ...existing.toJSON(), ...patch } as any) : { startDate: now, endDate: addDays(now, SUBSCRIPTION_CYCLE_DAYS * cycles) };

        const subscription = await SubscriptionRepository.upsert(userId, {
            ...patch,
            startDate: overall.startDate,
            endDate: overall.endDate,
        });

        return hydrateSubscription(subscription) as Promise<SubscriptionEntity>;
    }

    static async getStatus(userId: string): Promise<SubscriptionStatus> {
        const subscription = await hydrateSubscription(
            await SubscriptionRepository.findByUserId(userId)
        );

        if (!subscription) {
            return {
                isSubscribed: false,
                profileUpdateRequired: false,
                subscriptionType: 'none',
                details: {
                    diet: { isActive: false, startDate: null, endDate: null },
                    training: { isActive: false, startDate: null, endDate: null },
                },
                subscription: null,
            };
        }

        const now = new Date();
        const dietActive = computeEndDateIsActive(subscription.dietEndDate, now);
        const trainingActive = computeEndDateIsActive(subscription.trainingEndDate, now);
        const isActive = dietActive || trainingActive || computeIsActive(subscription);

        const subscriptionType: SubscriptionStatus['subscriptionType'] = dietActive && trainingActive
            ? 'both'
            : dietActive
                ? 'diet'
                : trainingActive
                    ? 'training'
                    : 'none';
        const profileUpdateRequired = !subscription.lastProfileUpdateAt ||
            (subscription.nextProfileUpdateDue
                ? subscription.nextProfileUpdateDue.getTime() <= Date.now()
                : false);

        return {
            isSubscribed: isActive,
            profileUpdateRequired,
            subscriptionType,
            details: {
                diet: {
                    isActive: dietActive,
                    startDate: subscription.dietStartDate,
                    endDate: subscription.dietEndDate,
                },
                training: {
                    isActive: trainingActive,
                    startDate: subscription.trainingStartDate,
                    endDate: subscription.trainingEndDate,
                },
            },
            subscription,
        };
    }

    static async requireActiveSubscription(userId: string): Promise<SubscriptionEntity> {
        const { subscription, isSubscribed } = await this.getStatus(userId);
        if (!subscription || !isSubscribed) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Active subscription required');
        }
        return subscription;
    }

    static async requireActiveSubscriptionForType(userId: string, subscriptionType: SubscriptionType): Promise<SubscriptionEntity> {
        const status = await this.getStatus(userId);
        if (!status.subscription || !status.isSubscribed) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Active subscription required');
        }

        if (subscriptionType === 'diet' && !status.details.diet.isActive) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Active diet subscription required');
        }
        if (subscriptionType === 'training' && !status.details.training.isActive) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Active training subscription required');
        }

        // both requires both active
        if (subscriptionType === 'both' && !(status.details.diet.isActive && status.details.training.isActive)) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Active diet + training subscription required');
        }

        return status.subscription;
    }

    static async recordProfileUpdate(userId: string, updateDate = new Date()): Promise<SubscriptionEntity | null> {
        const subscription = await SubscriptionRepository.findByUserId(userId);
        if (!subscription) {
            return null;
        }

        const nextProfileUpdateDue = calculateNextProfileDue(updateDate);
        await subscription.update({
            lastProfileUpdateAt: updateDate,
            nextProfileUpdateDue,
            isSubscribed: computeIsActive(subscription),
            isActive: computeIsActive(subscription),
        });
        return subscription;
    }
}
