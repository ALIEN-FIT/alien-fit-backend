import express from 'express';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { auth } from '../../../middleware/authorization.middleware.js';
import {
    loginController,
    registerController,
    refreshTokenController,
    logoutController,
    changePasswordController,
    getMeController,
    updateMeController,
    deleteMeController,
    googleWebAuth,
    googleMobileAuthController,
    googleAuthCallback,
    sendOTPForAuthController,
    loginWithOTPController,
    registerWithOTPController,
    forgotPasswordController,
    resetPasswordController
} from './auth.controller.js';
import {
    loginSchema,
    registerSchema,
    refreshTokenSchema,
    logoutSchema,
    changePasswordSchema,
    updateMeSchema,
    sendOTPForAuthSchema,
    loginWithOTPSchema,
    registerWithOTPSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} from './auth.validation.js';
import rateLimit from 'express-rate-limit';


export const authRouterV1 = express.Router();

// Rate limiters for OTP endpoints
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many OTP requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Public routes - OTP-based authentication
authRouterV1.post('/otp/send', otpLimiter, validateRequest(sendOTPForAuthSchema), sendOTPForAuthController);
authRouterV1.post('/otp/login', authLimiter, validateRequest(loginWithOTPSchema), loginWithOTPController);
authRouterV1.post('/otp/register', authLimiter, validateRequest(registerWithOTPSchema), registerWithOTPController);

// Forgot password flow
authRouterV1.post('/forgot-password', otpLimiter, validateRequest(forgotPasswordSchema), forgotPasswordController);
authRouterV1.post('/reset-password', authLimiter, validateRequest(resetPasswordSchema), resetPasswordController);

// Legacy routes (kept for backward compatibility)
authRouterV1.post('/login', validateRequest(loginSchema), loginController);
authRouterV1.post('/register', validateRequest(registerSchema), registerController);
authRouterV1.post('/refresh-token', validateRequest(refreshTokenSchema), refreshTokenController);
authRouterV1.post('/logout', validateRequest(logoutSchema), logoutController);
authRouterV1.get('/google', googleWebAuth);

authRouterV1.get('/google/callback',
    googleAuthCallback
);

authRouterV1.post('/google/mobile', googleMobileAuthController);


// Authenticated routes
authRouterV1.use(auth);
authRouterV1.patch('/password', validateRequest(changePasswordSchema), changePasswordController);
authRouterV1.get('/me', getMeController);
authRouterV1.patch('/me', validateRequest(updateMeSchema), updateMeController);
authRouterV1.delete('/me', deleteMeController);