import { Router } from 'express';
import { sendOTPController, verifyOTPController } from './otp.controller.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { sendOTPSchema, verifyOTPSchema } from './otp.validation.js';
import rateLimit from 'express-rate-limit';

const otpRouter = Router();

// Rate limiter for OTP endpoints
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many OTP requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 verification attempts per window
    message: 'Too many verification attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

otpRouter.post('/send', otpLimiter, validateRequest(sendOTPSchema), sendOTPController);
otpRouter.post('/verify', verifyLimiter, validateRequest(verifyOTPSchema), verifyOTPController);

export default otpRouter;
