import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { comparePasswords, isStrongPassword } from '../../../utils/password.utils.js';
import { UserSessionEntity } from '../../user-session/v1/entity/user-session.entity.js';
import { IAuthToken } from '../../../utils/token.utils.js';
import { UserService } from '../../user/v1/user.service.js';
import { env } from 'process';
import { otpService } from '../../otp/v1/otp.service.js';
import { SubscriptionService } from '../../subscription/v1/subscription.service.js';
import { addDays } from '../../../utils/date.utils.js';

const DEFAULT_FREE_DAYS = parseInt(process.env.DEFAULT_FREE_SUBSCRIPTION_DAYS || '7', 10);

export class AuthService {
    // Phone + OTP based login/registration
    static async loginWithOTP(phone: string, otp: string): Promise<{ user: UserEntity; accessToken: IAuthToken; refreshToken: string; isNewUser: boolean }> {
        // Verify OTP
        await otpService.verifyOTP(phone, otp);

        // Check if user exists
        let user = await UserEntity.findOne({ where: { provider: phone } });
        let isNewUser = false;

        if (!user) {
            // This is registration flow - OTP already verified
            throw new HttpResponseError(
                StatusCodes.BAD_REQUEST,
                'User not found. Please complete registration with name and other details.'
            );
        }

        if (user.isBlocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
        }

        // Mark user as verified
        if (!user.isVerified) {
            user.isVerified = true;
            await user.save();
        }

        const userSession = await UserSessionEntity.create({ userId: user.id });

        const accessToken = user.generateAuthToken(userSession.id.toString());
        const refreshToken = await user.generateRefreshToken(userSession.id.toString());

        return { user, accessToken, refreshToken, isNewUser };
    }

    // Register with phone, OTP and user data
    static async registerWithOTP(phone: string, otp: string, userData: Partial<UserEntity>): Promise<{ user: UserEntity; accessToken: IAuthToken; refreshToken: string }> {
        // Verify OTP
        await otpService.verifyOTP(phone, otp);

        // Check if user already exists
        const existingUser = await UserEntity.findOne({ where: { provider: phone } });
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone number already exists');
        }

        // Validate password strength if provided
        if (userData.password && !isStrongPassword(userData.password)) {
            throw new HttpResponseError(
                StatusCodes.BAD_REQUEST,
                'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
            );
        }

        // Create user
        const user = await UserService.createUser({
            ...userData,
            provider: phone,
            isVerified: true,
            password: userData.password || undefined, // Use provided password or undefined for phone-only auth
        });

        // Create free subscription
        const freeDays = userData.freeDays || DEFAULT_FREE_DAYS;
        await SubscriptionService.activateFreeSubscription(user.id.toString(), freeDays);

        // Create session
        const userSession = await UserSessionEntity.create({ userId: user.id });

        const accessToken = user.generateAuthToken(userSession.id.toString());
        const refreshToken = await user.generateRefreshToken(userSession.id.toString());

        return { user, accessToken, refreshToken };
    }

    // Legacy login with email/phone + password (kept for backward compatibility)
    static async login(provider: string, password: string): Promise<{ user: UserEntity; accessToken: IAuthToken; refreshToken: string }> {
        // Use the custom scope to include password
        const user = await UserEntity.scope('withPassword').findOne({ where: { provider } });
        if (!user) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        if (user.isBlocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
        }

        if (!user.password) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Please login with OTP');
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

    // Legacy register (kept for backward compatibility)
    static async register(userData: Partial<UserEntity>): Promise<UserEntity> {
        const existingUser = await UserService.getUserByProvider(userData.provider);
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this provider already exists');
        }

        return UserService.createUser(userData);
    }

    // Forgot password - send OTP
    static async forgotPasswordSendOTP(phone: string): Promise<void> {
        // Verify user exists
        const user = await UserEntity.findOne({ where: { provider: phone } });
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        // Send OTP
        await otpService.sendOTP(phone);
    }

    // Reset password with OTP
    static async resetPasswordWithOTP(phone: string, otp: string, newPassword: string): Promise<void> {
        // Verify OTP
        await otpService.verifyOTP(phone, otp);

        // Find user
        const user = await UserEntity.scope('withPassword').findOne({ where: { provider: phone } });
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }

        if (!isStrongPassword(newPassword)) {
            throw new HttpResponseError(
                StatusCodes.BAD_REQUEST,
                'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character'
            );
        }

        user.password = newPassword;
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

        if (!user.password) {
            throw new HttpResponseError(
                StatusCodes.BAD_REQUEST,
                'Your account uses phone-based authentication. Password change is not available.'
            );
        }

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