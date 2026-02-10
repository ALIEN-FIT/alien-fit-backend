import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { otpService } from './otp.service.js';

export async function sendOTPController(req: Request, res: Response): Promise<void> {
    const { phone } = req.body;

    await otpService.sendOTP(phone);

    res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'OTP sent successfully',
    });
}

export async function verifyOTPController(req: Request, res: Response): Promise<void> {
    const { phone, otp } = req.body;

    const isValid = await otpService.verifyOTP(phone, otp);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { isValid },
    });
}
