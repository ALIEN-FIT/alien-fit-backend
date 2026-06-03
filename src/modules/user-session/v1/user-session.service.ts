import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserSessionEntity } from './entity/user-session.entity.js';
import { sequelize } from '../../../database/db-config.js';
import { Op, col, fn, where } from 'sequelize';
import './entity/associate-models.js';
import { getFcmTokenFreshnessCutoff } from '../../../config/session.config.js';

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

    static async cleanupExpiredSessionsAndStaleFcmTokens(now = new Date()): Promise<{ deletedSessions: number; clearedTokens: number }> {
        const staleCutoff = getFcmTokenFreshnessCutoff(now);

        const [clearedTokens] = await UserSessionEntity.update(
            { fcmToken: null },
            {
                where: {
                    fcmToken: { [Op.ne]: null },
                    [Op.and]: [
                        where(fn('COALESCE', col('fcmTokenUpdatedAt'), col('updatedAt')), {
                            [Op.lt]: staleCutoff,
                        }),
                    ],
                },
            }
        );

        const deletedSessions = await UserSessionEntity.destroy({
            where: {
                expiresAt: {
                    [Op.lt]: now,
                },
            },
        });

        return { deletedSessions, clearedTokens };
    }
}
