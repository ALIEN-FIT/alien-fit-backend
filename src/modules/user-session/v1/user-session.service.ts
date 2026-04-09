import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserSessionEntity } from './entity/user-session.entity.js';
import { sequelize } from '../../../database/db-config.js';
import './entity/associate-models.js';


export class UserSessionService {
    static async updateFCMToken(sessionId: string, fcmToken: string): Promise<void> {
        const normalizedToken = fcmToken.trim();
        if (!normalizedToken) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'FCM token is required');
        }

        await sequelize.transaction(async (transaction) => {
            const session = await UserSessionEntity.findByPk(sessionId, { transaction });
            if (!session) {
                throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User session not found');
            }

            await UserSessionEntity.update(
                { fcmToken: null },
                {
                    where: { fcmToken: normalizedToken },
                    transaction,
                }
            );

            session.fcmToken = normalizedToken;
            await session.save({ transaction });
        });
    }
}
