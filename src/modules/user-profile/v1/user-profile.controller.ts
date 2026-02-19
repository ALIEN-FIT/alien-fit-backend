import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { UserProfileService } from './user-profile.service.js';
import { SubscriptionService } from '../../subscription/v1/subscription.service.js';

export async function getUserProfileController(req: Request, res: Response): Promise<void> {
  const userId = req.params.userId || req.user.id;
  const [profile, subscriptionStatus] = await Promise.all([
    UserProfileService.getUserProfile(userId),
    SubscriptionService.getStatus(userId.toString()),
  ]);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      profile,
      subscription: {
        isSubscribed: subscriptionStatus.isSubscribed,
        isFreeTier: subscriptionStatus.isFreeTier,
        planType: subscriptionStatus.planType,
        capabilities: subscriptionStatus.capabilities,
        profileUpdateRequired: subscriptionStatus.profileUpdateRequired,
        startDate: subscriptionStatus.subscription?.startDate ?? null,
        endDate: subscriptionStatus.subscription?.endDate ?? null,
      },
    }
  });
}

export async function createOrUpdateUserProfileController(req: Request, res: Response): Promise<void> {
  const userId = (req.params.userId ?? req.user!.id).toString();
  const result = await UserProfileService.createOrUpdateUserProfile(req.user!, userId, req.body);

  if (result.action === 'request-created') {
    res.status(StatusCodes.ACCEPTED).json({
      status: 'success',
      data: {
        message: 'Plan update request created for admin review',
        planUpdateRequestId: result.planUpdateRequestId,
      },
    });
    return;
  }

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: {
      profile: result.profile,
      isProfileComplete: result.isProfileComplete,
    }
  });
}

export async function deleteUserProfileController(req: Request, res: Response): Promise<void> {
  const userId = req.params.userId || req.user.id;
  const profile = await UserProfileService.deleteUserProfile(userId);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: { profile }
  });
}