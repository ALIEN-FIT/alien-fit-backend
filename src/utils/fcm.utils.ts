import { admin } from '../firebase/firebase.js';
import { errorLogger, infoLogger } from '../config/logger.config.js';
import { UserSessionEntity } from '../modules/user-session/v1/entity/user-session.entity.js';
import { Op } from 'sequelize';
import { FCM_MESSAGE_TTL_MS, getApnsExpiration } from '../config/session.config.js';

const FCM_MULTICAST_LIMIT = 500;

export interface FcmPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

export async function getUserFcmTokens(userId: string): Promise<string[]> {
    // Push delivery is intentionally NOT gated on session expiry or token age.
    // An FCM token stays valid on the device regardless of whether the user is
    // active, logged in, or has a live session — so we deliver to any stored
    // token. Dead tokens are pruned only when FCM itself reports them invalid
    // (see sendFcmToTokens), never by guessing from timestamps.
    const sessions = await UserSessionEntity.findAll({
        where: {
            userId,
            fcmToken: { [Op.ne]: null },
        },
        attributes: ['id', 'fcmToken'],
    });

    const tokens = sessions
        .map((s) => s.fcmToken)
        .filter((token): token is string => typeof token === 'string' && token.trim().length > 0);

    return Array.from(new Set(tokens));
}

function chunk<T>(items: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

export async function sendFcmToTokens(tokens: string[], payload: FcmPayload) {
    const uniqueTokens = Array.from(new Set(tokens.map((token) => token.trim()).filter((token) => token.length > 0)));

    if (uniqueTokens.length === 0) {
        return;
    }

    const tokenChunks = chunk(uniqueTokens, FCM_MULTICAST_LIMIT);

    const transientErrors: unknown[] = [];

    for (const group of tokenChunks) {
        let response;
        try {
            response = await admin.messaging().sendEachForMulticast(buildFcmMulticastMessage(group, payload));
        } catch (err) {
            errorLogger.error('FCM multicast failed', err);
            transientErrors.push(err);
            continue;
        }

        if (response.failureCount > 0) {
            const invalidTokens: string[] = [];
            response.responses.forEach((r, idx) => {
                if (!r.success) {
                    const maybeError = r.error as { code?: string } | undefined;
                    const code = maybeError?.code;
                    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
                        invalidTokens.push(group[idx]);
                    } else {
                        errorLogger.error('FCM send error', r.error);
                        transientErrors.push(r.error);
                    }
                }
            });

            if (invalidTokens.length) {
                await UserSessionEntity.update(
                    { fcmToken: null },
                    { where: { fcmToken: { [Op.in]: invalidTokens } } }
                );
                infoLogger.info(`Removed ${invalidTokens.length} invalid FCM tokens`);
            }
        }
    }

    if (transientErrors.length > 0) {
        throw new Error(`FCM send had ${transientErrors.length} transient failures`);
    }
}

export async function sendFcmToUser(userId: string, payload: FcmPayload) {
    const tokens = await getUserFcmTokens(userId);
    await sendFcmToTokens(tokens, payload);
}

export function buildFcmMulticastMessage(tokens: string[], payload: FcmPayload, now = new Date()) {
    return {
        tokens,
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: payload.data,
        android: {
            priority: 'high' as const,
            ttl: FCM_MESSAGE_TTL_MS,
            notification: {
                defaultSound: true,
                defaultVibrateTimings: true,
            },
        },
        apns: {
            headers: {
                'apns-priority': '10',
                'apns-push-type': 'alert',
                'apns-expiration': getApnsExpiration(now),
            },
            payload: {
                aps: {
                    sound: 'default',
                    mutableContent: true,
                    contentAvailable: true,
                    alert: {
                        title: payload.title,
                        body: payload.body,
                    },
                },
            },
        },
    };
}
