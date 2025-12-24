import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { UserProfileEntity } from './model/user-profile.model.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { UserService } from '../../user/v1/user.service.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';
import { Roles } from '../../../constants/roles.js';
import { SubscriptionService } from '../../subscription/v1/subscription.service.js';
import { PlanUpdateRequestService } from '../../requests/v1/plan-update-request.service.js';
import { Op } from 'sequelize';

interface ProfileUpdateResult {
  profile?: UserProfileEntity;
  isProfileComplete?: boolean;
  action: 'updated' | 'request-created';
  planUpdateRequestId?: string;
}

async function assertBodyImagesExistIfProvided(bodyImages: string[] | null | undefined) {
  if (bodyImages === undefined || bodyImages === null) {
    return;
  }

  if (bodyImages.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(bodyImages)];
  const foundCount = await MediaEntity.count({
    where: {
      id: {
        [Op.in]: uniqueIds,
      },
    },
  });

  if (foundCount !== uniqueIds.length) {
    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'One or more bodyImages not found');
  }
}

export class UserProfileService {
  static async getUserProfile(userId: string | number): Promise<UserProfileEntity> {
    const profile = await UserProfileEntity.findOne({ where: { userId } });
    if (!profile) {
      throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User profile not found');
    }
    return profile;
  }

  static async createOrUpdateUserProfile(
    actor: UserEntity,
    userId: string,
    profileData: Partial<UserProfileEntity>
  ): Promise<ProfileUpdateResult> {
    await UserService.getUserById(userId);

    await assertBodyImagesExistIfProvided(profileData.bodyImages);

    const isAdmin = actor.role === Roles.ADMIN;
    const isSelfUpdate = actor.id === userId;

    if (!isAdmin && !isSelfUpdate) {
      throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Not allowed to update this profile');
    }

    if (!isAdmin && isSelfUpdate) {
      const subscriptionStatus = await SubscriptionService.getStatus(userId);
      if (!subscriptionStatus.isSubscribed) {
        throw new HttpResponseError(
          StatusCodes.FORBIDDEN,
          'Profile updates are only available for subscribed users'
        );
      }
    }

    let profile = await UserProfileEntity.findOne({ where: { userId } });

    if (profile) {
      await profile.update(profileData);
    } else {
      profile = await UserProfileEntity.create({
        userId,
        ...profileData,
      });
    }

    const isProfileComplete = true;

    await UserEntity.update(
      { isProfileComplete },
      { where: { id: userId } }
    );

    await SubscriptionService.recordProfileUpdate(userId);

    const request = await PlanUpdateRequestService.ensurePendingProfileUpdateRequest(
      userId,
      profileData ? { profileData } : null
    );

    return { profile, isProfileComplete, action: 'updated', planUpdateRequestId: request.id };
  }

  static async deleteUserProfile(userId: string | number): Promise<UserProfileEntity> {
    const profile = await UserProfileEntity.findOne({ where: { userId } });
    if (!profile) {
      throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User profile not found');
    }

    await profile.destroy();

    await UserEntity.update(
      { isProfileComplete: false },
      { where: { id: userId } }
    );

    return profile;
  }
}