import axios from 'axios';
import { env, type Env } from '../../config/env.js';
import { errorLogger } from '../../config/logger.config.js';

export interface SMSProvider {
    send(phone: string, message: string): Promise<boolean>;
}

type HttpPost = (
    url: string,
    data?: unknown,
    config?: {
        headers?: Record<string, string>;
        timeout?: number;
    }
) => Promise<{ status: number }>;

export interface SMSServiceConfig {
    smsEgyptProvider: Env['SMS_EGYPT_PROVIDER'];
    whySmsApiKey?: string;
    whySmsSenderId?: string;
    torvochatApiKey?: string;
    torvochatSenderId?: string;
    notiFireDeviceId?: string;
}

export interface SMSServiceOptions {
    config?: Partial<SMSServiceConfig>;
    providers?: {
        egyptianProvider?: SMSProvider;
        internationalProvider?: SMSProvider;
    };
    post?: HttpPost;
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_WHYSMS_SENDER_ID = 'AlienFit';
const DEFAULT_TORVOCHAT_SENDER_ID = 'TORVOSMS';
const axiosPost: HttpPost = axios.post.bind(axios);

function isSuccessStatus(status: number): boolean {
    return status >= 200 && status < 300;
}

function formatProviderError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function buildDefaultSMSConfig(): SMSServiceConfig {
    return {
        smsEgyptProvider: env.SMS_EGYPT_PROVIDER,
        whySmsApiKey: env.WHYSMS_API_KEY,
        whySmsSenderId: env.WHYSMS_SENDER_ID ?? DEFAULT_WHYSMS_SENDER_ID,
        torvochatApiKey: env.TORVOCHAT_API_KEY,
        torvochatSenderId: env.TORVOCHAT_SENDER_ID ?? DEFAULT_TORVOCHAT_SENDER_ID,
        notiFireDeviceId: env.NOTIFIRE_DEVICE_ID,
    };
}

// Egyptian SMS Provider (WhySMS)
export class WhySMSProvider implements SMSProvider {
    private readonly apiUrl = 'https://bulk.whysms.com/api/v3/sms/send';

    constructor(
        private readonly apiKey: string,
        private readonly senderId: string,
        private readonly post: HttpPost = axiosPost,
    ) { }

    async send(phone: string, message: string): Promise<boolean> {
        console.log(`Sending SMS via WhySMS to ${phone}: ${message}`);
        try {
            const response = await this.post(
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
                    timeout: DEFAULT_TIMEOUT_MS,
                }
            );

            return isSuccessStatus(response.status);
        } catch (error) {
            errorLogger.error('WhySMS send failed', {
                provider: 'whysms',
                phone,
                error: formatProviderError(error),
            });
            return false;
        }
    }
}

// Egyptian SMS Provider (Torvochat)
export class TorvochatProvider implements SMSProvider {
    private readonly apiUrl = 'https://smsapi.torvochat.com/sms/send';

    constructor(
        private readonly apiKey: string,
        private readonly senderId: string,
        private readonly post: HttpPost = axiosPost,
    ) { }

    async send(phone: string, message: string): Promise<boolean> {
        console.log(`Sending SMS via Torvochat to ${phone}: ${message}`);
        const normalizedPhone = this.normalizePhone(phone);

        try {
            const response = await this.post(
                this.apiUrl,
                {
                    countryCode: '20',
                    recipients: [normalizedPhone],
                    message,
                    senderId: this.senderId,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    timeout: DEFAULT_TIMEOUT_MS,
                }
            );

            return isSuccessStatus(response.status);
        } catch (error) {
            errorLogger.error('Torvochat send failed', {
                provider: 'torvochat',
                phone: normalizedPhone,
                error: formatProviderError(error),
            });
            return false;
        }
    }

    private normalizePhone(phone: string): string {
        const cleanPhone = phone.replace(/\s+/g, '');

        if (cleanPhone.startsWith('+20')) {
            return cleanPhone;
        }

        if (cleanPhone.startsWith('20')) {
            return `+${cleanPhone}`;
        }

        return cleanPhone;
    }
}

// Non-Egyptian SMS Provider (Noti-Fire)
export class NotiFireProvider implements SMSProvider {
    private readonly apiUrl = 'https://www.noti-fire.com/api/send/message';

    constructor(
        private readonly deviceId: string,
        private readonly post: HttpPost = axiosPost,
    ) { }

    async send(phone: string, message: string): Promise<boolean> {
        try {
            const response = await this.post(
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
                    timeout: DEFAULT_TIMEOUT_MS,
                }
            );

            return isSuccessStatus(response.status);
        } catch (error) {
            errorLogger.error('Noti-Fire send failed', {
                provider: 'noti-fire',
                phone,
                error: formatProviderError(error),
            });
            return false;
        }
    }
}

export class SMSService {
    private readonly egyptianProvider: SMSProvider;
    private readonly internationalProvider: SMSProvider;

    constructor(options: SMSServiceOptions = {}) {
        const config = {
            ...buildDefaultSMSConfig(),
            ...options.config,
        };

        this.egyptianProvider = options.providers?.egyptianProvider ?? this.buildEgyptianProvider(config, options.post);
        this.internationalProvider = options.providers?.internationalProvider
            ?? new NotiFireProvider(config.notiFireDeviceId ?? '', options.post);
    }

    private buildEgyptianProvider(config: SMSServiceConfig, post?: HttpPost): SMSProvider {
        if (config.smsEgyptProvider === 'torvochat') {
            return new TorvochatProvider(
                config.torvochatApiKey ?? '',
                config.torvochatSenderId ?? DEFAULT_TORVOCHAT_SENDER_ID,
                post
            );
        }

        return new WhySMSProvider(
            config.whySmsApiKey ?? '',
            config.whySmsSenderId ?? DEFAULT_WHYSMS_SENDER_ID,
            post
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
