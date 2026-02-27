import axios from 'axios';
import { errorLogger } from '../../config/logger.config.js';

export interface SMSProvider {
    send(phone: string, message: string): Promise<boolean>;
}

// Egyptian SMS Provider (WhySMS)
class WhySMSProvider implements SMSProvider {
    private readonly apiUrl = 'https://bulk.whysms.com/api/v3/sms/send';
    private readonly apiKey: string;
    private readonly senderId: string;

    constructor(apiKey: string, senderId: string) {
        this.apiKey = apiKey;
        this.senderId = senderId;
    }

    async send(phone: string, message: string): Promise<boolean> {
        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    recipient: phone,
                    sender_id: this.senderId,
                    type: 'plain',
                    message,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            return response.status === 200;
        } catch (error) {
            errorLogger.error('WhySMS send failed:', error);
            return false;
        }
    }
}

// Non-Egyptian SMS Provider (Noti-Fire)
class NotiFireProvider implements SMSProvider {
    private readonly apiUrl = 'https://www.noti-fire.com/api/send/message';
    private readonly deviceId: string;

    constructor(deviceId: string) {
        this.deviceId = deviceId;
    }

    async send(phone: string, message: string): Promise<boolean> {
        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    device_id: this.deviceId,
                    to: phone,
                    message,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            return response.status === 200;
        } catch (error) {
            errorLogger.error('Noti-Fire send failed:', error);
            return false;
        }
    }
}

export class SMSService {
    private egyptianProvider: WhySMSProvider;
    private internationalProvider: NotiFireProvider;

    constructor() {
        this.egyptianProvider = new WhySMSProvider(
            process.env.WHYSMS_API_KEY || '',
            process.env.WHYSMS_SENDER_ID || 'AlienFit'
        );
        this.internationalProvider = new NotiFireProvider(
            process.env.NOTIFIRE_DEVICE_ID || ''
        );
    }

    private isEgyptianNumber(phone: string): boolean {
        // Egyptian numbers start with +20 or 20
        const cleanPhone = phone.replace(/\s+/g, '');
        return cleanPhone.startsWith('+20') || cleanPhone.startsWith('20');
    }

    async sendSMS(phone: string, message: string): Promise<boolean> {
        const provider = this.isEgyptianNumber(phone)
            ? this.egyptianProvider
            : this.internationalProvider;

        return provider.send(phone, message);
    }

    async sendOTP(phone: string, otp: string): Promise<boolean> {
        const message = `Use ${otp} for the AlienFit App. Valid for 10 minutes.`;
        return this.sendSMS(phone, message);
    }
}

export const smsService = new SMSService();
