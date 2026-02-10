import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { SubscriptionRepository } from './subscription.repository.js';
import { SubscriptionEntity } from './entity/subscription.entity.js';
import { addDays } from '../../../utils/date.utils.js';

const SUBSCRIPTION_CYCLE_DAYS = 30;

interface SubscriptionStatus {
    isSubscribed: boolean;
    profileUpdateRequired: boolean;
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

async function hydrateSubscription(subscription: SubscriptionEntity | null): Promise<SubscriptionEntity | null> {
    if (!subscription) {
        return null;
    }
    const isActive = computeIsActive(subscription);
    if (subscription.isActive !== isActive || subscription.isSubscribed !== isActive) {
        await subscription.update({
            isActive,
            isSubscribed: isActive,
        });
    }
    return subscription;
}

export class SubscriptionService {
    static async activateFreeSubscription(userId: string, freeDays: number): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const startDate = new Date();
        const endDate = addDays(startDate, freeDays);

        const subscription = await SubscriptionRepository.upsert(userId, {
            isSubscribed: true,
            isActive: true,
            isFree: true,
            freeDays,
            startDate,
            endDate,
            nextProfileUpdateDue: calculateNextProfileDue(startDate),
        });

        return hydrateSubscription(subscription) as Promise<SubscriptionEntity>;
    }

    static async activateSubscription(userId: string, cycles = 1): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const startDate = new Date();
        const endDate = addDays(startDate, SUBSCRIPTION_CYCLE_DAYS * cycles);

        const existing = await SubscriptionRepository.findByUserId(userId);
        const nextProfileUpdateDue = existing?.lastProfileUpdateAt
            ? calculateNextProfileDue(existing.lastProfileUpdateAt)
            : calculateNextProfileDue(startDate);

        const subscription = await SubscriptionRepository.upsert(userId, {
            isSubscribed: true,
            isActive: true,
            isFree: false,
            startDate,
            endDate,
            nextProfileUpdateDue,
        });

        return hydrateSubscription(subscription) as Promise<SubscriptionEntity>;
    }

    static async renewSubscription(userId: string, cycles = 1): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const now = new Date();
        const existing = await SubscriptionRepository.findByUserId(userId);
        const baseDate = existing?.endDate && existing.endDate > now ? existing.endDate : now;
        const endDate = addDays(baseDate, SUBSCRIPTION_CYCLE_DAYS * cycles);

        const subscription = await SubscriptionRepository.upsert(userId, {
            isSubscribed: true,
            isFree: false,
            isActive: true,
            startDate: now,
            endDate,
            nextProfileUpdateDue: existing?.lastProfileUpdateAt
                ? calculateNextProfileDue(existing.lastProfileUpdateAt)
                : calculateNextProfileDue(now),
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
                subscription: null,
            };
        }

        const isActive = computeIsActive(subscription);
        const profileUpdateRequired = !subscription.lastProfileUpdateAt ||
            (subscription.nextProfileUpdateDue
                ? subscription.nextProfileUpdateDue.getTime() <= Date.now()
                : false);

        return {
            isSubscribed: isActive,
            profileUpdateRequired,
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
