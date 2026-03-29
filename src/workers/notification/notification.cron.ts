import cron from 'node-cron';
import { Op } from 'sequelize';
import { infoLogger, errorLogger } from '../../config/logger.config.js';
import { SubscriptionEntity } from '../../modules/subscription/v1/entity/subscription.entity.js';
import { UserEntity } from '../../modules/user/v1/entity/user.entity.js';
import { Roles } from '../../constants/roles.js';
import { DailyTrackingEntity } from '../../modules/tracking/v1/entity/daily-tracking.entity.js';
import { TrainingPlanDayEntity, TrainingPlanEntity } from '../../modules/plans/training/v1/entity/training-plan.entity.js';
import { notificationQueue } from './notification.queue.js';
import { NotificationTypes } from '../../constants/notification-type.js';
import { NotificationEntity } from '../../modules/notification/v1/entity/notification.entity.js';
import { UserProfileEntity } from '../../modules/user-profile/v1/model/user-profile.model.js';

function startOfDayUTC(date: Date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function endOfDayUTC(date: Date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

function daysAgoUTC(base: Date, days: number) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - days);
    return d;
}

function toDateOnlyUTC(date: Date) {
    return startOfDayUTC(date).toISOString().slice(0, 10);
}

type NotificationJob = { name: string; data: any };

async function enqueueDailyReminders() {
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const todayEnd = endOfDayUTC(now);
    const todayDateOnly = toDateOnlyUTC(now);
    const weekAgo = daysAgoUTC(todayStart, 7);
    const twoWeeksAgo = daysAgoUTC(todayStart, 14);

    const subscriptions = await SubscriptionEntity.findAll({
        where: { isSubscribed: true },
        include: [{ model: UserEntity, as: 'user', required: true, where: { role: Roles.USER }, attributes: ['id'] }],
    });

    const userIds = subscriptions.map((s: any) => s.user?.id).filter(Boolean) as string[];
    if (userIds.length === 0) {
        return;
    }

    const alreadySent = await NotificationEntity.findAll({
        where: {
            userId: userIds,
            createdAt: {
                [Op.between]: [todayStart, todayEnd],
            },
            type: [
                NotificationTypes.TRAINING_REMINDER,
                NotificationTypes.NUTRITION,
                NotificationTypes.BODY_IMAGE_REMINDER,
                NotificationTypes.INBODY_REMINDER,
            ],
        },
        attributes: ['userId', 'type'],
    });

    const sentByUserAndType = new Set(alreadySent.map((n: any) => `${n.userId}:${n.type}`));

    // Find users who have a training day scheduled today
    const trainingDays = await TrainingPlanDayEntity.findAll({
        include: [{ model: TrainingPlanEntity, as: 'plan', required: true, where: { userId: userIds }, attributes: ['userId'] }],
        where: {
            date: {
                [Op.between]: [todayStart, todayEnd],
            },
        },
    });

    const usersWithTrainingToday = new Set(trainingDays.map((d: any) => d.plan?.userId).filter(Boolean) as string[]);

    const dailyTrack = await DailyTrackingEntity.findAll({
        where: {
            userId: userIds,
            date: todayDateOnly,
        },
    });

    const trackingByUser = new Map<string, DailyTrackingEntity>();
    dailyTrack.forEach((t) => trackingByUser.set(t.userId, t));

    const profiles = await UserProfileEntity.findAll({
        where: { userId: userIds },
        attributes: ['userId', 'bodyImages', 'bodyImagesUpdatedAt', 'inbodyImage', 'inbodyImageUpdatedAt', 'createdAt'],
    });

    const profileByUser = new Map<string, UserProfileEntity>();
    profiles.forEach((profile) => profileByUser.set(String(profile.userId), profile));

    const jobs: NotificationJob[] = [];

    for (const userId of userIds) {
        const tracking = trackingByUser.get(userId);
        const profile = profileByUser.get(userId);

        const needsTrainingReminder = usersWithTrainingToday.has(userId) && !(tracking?.trainingDone ?? false);
        const needsDietReminder = !(tracking?.dietDone ?? false);

        if (needsTrainingReminder && !sentByUserAndType.has(`${userId}:${NotificationTypes.TRAINING_REMINDER}`)) {
            jobs.push({
                name: 'send',
                data: {
                    userId,
                    byUserId: null,
                    type: NotificationTypes.TRAINING_REMINDER,
                    title: 'Workout reminder',
                    body: 'You haven\'t trained today. Let\'s get your workout done!',
                },
            });
        }

        if (needsDietReminder && !sentByUserAndType.has(`${userId}:${NotificationTypes.NUTRITION}`)) {
            jobs.push({
                name: 'send',
                data: {
                    userId,
                    byUserId: null,
                    type: NotificationTypes.NUTRITION,
                    title: 'Meal reminder',
                    body: 'You haven\'t completed today\'s meals. Keep your nutrition on track.',
                },
            });
        }

        const bodyImages = Array.isArray(profile?.bodyImages) ? profile?.bodyImages : [];
        const hasBodyImages = bodyImages.length > 0;
        const bodyImagesUpdatedAt = profile?.bodyImagesUpdatedAt ? new Date(profile.bodyImagesUpdatedAt) : null;
        const bodyImagesAnchorDate = bodyImagesUpdatedAt ?? (profile?.createdAt ? new Date(profile.createdAt) : null);
        const needsBodyImageReminder =
            Boolean(bodyImagesAnchorDate) &&
            (!hasBodyImages || (bodyImagesUpdatedAt ? bodyImagesUpdatedAt <= weekAgo : bodyImagesAnchorDate <= weekAgo));

        if (needsBodyImageReminder && !sentByUserAndType.has(`${userId}:${NotificationTypes.BODY_IMAGE_REMINDER}`)) {
            jobs.push({
                name: 'send',
                data: {
                    userId,
                    byUserId: null,
                    type: NotificationTypes.BODY_IMAGE_REMINDER,
                    title: 'Progress Update',
                    body: 'Update your Body Shape Images to monitor your progress.',
                },
            });
        }

        const hasInbodyImage = Boolean(profile?.inbodyImage);
        const inbodyUpdatedAt = profile?.inbodyImageUpdatedAt ? new Date(profile.inbodyImageUpdatedAt) : null;
        const inbodyAnchorDate = inbodyUpdatedAt ?? (profile?.createdAt ? new Date(profile.createdAt) : null);
        const needsInbodyReminder =
            Boolean(inbodyAnchorDate) &&
            (!hasInbodyImage || (inbodyUpdatedAt ? inbodyUpdatedAt <= twoWeeksAgo : inbodyAnchorDate <= twoWeeksAgo));

        if (needsInbodyReminder && !sentByUserAndType.has(`${userId}:${NotificationTypes.INBODY_REMINDER}`)) {
            jobs.push({
                name: 'send',
                data: {
                    userId,
                    byUserId: null,
                    type: NotificationTypes.INBODY_REMINDER,
                    title: 'InBody Update',
                    body: 'Update your InBody results to monitor your body composition progress',
                },
            });
        }
    }

    if (jobs.length === 0) {
        return;
    }

    const chunkSize = 1000;
    for (let i = 0; i < jobs.length; i += chunkSize) {
        await notificationQueue.addBulk(jobs.slice(i, i + chunkSize));
    }

    infoLogger.info(`Queued ${jobs.length} daily reminder notifications`);
}

async function enqueueSubscriptionEndingTodayAlerts() {
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const todayEnd = endOfDayUTC(now);

    const expiringSubscriptions = await SubscriptionEntity.findAll({
        where: {
            isSubscribed: true,
            endDate: {
                [Op.between]: [todayStart, todayEnd],
            },
        },
        include: [{
            model: UserEntity,
            as: 'user',
            required: true,
            where: { role: Roles.USER },
            attributes: ['id', 'name'],
        }],
        order: [['endDate', 'ASC']],
    });

    if (expiringSubscriptions.length === 0) {
        return;
    }

    const recipients = await UserEntity.findAll({
        where: {
            role: {
                [Op.in]: [Roles.ADMIN, Roles.TRAINER],
            },
        },
        attributes: ['id'],
    });

    if (recipients.length === 0) {
        return;
    }

    const recipientIds = recipients.map((recipient) => String(recipient.id));
    const existingAlerts = await NotificationEntity.findAll({
        where: {
            userId: recipientIds,
            type: NotificationTypes.SUBSCRIPTION_ENDS_TODAY,
            createdAt: {
                [Op.between]: [todayStart, todayEnd],
            },
        },
        attributes: ['userId'],
    });

    const alreadySentRecipientIds = new Set(existingAlerts.map((notification) => String(notification.userId)));
    const expiringUserNames = Array.from(new Set(expiringSubscriptions
        .map((subscription: any) => String(subscription.user?.name ?? '').trim())
        .filter(Boolean)));

    if (expiringUserNames.length === 0) {
        return;
    }

    const body = buildSubscriptionEndingTodayBody(expiringUserNames);
    const jobs: NotificationJob[] = [];

    for (const recipientId of recipientIds) {
        if (alreadySentRecipientIds.has(recipientId)) {
            continue;
        }

        jobs.push({
            name: 'send',
            data: {
                userId: recipientId,
                byUserId: null,
                type: NotificationTypes.SUBSCRIPTION_ENDS_TODAY,
                title: 'Subscriptions ending today',
                body,
            },
        });
    }

    if (jobs.length === 0) {
        return;
    }

    const chunkSize = 1000;
    for (let i = 0; i < jobs.length; i += chunkSize) {
        await notificationQueue.addBulk(jobs.slice(i, i + chunkSize));
    }

    infoLogger.info(`Queued ${jobs.length} subscription ending today notifications`);
}

function buildSubscriptionEndingTodayBody(userNames: string[]) {
    if (userNames.length <= 5) {
        return `Subscriptions ending today: ${userNames.join(', ')}.`;
    }

    const previewNames = userNames.slice(0, 5).join(', ');
    const remaining = userNames.length - 5;
    return `Subscriptions ending today: ${previewNames}, and ${remaining} more.`;
}

export function startNotificationCron() {
    // Twice daily at 09:00 and 21:00 server time
    cron.schedule('0 9,21 * * *', async () => {
        try {
            await enqueueDailyReminders();
            await enqueueSubscriptionEndingTodayAlerts();
        } catch (err) {
            errorLogger.error('Notification cron failed', err);
        }
    });

    infoLogger.info('Notification cron scheduled (09:00 and 21:00)');
}
