export const SUBSCRIPTION_PLAN_TYPES = ['diet', 'training', 'both'] as const;

export type SubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPES)[number];

export const SUBSCRIPTION_PLAN_TYPE_SET = new Set<string>(SUBSCRIPTION_PLAN_TYPES);

export function getCapabilitiesForPlanType(planType: SubscriptionPlanType): {
    canAccessDiet: boolean;
    canAccessTraining: boolean;
} {
    if (planType === 'diet') {
        return { canAccessDiet: true, canAccessTraining: false };
    }
    if (planType === 'training') {
        return { canAccessDiet: false, canAccessTraining: true };
    }
    return { canAccessDiet: true, canAccessTraining: true };
}
