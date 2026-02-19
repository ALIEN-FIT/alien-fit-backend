import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { UserService } from '../../user/v1/user.service.js';
import passport from 'passport';
import { HttpResponseError } from '../../../utils/appError.js';
import { googleClient } from '../../../config/google-client.js';
import { UserSessionEntity } from '../../user-session/v1/entity/user-session.entity.js';
import { errorLogger } from '../../../config/logger.config.js';
import { SubscriptionService } from '../../subscription/v1/subscription.service.js';
import { UserProfileService } from '../../user-profile/v1/user-profile.service.js';
import { UserProfileEntity } from '../../user-profile/v1/model/user-profile.model.js';
import { otpService } from '../../otp/v1/otp.service.js';

// OTP-based authentication
export async function sendOTPForAuthController(req: Request, res: Response): Promise<void> {
    const { phone } = req.body;
    await otpService.sendOTP(phone);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'OTP sent successfully',
    });
}

export async function loginWithOTPController(req: Request, res: Response): Promise<void> {
    const { phone, otp } = req.body;

    const { user, accessToken, refreshToken } = await AuthService.loginWithOTP(phone, otp);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            user: await UserService.getUserById(user.id.toString()),
            accessToken,
            refreshToken,
        },
    });
}

export async function registerWithOTPController(req: Request, res: Response): Promise<void> {
    const { phone, otp, name, ...userData } = req.body;

    const { user, accessToken, refreshToken } = await AuthService.registerWithOTP(phone, otp, {
        name,
        ...userData,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: {
            user: await UserService.getUserById(user.id.toString()),
            accessToken,
            refreshToken,
        },
    });
}

// Forgot password flow
export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
    const { phone } = req.body;
    await AuthService.forgotPasswordSendOTP(phone);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'OTP sent to your phone',
    });
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
    const { phone, otp, newPassword } = req.body;
    await AuthService.resetPasswordWithOTP(phone, otp, newPassword);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'Password reset successfully',
    });
}

// Legacy authentication (kept for backward compatibility)
export async function loginController(req: Request, res: Response): Promise<void> {
    const { provider, password } = req.body;

    const { user, accessToken, refreshToken } = await AuthService.login(provider, password);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            user: await UserService.getUserById(user.id.toString()),
            accessToken,
            refreshToken,
        }
    });
}

export async function registerController(req: Request, res: Response): Promise<void> {
    const user = await AuthService.register(req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { user }
    });
}

export async function refreshTokenController(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const { accessToken, newRefreshToken } = await AuthService.refreshToken(refreshToken);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            accessToken,
            refreshToken: newRefreshToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        }
    });
}

export const googleWebAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

export const googleAuthCallback = [
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req: Request, res: Response) => {
        const session = await UserSessionEntity.create({
            userId: req.user.id
        });

        const [accessToken, refreshToken] = await Promise.all([
            req.user.generateAuthToken(session.id.toString()),
            req.user.generateRefreshToken(session.id.toString())
        ]);

        res.json({
            status: 'success',
            data: {
                accessToken,
                refreshToken,
                user: req.user.toJSON()
            }
        });
    }
];


export async function googleMobileAuthController(req: Request, res: Response): Promise<void> {
    try {
        const { idToken } = req.body;

        // Verify Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.MOBILE_GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const provider = payload.email;
        const name = payload.name;

        // Find or create user (similar to your existing Google strategy)
        let user = await UserService.getUserByProvider(provider);

        if (!user) {
            user = await UserService.createUser({
                provider,
                googleId: payload.sub,
                name,
                isVerified: true,
                password: undefined,
            });

        }

        const session = await UserSessionEntity.create({
            userId: user.id
        });

        // Generate tokens
        const [accessToken, refreshToken] = await Promise.all([
            user.generateAuthToken(session.id.toString()),
            user.generateRefreshToken(session.id.toString()),
        ]);

        res.status(StatusCodes.OK).json({
            status: 'success',
            data: {
                user,
                accessToken,
                refreshToken,
            }
        });
    } catch (error) {
        errorLogger.error('Google authentication failed', error);
        throw new HttpResponseError(
            StatusCodes.UNAUTHORIZED,
            'Google authentication failed'
        );

    }
}

export async function logoutController(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    await AuthService.logout(refreshToken);
    res.status(StatusCodes.OK).json({ status: 'success' });
}

export async function changePasswordController(req: Request, res: Response): Promise<void> {
    const userId = req.user.id.toString();
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(userId, currentPassword, newPassword);
    res.status(StatusCodes.OK).json({ status: 'success' });
}

export async function getMeController(req: Request, res: Response): Promise<void> {
    const user = req.user as UserEntity;
    const userId = user.id.toString();

    const [subscriptionStatus, profile] = await Promise.all([
        SubscriptionService.getStatus(userId),
        getUserProfileOrNull(userId),
    ]);

    const warningThresholdDays = 3;
    const remainingDays = subscriptionStatus.subscription?.endDate
        ? (subscriptionStatus.subscription.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        : null;
    const warning = remainingDays !== null && remainingDays < warningThresholdDays;

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            user: user.toJSON(),
            subscription: {
                isSubscribed: subscriptionStatus.isSubscribed,
                isFreeTier: subscriptionStatus.isFreeTier,
                planType: subscriptionStatus.planType,
                capabilities: subscriptionStatus.capabilities,
                profileUpdateRequired: subscriptionStatus.profileUpdateRequired,
                warning,
                warningThresholdDays,
                startDate: subscriptionStatus.subscription?.startDate ?? null,
                endDate: subscriptionStatus.subscription?.endDate ?? null,
            },
            profile,
        },
    });
}

async function getUserProfileOrNull(userId: string): Promise<UserProfileEntity | null> {
    try {
        return await UserProfileService.getUserProfile(userId);
    } catch (error) {
        if (error instanceof HttpResponseError && error.statusCode === StatusCodes.NOT_FOUND) {
            return null;
        }
        throw error;
    }
}

export async function updateMeController(req: Request, res: Response): Promise<void> {
    const userId = (req.user as UserEntity).id.toString();
    // Prevent updating password via this route
    if (req.body.password) {
        delete req.body.password;
    }
    const user = await UserService.updateUser(userId, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { user }
    });
}

export async function deleteMeController(req: Request, res: Response): Promise<void> {
    const userId = (req.user as UserEntity).id.toString();
    await UserService.deleteUser(userId);
    res.status(StatusCodes.OK).json({ status: 'success' });
}