import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { UserEntity } from '../modules/user/v1/entity/user.entity.js';
import { UserSessionEntity } from '../modules/user-session/v1/entity/user-session.entity.js';
import { env } from '../config/env.js';
import { JWT_ACCESS_TOKEN_TTL, JWT_REFRESH_TOKEN_TTL } from '../config/session.config.js';



export interface IAuthToken {
    token: string;
    expiresAt: Date;
}

export const generateAuthToken = function (this: UserEntity, sessionId: string): IAuthToken {
    const token = jwt.sign(
        { _id: this.id, role: this.role, sessionId },
        env.JWT_PRIVATE_KEY,
        { expiresIn: JWT_ACCESS_TOKEN_TTL }
    );

    return {
        token,
        expiresAt: getTokenExpiryDate(token),
    };
};

export const generateRefreshToken = async function (this: UserEntity, sessionId: string): Promise<string> {
    const refreshToken = jwt.sign(
        { _id: this.id, tokenId: randomUUID(), sessionId },
        env.REFRESH_TOKEN_PRIVATE_KEY,
        { expiresIn: JWT_REFRESH_TOKEN_TTL }
    );

    const expiresAt = getTokenExpiryDate(refreshToken);

    await UserSessionEntity.update(
        { refreshToken, expiresAt },
        { where: { id: sessionId } }
    );

    return refreshToken;
};

function getTokenExpiryDate(token: string): Date {
    const decoded = jwt.decode(token);

    if (!decoded || typeof decoded === 'string' || typeof decoded.exp !== 'number') {
        throw new Error('Generated token is missing exp claim');
    }

    return new Date(decoded.exp * 1000);
}
