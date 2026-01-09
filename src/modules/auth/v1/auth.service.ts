import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { comparePasswords, isStrongPassword } from '../../../utils/password.utils.js';
import { UserSessionEntity } from '../../user-session/v1/entity/user-session.entity.js';
import { IAuthToken } from '../../../utils/token.utils.js';
import { UserService } from '../../user/v1/user.service.js';
import { env } from 'process';
import crypto from 'crypto';
import { redis } from '../../../config/redis.js';
import { sendWhatsAppOtpTemplate } from '../../../config/whatsapp.client.js';


export class AuthService {
    static async login(provider: string, password: string): Promise<{ user: UserEntity; accessToken: IAuthToken; refreshToken: string }> {
        // Use the custom scope to include password
        const user = await UserEntity.scope('withPassword').findOne({ where: { provider } });
        if (!user) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        // Phone users must be verified
        if (isPhoneProvider(provider) && !user.isVerified) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'phone is not verified');
        }

        if (user.isBlocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
        }

        const isValidPassword = await comparePasswords(password, user.password);
        if (!isValidPassword) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        const userSession = await UserSessionEntity.create({ userId: user.id });

        const accessToken = user.generateAuthToken(userSession.id.toString());
        const refreshToken = await user.generateRefreshToken(userSession.id.toString());

        return { user, accessToken, refreshToken };
    }

    static async requestRegisterOtp(provider: string, langHeader: string): Promise<void> {
        const lang = resolveLang(langHeader);

        // If already exists, don't allow OTP for registration
        const existingUser = await UserService.getUserByProvider(provider);
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'Phone already registered');
        }

        await sendOtp({ type: 'register', provider, lang });
    }

    static async register(userData: Partial<UserEntity> & { otp: string }): Promise<UserEntity> {
        if (!userData.provider || !isPhoneProvider(userData.provider)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Provider must be a valid mobile number');
        }

        await verifyOtpOrThrow({ type: 'register', provider: userData.provider, otp: userData.otp });

        const existingUser = await UserService.getUserByProvider(userData.provider);
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this provider already exists');
        }

        // Create user ONLY after OTP verification
        const { otp: _otp, ...rest } = userData;
        return UserService.createUser({
            ...rest,
            isVerified: true,
            phone: userData.provider,
            phoneVerifiedAt: new Date(),
        } as Partial<UserEntity>);
    }

    static async requestForgotPasswordOtp(provider: string, langHeader: string): Promise<void> {
        const lang = resolveLang(langHeader);

        const user = await UserService.getUserByProvider(provider);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        await sendOtp({ type: 'forgot', provider, lang });
    }

    static async resetPasswordWithOtp(provider: string, otp: string, newPassword: string): Promise<void> {
        const user = await UserService.getUserByProvider(provider);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        if (user.isBlocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'User is blocked');
        }

        await verifyOtpOrThrow({ type: 'forgot', provider, otp });

        if (!isStrongPassword(newPassword)) {
            throw new HttpResponseError(
                StatusCodes.BAD_REQUEST,
                'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
            );
        }

        user.password = newPassword;
        user.isVerified = true;
        if (isPhoneProvider(provider)) {
            user.phone = provider;
            user.phoneVerifiedAt = user.phoneVerifiedAt ?? new Date();
        }
        await user.save();
    }

    static async refreshToken(refreshToken: string): Promise<{ accessToken: IAuthToken; newRefreshToken: string }> {
        const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_PRIVATE_KEY) as {
            _id: string;
            tokenId: string;
        };

        const session = await UserSessionEntity.findOne({
            where: { refreshToken },
        });

        if (!session) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
        }

        const user = await UserService.getUserById(decoded._id);
        const newAccessToken = user.generateAuthToken(session.id.toString());
        const newRefreshToken = await user.generateRefreshToken(session.id.toString());

        session.refreshToken = newRefreshToken;

        await session.save();

        return { accessToken: newAccessToken, newRefreshToken };
    }

    static async logout(refreshToken: string): Promise<void> {
        const session = await UserSessionEntity.findOne({ where: { refreshToken } });
        if (!session) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Session not found');
        }
        await session.destroy();
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        const user = await UserService.getUserById(userId, 'withPassword');
        const isValid = await comparePasswords(currentPassword, user.password!);

        if (!isValid) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Current password is incorrect');
        }

        if (!isStrongPassword(newPassword)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }

        user.password = newPassword;
        await user.save();
    }
}

type OtpType = 'register' | 'forgot';
type SupportedLang = 'en' | 'ar';

function isPhoneProvider(provider: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(provider);
}

function resolveLang(langHeader: string): SupportedLang {
    const value = (langHeader || '').toLowerCase();
    if (value.startsWith('en')) return 'en';
    if (value.startsWith('ar')) return 'ar';
    return 'ar';
}

function otpConfig() {
    const ttlSeconds = Number(process.env.OTP_TTL_SECONDS ?? 300);
    const cooldownSeconds = Number(process.env.OTP_COOLDOWN_SECONDS ?? 60);
    const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
    const secret = process.env.OTP_SECRET ?? process.env.JWT_PRIVATE_KEY ?? 'otp';
    return { ttlSeconds, cooldownSeconds, maxAttempts, secret };
}

function otpRedisKey(type: OtpType, provider: string): string {
    return `otp:${type}:${provider}`;
}

function otpCooldownKey(type: OtpType, provider: string): string {
    return `otp:${type}:${provider}:cooldown`;
}

function hashOtp(otp: string, provider: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(`${provider}:${otp}`).digest('hex');
}

function generateOtp(): string {
    const n = crypto.randomInt(0, 1_000_000);
    return String(n).padStart(6, '0');
}

async function sendOtp(params: { type: OtpType; provider: string; lang: SupportedLang }): Promise<void> {
    const { ttlSeconds, cooldownSeconds, secret } = otpConfig();
    const key = otpRedisKey(params.type, params.provider);
    const cooldown = otpCooldownKey(params.type, params.provider);

    const cooldownSet = await redis.set(cooldown, '1', 'EX', cooldownSeconds, 'NX');
    if (!cooldownSet) {
        throw new HttpResponseError(StatusCodes.TOO_MANY_REQUESTS, 'Please wait before requesting another code');
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp, params.provider, secret);

    await redis.hset(key, {
        otpHash,
        attempts: '0',
        createdAt: new Date().toISOString(),
    });
    await redis.expire(key, ttlSeconds);

    try {
        await sendWhatsAppOtpTemplate({ toE164: params.provider, otp, lang: params.lang });
    } catch (error) {
        // Ensure OTP isn't left active if send fails
        await redis.del(key);
        throw new HttpResponseError(StatusCodes.BAD_GATEWAY, 'Failed to send OTP');
    }
}

async function verifyOtpOrThrow(params: { type: OtpType; provider: string; otp: string }): Promise<void> {
    const { maxAttempts, secret } = otpConfig();
    const key = otpRedisKey(params.type, params.provider);
    const data = await redis.hgetall(key);

    if (!data || !data.otpHash) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Code expired');
    }

    const attempts = Number(data.attempts ?? '0');
    if (attempts >= maxAttempts) {
        await redis.del(key);
        throw new HttpResponseError(StatusCodes.TOO_MANY_REQUESTS, 'Too many attempts');
    }

    const expected = data.otpHash;
    const actual = hashOtp(params.otp, params.provider, secret);
    if (expected !== actual) {
        const newAttempts = await redis.hincrby(key, 'attempts', 1);
        if (newAttempts >= maxAttempts) {
            await redis.del(key);
            throw new HttpResponseError(StatusCodes.TOO_MANY_REQUESTS, 'Too many attempts');
        }
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid code');
    }

    await redis.del(key);
}