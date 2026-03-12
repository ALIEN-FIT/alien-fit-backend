import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { SubscriptionRepository } from './subscription.repository.js';
import { SubscriptionEntity } from './entity/subscription.entity.js';
import { SubscriptionFreezeRequestEntity } from './entity/subscription-freeze-request.entity.js';
import { SubscriptionDefrostRequestEntity } from './entity/subscription-defrost-request.entity.js';
import { SubscriptionFreezeRequestRepository } from './subscription-freeze-request.repository.js';
import { SubscriptionDefrostRequestRepository } from './subscription-defrost-request.repository.js';
import { addDays, differenceInCalendarDaysUTC, startOfDayUTC } from '../../../utils/date.utils.js';
import { getCapabilitiesForPlanType, SUBSCRIPTION_PLAN_TYPE_SET, SubscriptionPlanType } from '../../subscription-packages/v1/subscription-plan-type.js';

const SUBSCRIPTION_CYCLE_DAYS = 30;

type SubscriptionLifecycleStatus = 'inactive' | 'active' | 'frozen';

interface SubscriptionStatus {
    status: SubscriptionLifecycleStatus;
    isSubscribed: boolean;
    isFrozen: boolean;
    freezeStartedAt: Date | null;
    freezingEndDate: Date | null;
    profileUpdateRequired: boolean;
    isFreeTier: boolean;
    planType: SubscriptionPlanType;
    capabilities: {
        canAccessDiet: boolean;
        canAccessTraining: boolean;
    };
    subscription: SubscriptionEntity | null;
}

function calculateNextProfileDue(lastUpdate: Date | null): Date | null {
    if (!lastUpdate) {
        return null;
    }
    return addDays(lastUpdate, 30);
}

function computeHasRemainingTime(subscription: SubscriptionEntity | null, referenceDate = new Date()): boolean {
    if (!subscription || !subscription.endDate) {
        return false;
    }
    return subscription.endDate.getTime() >= referenceDate.getTime();
}

async function defrostSubscriptionRecord(
    subscription: SubscriptionEntity,
    defrostDate = new Date(),
): Promise<SubscriptionEntity> {
    const normalizedDefrostDate = startOfDayUTC(defrostDate);

    if (!subscription.isFrozen) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription is not frozen');
    }

    if (!subscription.frozenAt || !subscription.freezingEndDate || !subscription.endDate) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Frozen subscription data is incomplete');
    }

    const remainingFrozenDays = differenceInCalendarDaysUTC(subscription.freezingEndDate, normalizedDefrostDate);
    const endDate = addDays(subscription.endDate, -remainingFrozenDays);
    const isActive = endDate.getTime() >= normalizedDefrostDate.getTime();

    await subscription.update({
        endDate,
        isFrozen: false,
        frozenAt: null,
        freezingEndDate: null,
        isActive,
        isSubscribed: isActive,
    });

    return subscription;
}

async function autoDefrostIfNeeded(
    subscription: SubscriptionEntity | null,
    referenceDate = new Date(),
): Promise<SubscriptionEntity | null> {
    if (!subscription || !subscription.isFrozen || !subscription.freezingEndDate) {
        return subscription;
    }

    const normalizedReferenceDate = startOfDayUTC(referenceDate);
    if (normalizedReferenceDate.getTime() < subscription.freezingEndDate.getTime()) {
        return subscription;
    }

    return defrostSubscriptionRecord(subscription, normalizedReferenceDate);
}

function getLifecycleStatus(
    subscription: SubscriptionEntity | null,
    referenceDate = new Date(),
): SubscriptionLifecycleStatus {
    if (!subscription) {
        return 'inactive';
    }
    if (subscription.isFrozen) {
        return 'frozen';
    }
    return computeHasRemainingTime(subscription, referenceDate) ? 'active' : 'inactive';
}

async function hydrateSubscription(subscription: SubscriptionEntity | null): Promise<SubscriptionEntity | null> {
    subscription = await autoDefrostIfNeeded(subscription);

    if (!subscription) {
        return null;
    }
    const lifecycleStatus = getLifecycleStatus(subscription);
    const isActive = lifecycleStatus === 'active';

    if (subscription.isActive !== isActive || subscription.isSubscribed !== isActive) {
        await subscription.update({
            isActive,
            isSubscribed: isActive,
        });
    }
    return subscription;
}

function normalizePlanType(planType: unknown): SubscriptionPlanType {
    const normalized = String(planType ?? 'both').trim().toLowerCase();
    if (SUBSCRIPTION_PLAN_TYPE_SET.has(normalized)) {
        return normalized as SubscriptionPlanType;
    }
    return 'both';
}

function resolveStatusEntitlements(
    subscription: SubscriptionEntity | null,
    lifecycleStatus: SubscriptionLifecycleStatus,
) {
    if (lifecycleStatus === 'frozen' && subscription) {
        return {
            isFreeTier: Boolean(subscription.isFree),
            planType: normalizePlanType(subscription.planType),
            capabilities: {
                canAccessDiet: false,
                canAccessTraining: false,
            },
        };
    }

    const isSubscribed = lifecycleStatus === 'active';
    const isFreeTier = !isSubscribed || Boolean(subscription?.isFree);
    const planType = isFreeTier
        ? 'both'
        : normalizePlanType(subscription?.planType);

    return {
        isFreeTier,
        planType,
        capabilities: getCapabilitiesForPlanType(planType),
    };
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
            planType: 'both',
            startDate,
            endDate,
            isFrozen: false,
            frozenAt: null,
            freezingEndDate: null,
            nextProfileUpdateDue: calculateNextProfileDue(startDate),
        });

        return hydrateSubscription(subscription) as Promise<SubscriptionEntity>;
    }

    static async activateSubscription(userId: string, cycles = 1, planType: SubscriptionPlanType = 'both'): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const startDate = new Date();
        const endDate = addDays(startDate, SUBSCRIPTION_CYCLE_DAYS * cycles);
        const normalizedPlanType = normalizePlanType(planType);

        const existing = await SubscriptionRepository.findByUserId(userId);
        const nextProfileUpdateDue = existing?.lastProfileUpdateAt
            ? calculateNextProfileDue(existing.lastProfileUpdateAt)
            : calculateNextProfileDue(startDate);

        const subscription = await SubscriptionRepository.upsert(userId, {
            isSubscribed: true,
            isActive: true,
            isFree: false,
            planType: normalizedPlanType,
            startDate,
            endDate,
            isFrozen: false,
            frozenAt: null,
            freezingEndDate: null,
            nextProfileUpdateDue,
        });

        return hydrateSubscription(subscription) as Promise<SubscriptionEntity>;
    }

    static async renewSubscription(userId: string, cycles = 1, planType?: SubscriptionPlanType): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const now = new Date();
        const existing = await SubscriptionRepository.findByUserId(userId);
        const baseDate = existing?.endDate && existing.endDate > now ? existing.endDate : now;
        const endDate = addDays(baseDate, SUBSCRIPTION_CYCLE_DAYS * cycles);
        const normalizedPlanType = normalizePlanType(planType ?? existing?.planType ?? 'both');

        const subscription = await SubscriptionRepository.upsert(userId, {
            isSubscribed: true,
            isFree: false,
            isActive: !existing?.isFrozen,
            planType: normalizedPlanType,
            startDate: now,
            endDate,
            freezingEndDate: existing?.isFrozen ? endDate : null,
            nextProfileUpdateDue: existing?.lastProfileUpdateAt
                ? calculateNextProfileDue(existing.lastProfileUpdateAt)
                : calculateNextProfileDue(now),
        });

        return hydrateSubscription(subscription) as Promise<SubscriptionEntity>;
    }

    static async freezeSubscription(userId: string, freezeDays: number, freezeDate = new Date()): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);

        if (!Number.isInteger(freezeDays) || freezeDays < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Freeze days must be a positive integer');
        }

        const normalizedFreezeDate = startOfDayUTC(freezeDate);

        const subscription = await hydrateSubscription(
            await SubscriptionRepository.findByUserId(userId)
        );

        if (!subscription) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription not found');
        }

        if (subscription.isFree) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Free subscriptions cannot be frozen');
        }

        const lifecycleStatus = getLifecycleStatus(subscription, normalizedFreezeDate);
        if (lifecycleStatus === 'frozen') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription is already frozen');
        }

        if (lifecycleStatus !== 'active' || !subscription.endDate) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Only active paid subscriptions can be frozen');
        }

        const freezingEndDate = addDays(normalizedFreezeDate, freezeDays);
        const endDate = addDays(subscription.endDate, freezeDays);

        await subscription.update({
            isFrozen: true,
            frozenAt: normalizedFreezeDate,
            freezingEndDate,
            endDate,
            isActive: false,
            isSubscribed: false,
        });

        return subscription;
    }

    static async createFreezeRequest(userId: string, requestedDays: number, requestedNote?: string | null): Promise<SubscriptionFreezeRequestEntity> {
        await UserService.getUserById(userId);

        if (!Number.isInteger(requestedDays) || requestedDays < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Requested freeze days must be a positive integer');
        }

        const subscription = await hydrateSubscription(await SubscriptionRepository.findByUserId(userId));
        if (!subscription) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription not found');
        }
        if (subscription.isFree) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Free subscriptions cannot be frozen');
        }

        const lifecycleStatus = getLifecycleStatus(subscription);
        if (lifecycleStatus === 'frozen') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription is already frozen');
        }
        if (lifecycleStatus !== 'active') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Only active paid subscriptions can request freezing');
        }

        const pending = await SubscriptionFreezeRequestRepository.findPendingByUserId(userId);
        if (pending) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User already has a pending freeze request');
        }

        return SubscriptionFreezeRequestRepository.create({
            userId,
            status: 'pending',
            requestedDays,
            requestedNote: requestedNote ?? null,
        });
    }

    static async listPendingFreezeRequests(): Promise<SubscriptionFreezeRequestEntity[]> {
        return SubscriptionFreezeRequestRepository.listPending();
    }

    static async approveFreezeRequest(
        requestId: string,
        adminId: string,
        approvedDays?: number | null,
        decisionNote?: string | null,
    ): Promise<{ request: SubscriptionFreezeRequestEntity; subscription: SubscriptionEntity }> {
        await UserService.getUserById(adminId);
        const request = await SubscriptionFreezeRequestRepository.findById(requestId);
        if (!request) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Freeze request not found');
        }
        if (request.status !== 'pending') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Freeze request is already resolved');
        }

        const effectiveFreezeDays = approvedDays ?? request.requestedDays;
        if (!Number.isInteger(effectiveFreezeDays) || effectiveFreezeDays < 1) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Freeze days must be a positive integer');
        }

        const subscription = await this.freezeSubscription(request.userId, effectiveFreezeDays);

        await request.update({
            status: 'approved',
            approvedDays: effectiveFreezeDays,
            decisionNote: decisionNote ?? null,
            resolvedBy: adminId,
            resolvedAt: new Date(),
        });

        return { request, subscription };
    }

    static async declineFreezeRequest(
        requestId: string,
        adminId: string,
        decisionNote?: string | null,
    ): Promise<SubscriptionFreezeRequestEntity> {
        await UserService.getUserById(adminId);
        const request = await SubscriptionFreezeRequestRepository.findById(requestId);
        if (!request) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Freeze request not found');
        }
        if (request.status !== 'pending') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Freeze request is already resolved');
        }

        await request.update({
            status: 'declined',
            approvedDays: null,
            decisionNote: decisionNote ?? null,
            resolvedBy: adminId,
            resolvedAt: new Date(),
        });

        return request;
    }

    static async createDefrostRequest(
        userId: string,
        requestedNote?: string | null,
    ): Promise<SubscriptionDefrostRequestEntity> {
        await UserService.getUserById(userId);

        const subscription = await hydrateSubscription(await SubscriptionRepository.findByUserId(userId));
        if (!subscription) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription not found');
        }

        const lifecycleStatus = getLifecycleStatus(subscription);
        if (lifecycleStatus !== 'frozen') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Only frozen subscriptions can request defrost');
        }

        const pending = await SubscriptionDefrostRequestRepository.findPendingByUserId(userId);
        if (pending) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User already has a pending defrost request');
        }

        return SubscriptionDefrostRequestRepository.create({
            userId,
            status: 'pending',
            requestedNote: requestedNote ?? null,
        });
    }

    static async listPendingDefrostRequests(): Promise<SubscriptionDefrostRequestEntity[]> {
        return SubscriptionDefrostRequestRepository.listPending();
    }

    static async approveDefrostRequest(
        requestId: string,
        adminId: string,
        decisionNote?: string | null,
    ): Promise<{ request: SubscriptionDefrostRequestEntity; subscription: SubscriptionEntity }> {
        await UserService.getUserById(adminId);
        const request = await SubscriptionDefrostRequestRepository.findById(requestId);
        if (!request) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Defrost request not found');
        }
        if (request.status !== 'pending') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Defrost request is already resolved');
        }

        const subscription = await this.defrostSubscription(request.userId);

        await request.update({
            status: 'approved',
            decisionNote: decisionNote ?? null,
            resolvedBy: adminId,
            resolvedAt: new Date(),
        });

        return { request, subscription };
    }

    static async declineDefrostRequest(
        requestId: string,
        adminId: string,
        decisionNote?: string | null,
    ): Promise<SubscriptionDefrostRequestEntity> {
        await UserService.getUserById(adminId);
        const request = await SubscriptionDefrostRequestRepository.findById(requestId);
        if (!request) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Defrost request not found');
        }
        if (request.status !== 'pending') {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Defrost request is already resolved');
        }

        await request.update({
            status: 'declined',
            decisionNote: decisionNote ?? null,
            resolvedBy: adminId,
            resolvedAt: new Date(),
        });

        return request;
    }

    static async defrostSubscription(userId: string, defrostDate = new Date()): Promise<SubscriptionEntity> {
        await UserService.getUserById(userId);
        const subscription = await SubscriptionRepository.findByUserId(userId);
        if (!subscription) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Subscription not found');
        }

        return defrostSubscriptionRecord(subscription, defrostDate);
    }

    static async getStatus(userId: string): Promise<SubscriptionStatus> {
        const subscription = await hydrateSubscription(
            await SubscriptionRepository.findByUserId(userId)
        );
        const lifecycleStatus = getLifecycleStatus(subscription);

        if (!subscription) {
            return {
                status: 'inactive',
                isSubscribed: false,
                isFrozen: false,
                freezeStartedAt: null,
                freezingEndDate: null,
                profileUpdateRequired: false,
                isFreeTier: true,
                planType: 'both',
                capabilities: getCapabilitiesForPlanType('both'),
                subscription: null,
            };
        }

        const isActive = lifecycleStatus === 'active';
        const profileUpdateRequired = !subscription.lastProfileUpdateAt ||
            (subscription.nextProfileUpdateDue
                ? subscription.nextProfileUpdateDue.getTime() <= Date.now()
                : false);
        const entitlement = resolveStatusEntitlements(subscription, lifecycleStatus);

        return {
            status: lifecycleStatus,
            isSubscribed: isActive,
            isFrozen: lifecycleStatus === 'frozen',
            freezeStartedAt: subscription.frozenAt,
            freezingEndDate: subscription.freezingEndDate,
            profileUpdateRequired,
            isFreeTier: entitlement.isFreeTier,
            planType: entitlement.planType,
            capabilities: entitlement.capabilities,
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
        const isActive = getLifecycleStatus(subscription, updateDate) === 'active';
        await subscription.update({
            lastProfileUpdateAt: updateDate,
            nextProfileUpdateDue,
            isSubscribed: isActive,
            isActive,
        });
        return subscription;
    }
}
