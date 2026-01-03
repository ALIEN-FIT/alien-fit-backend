import { Job, Worker } from 'bullmq';
import { createBullConnection } from './notification.connection.js';
import { notificationQueue } from './notification.queue.js';
import { errorLogger, infoLogger } from '../../config/logger.config.js';
import { NotificationRepository } from '../../modules/notification/v1/notification.repository.js';
import { sendFcmToUser } from '../../utils/fcm.utils.js';
import { BroadcastNotificationJobData, SendNotificationJobData } from '../../utils/notification.utils.js';
import { SubscriptionEntity } from '../../modules/subscription/v1/entity/subscription.entity.js';
import { UserEntity } from '../../modules/user/v1/entity/user.entity.js';

const CONCURRENCY = 10;

async function handleSend(job: Job<SendNotificationJobData>) {
    const payload = job.data;

    const notification = await NotificationRepository.create({
        userId: payload.userId,
        byUserId: payload.byUserId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
    });

    await sendFcmToUser(payload.userId, {
        title: payload.title,
        body: payload.body,
        data: {
            type: payload.type,
            notificationId: notification.id,
        },
    });
}

async function handleBroadcast(job: Job<BroadcastNotificationJobData>) {
    const { filters, ...base } = job.data;

    const whereUser: Record<string, any> = {};
    if (filters.gender) {
        whereUser.gender = filters.gender;
    }

    const whereSub: Record<string, any> = {};
    if (typeof filters.isSubscribed === 'boolean') {
        whereSub.isSubscribed = filters.isSubscribed;
    }

    const subscriptions = await SubscriptionEntity.findAll({
        where: whereSub,
        include: [{ model: UserEntity, as: 'user', required: true, where: whereUser, attributes: ['id'] }],
    });

    const userIds = subscriptions.map((s: any) => s.user?.id).filter(Boolean) as string[];

    if (userIds.length === 0) {
        return;
    }

    const jobs = userIds.map((userId) => ({
        name: 'send',
        data: {
            userId,
            byUserId: base.byUserId,
            type: base.type,
            title: base.title,
            body: base.body,
        },
    }));

    // chunk addBulk to avoid huge payloads
    const chunkSize = 1000;
    for (let i = 0; i < jobs.length; i += chunkSize) {
        await notificationQueue.addBulk(jobs.slice(i, i + chunkSize));
    }
}

export function startNotificationWorker() {
    const worker = new Worker(
        'notifications',
        async (job) => {
            if (job.name === 'send') {
                await handleSend(job as Job<SendNotificationJobData>);
                return;
            }
            if (job.name === 'broadcast') {
                await handleBroadcast(job as Job<BroadcastNotificationJobData>);
                return;
            }

            infoLogger.info(`Unknown notification job: ${job.name}`);
        },
        {
            connection: createBullConnection(),
            concurrency: CONCURRENCY,
        }
    );

    worker.on('failed', (job, err) => {
        errorLogger.error('Notification job failed', { jobId: job?.id, name: job?.name, err });
    });

    worker.on('completed', (job) => {
        infoLogger.info('Notification job completed', { jobId: job.id, name: job.name });
    });

    infoLogger.info('Notification worker started');

    return worker;
}
