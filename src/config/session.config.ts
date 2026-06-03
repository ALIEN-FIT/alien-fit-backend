import type { SignOptions } from 'jsonwebtoken';
import { env } from './env.js';

export const JWT_ACCESS_TOKEN_TTL = env.JWT_ACCESS_TOKEN_TTL as NonNullable<SignOptions['expiresIn']>;
export const JWT_REFRESH_TOKEN_TTL = env.JWT_REFRESH_TOKEN_TTL as NonNullable<SignOptions['expiresIn']>;
export const FCM_TOKEN_MAX_AGE_DAYS = env.FCM_TOKEN_MAX_AGE_DAYS;
export const FCM_MESSAGE_TTL_SECONDS = env.FCM_MESSAGE_TTL_SECONDS;
export const FCM_MESSAGE_TTL_MS = FCM_MESSAGE_TTL_SECONDS * 1000;

export function getFcmTokenFreshnessCutoff(now = new Date()): Date {
    return new Date(now.getTime() - FCM_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
}

export function getApnsExpiration(now = new Date()): string {
    return String(Math.floor(now.getTime() / 1000) + FCM_MESSAGE_TTL_SECONDS);
}

export function isExpiredAt(expiresAt?: Date | null, now = new Date()): boolean {
    return Boolean(expiresAt && expiresAt.getTime() < now.getTime());
}
