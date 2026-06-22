import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserSessionEntity } from './entity/user-session.entity.js';
import { sequelize } from '../../../database/db-config.js';
import { Op } from 'sequelize';
import './entity/associate-models.js';

interface UpdateFCMTokenInput {
    fcmToken: string;
    deviceId?: string;
}

export class UserSessionService {
    static async updateFCMToken(sessionId: string, { fcmToken, deviceId }: UpdateFCMTokenInput): Promise<void> {
        const normalizedToken = fcmToken.trim();
        const normalizedDeviceId = deviceId?.trim() || undefined;

        if (!normalizedToken) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'FCM token is required');
        }

        await sequelize.transaction(async (transaction) => {
            const session = await UserSessionEntity.findByPk(sessionId, { transaction });
            if (!session) {
                throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User session not found');
            }

            if (normalizedDeviceId) {
                await UserSessionEntity.destroy({
                    where: {
                        deviceId: normalizedDeviceId,
                        id: { [Op.ne]: sessionId },
                    },
                    transaction,
                });
            }

            await UserSessionEntity.update(
                { fcmToken: null },
                {
                    where: {
                        fcmToken: normalizedToken,
                        id: { [Op.ne]: sessionId },
                    },
                    transaction,
                }
            );

            if (normalizedDeviceId) {
                session.deviceId = normalizedDeviceId;
            }
            session.fcmToken = normalizedToken;
            session.fcmTokenUpdatedAt = new Date();
            await session.save({ transaction });
        });
    }

    static async cleanupExpiredSessions(now = new Date()): Promise<{ deletedSessions: number }> {
        // Only delete expired sessions that no longer carry an FCM token.
        // A session whose refresh window has passed but still holds an FCM token
        // is kept on purpose, so the device keeps receiving push notifications
        // even while the user is inactive. FCM tokens are never pruned by age —
        // invalid tokens are nulled by FCM feedback in sendFcmToTokens, and once
        // an expired session's token has been nulled this way it becomes eligible
        // for deletion on a later run.
        const deletedSessions = await UserSessionEntity.destroy({
            where: {
                expiresAt: {
                    [Op.lt]: now,
                },
                fcmToken: null,
            },
        });

        return { deletedSessions };
    }
}
