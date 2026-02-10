import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { OTPEntity } from './entity/otp.entity.js';
import { smsService } from '../../../services/sms/sms.service.js';
import { Op } from 'sequelize';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

export class OTPService {
    private generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendOTP(phone: string): Promise<void> {
        // Clean phone number
        const cleanPhone = phone.replace(/\s+/g, '');

        // Validate phone number format
        if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Invalid phone number format');
        }

        // Check if there's a recent OTP (rate limiting)
        const recentOTP = await OTPEntity.findOne({
            where: {
                phone: cleanPhone,
                createdAt: {
                    [Op.gte]: new Date(Date.now() - 60000), // Within last 1 minute
                },
            },
            order: [['createdAt', 'DESC']],
        });

        if (recentOTP) {
            throw new HttpResponseError(
                StatusCodes.TOO_MANY_REQUESTS,
                'Please wait before requesting a new OTP'
            );
        }

        // Invalidate all previous OTPs for this phone
        await OTPEntity.update(
            { isUsed: true },
            { where: { phone: cleanPhone, isUsed: false } }
        );

        // Generate and save new OTP
        const otp = this.generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

        await OTPEntity.create({
            phone: cleanPhone,
            otp,
            expiresAt,
            isUsed: false,
            attempts: 0,
        });

        console.log(`Generated OTP for ${cleanPhone}: ${otp} (expires at ${expiresAt.toISOString()})`);

        // Send OTP via SMS
        const sent = await smsService.sendOTP(cleanPhone, otp);

        if (!sent) {
            throw new HttpResponseError(
                StatusCodes.INTERNAL_SERVER_ERROR,
                'Failed to send OTP. Please try again.'
            );
        }
    }

    async verifyOTP(phone: string, otp: string): Promise<boolean> {
        const cleanPhone = phone.replace(/\s+/g, '');

        const otpRecord = await OTPEntity.findOne({
            where: {
                phone: cleanPhone,
                otp,
                isUsed: false,
            },
            order: [['createdAt', 'DESC']],
        });

        if (!otpRecord) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid OTP');
        }

        // Increment attempts
        otpRecord.attempts += 1;
        await otpRecord.save();

        // Check if exceeded max attempts
        if (otpRecord.attempts > MAX_OTP_ATTEMPTS) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            throw new HttpResponseError(
                StatusCodes.UNAUTHORIZED,
                'Maximum OTP attempts exceeded. Please request a new code.'
            );
        }

        // Check if expired
        if (new Date() > otpRecord.expiresAt) {
            otpRecord.isUsed = true;
            await otpRecord.save();
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'OTP has expired');
        }

        // Mark as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        return true;
    }

    async cleanupExpiredOTPs(): Promise<void> {
        // Delete OTPs older than 24 hours
        await OTPEntity.destroy({
            where: {
                createdAt: {
                    [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            },
        });
    }
}

export const otpService = new OTPService();
