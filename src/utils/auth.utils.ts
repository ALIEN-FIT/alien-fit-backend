import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { env } from '../config/env.js';
import { HttpResponseError } from './appError.js';
import { UserService } from '../modules/user/v1/user.service.js';
import { UserSessionEntity } from '../modules/user-session/v1/entity/user-session.entity.js';
import { UserEntity } from '../modules/user/v1/entity/user.entity.js';

interface AccessTokenPayload {
    _id: string;
    sessionId: string;
    role?: string;
}

export interface AuthenticatedContext {
    user: UserEntity;
    session: UserSessionEntity;
}

export async function authenticateAccessToken(accessToken?: string): Promise<AuthenticatedContext> {
    if (!accessToken) {
        throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token');
    }

    let payload: AccessTokenPayload;
    try {
        payload = jwt.verify(accessToken, env.JWT_PRIVATE_KEY) as AccessTokenPayload;
    } catch (error) {
        throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token');
    }

    const [user, session] = await Promise.all([
        UserService.getUserById(payload._id),
        UserSessionEntity.findByPk(payload.sessionId)
    ]);

    if (!session) {
        throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Session not found');
    }

    if (session.userId !== user.id) {
        throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Session mismatch');
    }

    if (user.isBlocked) {
        await session.destroy();
        throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
    }

    return { user, session };
}
