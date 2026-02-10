import cron from 'node-cron';
import { otpService } from '../modules/otp/v1/otp.service.js';
import { errorLogger, infoLogger } from '../config/logger.config.js';

/**
 * Cleanup expired OTPs daily at 3 AM
 * This prevents the OTP table from growing indefinitely
 */
export function initializeOTPCleanupJob() {
    // Run daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
        try {
            infoLogger.info('Starting OTP cleanup job...');
            await otpService.cleanupExpiredOTPs();
            infoLogger.info('OTP cleanup job completed successfully');
        } catch (error) {
            errorLogger.error('OTP cleanup job failed:', error);
        }
    });

    infoLogger.info('OTP cleanup cron job initialized (runs daily at 3 AM)');
}
