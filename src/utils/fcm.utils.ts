import { admin } from '../firebase/firebase.js';
import { errorLogger, infoLogger } from '../config/logger.config.js';
import { UserSessionEntity } from '../modules/user-session/v1/entity/user-session.entity.js';

const FCM_MULTICAST_LIMIT = 500;

export interface FcmPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

export async function getUserFcmTokens(userId: string): Promise<string[]> {
    const sessions = await UserSessionEntity.findAll({
        where: { userId },
        attributes: ['id', 'fcmToken'],
    });

    return sessions
        .map((s) => s.fcmToken)
        .filter((token): token is string => typeof token === 'string' && token.trim().length > 0);
}

function chunk<T>(items: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

export async function sendFcmToTokens(tokens: string[], payload: FcmPayload) {
    if (tokens.length === 0) {
        return;
    }

    const tokenChunks = chunk(tokens, FCM_MULTICAST_LIMIT);

    for (const group of tokenChunks) {
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: group,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: payload.data,
            });

            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((r, idx) => {
                    if (!r.success) {
                        const code = (r.error as any)?.code as string | undefined;
                        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                            invalidTokens.push(group[idx]);
                        } else {
                            errorLogger.error('FCM send error', r.error);
                        }
                    }
                });

                if (invalidTokens.length) {
                    await UserSessionEntity.update(
                        { fcmToken: null },
                        { where: { fcmToken: invalidTokens } }
                    );
                    infoLogger.info(`Removed ${invalidTokens.length} invalid FCM tokens`);
                }
            }
        } catch (err) {
            errorLogger.error('FCM multicast failed', err);
        }
    }
}

export async function sendFcmToUser(userId: string, payload: FcmPayload) {
    const tokens = await getUserFcmTokens(userId);
    await sendFcmToTokens(tokens, payload);
}
