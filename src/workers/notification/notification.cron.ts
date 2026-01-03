import cron from 'node-cron';
import { Op } from 'sequelize';
import { infoLogger, errorLogger } from '../../config/logger.config.js';
import { SubscriptionEntity } from '../../modules/subscription/v1/entity/subscription.entity.js';
import { UserEntity } from '../../modules/user/v1/entity/user.entity.js';
import { DailyTrackingEntity } from '../../modules/tracking/v1/entity/daily-tracking.entity.js';
import { TrainingPlanDayEntity, TrainingPlanEntity } from '../../modules/plans/training/v1/entity/training-plan.entity.js';
import { notificationQueue } from './notification.queue.js';
import { NotificationTypes } from '../../constants/notification-type.js';

function startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

async function enqueueDailyReminders() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const todayDateOnly = todayStart.toISOString().slice(0, 10);

    const subscriptions = await SubscriptionEntity.findAll({
        where: { isSubscribed: true },
        include: [{ model: UserEntity, as: 'user', required: true, attributes: ['id'] }],
    });

    const userIds = subscriptions.map((s: any) => s.user?.id).filter(Boolean) as string[];
    if (userIds.length === 0) {
        return;
    }

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

    const jobs: Array<{ name: string; data: any }> = [];

    for (const userId of userIds) {
        const tracking = trackingByUser.get(userId);

        const needsTrainingReminder = usersWithTrainingToday.has(userId) && !(tracking?.trainingDone ?? false);
        const needsDietReminder = !(tracking?.dietDone ?? false);

        if (!needsTrainingReminder && !needsDietReminder) {
            continue;
        }

        const parts: string[] = [];
        if (needsTrainingReminder) parts.push('training');
        if (needsDietReminder) parts.push('food');

        jobs.push({
            name: 'send',
            data: {
                userId,
                byUserId: null,
                type: NotificationTypes.TRAINING_REMINDER,
                title: 'Daily reminder',
                body: `Don\'t forget to finish today\'s ${parts.join(' and ')}.`,
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

    infoLogger.info(`Queued ${jobs.length} daily reminder notifications`);
}

export function startNotificationCron() {
    // Twice daily at 09:00 and 21:00 server time
    cron.schedule('0 9,21 * * *', async () => {
        try {
            await enqueueDailyReminders();
        } catch (err) {
            errorLogger.error('Notification cron failed', err);
        }
    });

    infoLogger.info('Notification cron scheduled (09:00 and 21:00)');
}
