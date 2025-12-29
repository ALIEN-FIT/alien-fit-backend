import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { UserService } from './user.service.js';
import { SubscriptionService } from '../../subscription/v1/subscription.service.js';
import { DietPlanService } from '../../plans/diet/v1/diet-plan.service.js';
import { TrainingPlanService } from '../../plans/training/v1/training-plan.service.js';
import { TrackingRepository } from '../../tracking/v1/tracking.repository.js';
import { UserProfileService } from '../../user-profile/v1/user-profile.service.js';


export async function createUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.createUser({
        ...req.body,
        isVerified: true
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { user }
    });
}

export async function getUserByIdController(req: Request, res: Response): Promise<void> {
    const user = await UserService.getUserById(req.params.id);

    // User profile (best-effort; may not exist yet)
    let userProfile: any = null;
    try {
        userProfile = await UserProfileService.getUserProfile(user.id.toString());
    } catch { }

    // Subscription status
    const subscriptionStatus = await SubscriptionService.getStatus(user.id.toString());

    // Diet and Training plans (best-effort; may be forbidden for non-admins)
    let dietPlan: any = null;
    let trainingPlan: any = null;
    try {
        const plan = await DietPlanService.getDietPlan(req.user as any, user.id.toString());
        dietPlan = plan;
    } catch { }
    try {
        const plan = await TrainingPlanService.getTrainingPlan(req.user as any, user.id.toString());
        trainingPlan = plan;
    } catch { }

    // Last 7 days tracking
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    const trackingLast7 = await TrackingRepository.findByUserAndDates(user.id.toString(), dates);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            user,
            subscription: subscriptionStatus.subscription,
            subscriptionStatus: {
                isSubscribed: subscriptionStatus.isSubscribed,
                profileUpdateRequired: subscriptionStatus.profileUpdateRequired,
            },
            dietPlan,
            trainingPlan,
            profile: {
                isProfileComplete: (user as any).isProfileComplete ?? false,
                userProfile,
            },
            trackingLast7,
        }
    });
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.updateUser(req.params.id, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { user }
    });
}

export async function deleteUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.deleteUser(req.params.id);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { user }
    });
}

export async function getUsersFilterController(req: Request, res: Response): Promise<void> {
    const { page, limit, ...filter } = req.query;

    const data = await UserService.getUsersByFilter(filter, {
        page: Number(page),
        limit: Number(limit)
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data
    });
}