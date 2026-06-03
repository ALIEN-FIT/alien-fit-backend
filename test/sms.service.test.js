import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('SMSService', () => {
    it('routes Egyptian numbers to WhySMS when SMS_EGYPT_PROVIDER=whysms and international numbers to Noti-Fire', async () => {
        const { SMSService } = await loadSmsModule();
        const calls = [];
        const service = new SMSService({
            config: {
                smsEgyptProvider: 'whysms',
                whySmsApiKey: 'whysms-key',
                whySmsSenderId: 'AlienFit',
                notiFireDeviceId: 'noti-fire-device',
            },
            post: async (url, data, config) => {
                calls.push({ url, data, config });
                return { status: 200 };
            },
        });

        await service.sendSMS('+201234567890', 'Egypt OTP');
        await service.sendSMS('+15551234567', 'International OTP');

        assert.equal(calls[0].url, 'https://bulk.whysms.com/api/v3/sms/send');
        assert.equal(calls[1].url, 'https://www.noti-fire.com/api/send/message');
    });

    it('routes Egyptian numbers to Torvochat when SMS_EGYPT_PROVIDER=torvochat and international numbers to Noti-Fire', async () => {
        const { SMSService } = await loadSmsModule();
        const calls = [];
        const service = new SMSService({
            config: {
                smsEgyptProvider: 'torvochat',
                torvochatApiKey: 'torvo-key',
                torvochatSenderId: 'TORVOSMS',
                notiFireDeviceId: 'noti-fire-device',
            },
            post: async (url, data, config) => {
                calls.push({ url, data, config });
                return { status: 202 };
            },
        });

        await service.sendSMS('+201234567890', 'Egypt OTP');
        await service.sendSMS('+15551234567', 'International OTP');

        assert.equal(calls[0].url, 'https://smsapi.torvochat.com/sms/send');
        assert.equal(calls[1].url, 'https://www.noti-fire.com/api/send/message');
    });

    it('shapes Torvochat requests with default sender ID and normalizes 20-prefixed Egyptian numbers', async () => {
        const { SMSService } = await loadSmsModule();
        const calls = [];
        const service = new SMSService({
            config: {
                smsEgyptProvider: 'torvochat',
                torvochatApiKey: 'torvo-key',
                notiFireDeviceId: 'noti-fire-device',
            },
            post: async (url, data, config) => {
                calls.push({ url, data, config });
                return { status: 204 };
            },
        });

        const sent = await service.sendSMS('201234567890', 'Test message');

        assert.equal(sent, true);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://smsapi.torvochat.com/sms/send');
        assert.deepEqual(calls[0].data, {
            countryCode: '20',
            recipients: ['+201234567890'],
            message: 'Test message',
            senderId: 'TORVOSMS',
        });
        assert.deepEqual(calls[0].config?.headers, {
            'Content-Type': 'application/json',
            'x-api-key': 'torvo-key',
        });
    });

    it('preserves +20 Torvochat recipients and uses the configured sender ID', async () => {
        const { SMSService } = await loadSmsModule();
        const calls = [];
        const service = new SMSService({
            config: {
                smsEgyptProvider: 'torvochat',
                torvochatApiKey: 'torvo-key',
                torvochatSenderId: 'AlienFit',
                notiFireDeviceId: 'noti-fire-device',
            },
            post: async (url, data, config) => {
                calls.push({ url, data, config });
                return { status: 200 };
            },
        });

        await service.sendSMS('+201234567890', 'Preserve plus');

        assert.deepEqual(calls[0].data, {
            countryCode: '20',
            recipients: ['+201234567890'],
            message: 'Preserve plus',
            senderId: 'AlienFit',
        });
    });

    it('keeps OTP message content unchanged while delegating through sendSMS', async () => {
        const { SMSService } = await loadSmsModule();
        const egyptianProvider = new FakeProvider();
        const internationalProvider = new FakeProvider();
        const service = new SMSService({
            config: {
                smsEgyptProvider: 'whysms',
            },
            providers: {
                egyptianProvider,
                internationalProvider,
            },
        });

        const sent = await service.sendOTP('+201234567890', '123456');

        assert.equal(sent, true);
        assert.deepEqual(egyptianProvider.calls, [{
            phone: '+201234567890',
            message: 'Use 123456 for the AlienFit App. Valid for 10 minutes.',
        }]);
        assert.deepEqual(internationalProvider.calls, []);
    });
});

describe('env SMS validation', () => {
    it('fails validation when SMS_EGYPT_PROVIDER=torvochat without TORVOCHAT_API_KEY', async () => {
        const { parseEnv } = await loadEnvModule();

        assert.throws(() => parseEnv({
            ...buildValidEnv(),
            SMS_EGYPT_PROVIDER: 'torvochat',
            TORVOCHAT_API_KEY: undefined,
        }), /TORVOCHAT_API_KEY is required when SMS_EGYPT_PROVIDER=torvochat/);
    });

    it('fails validation when SMS_EGYPT_PROVIDER=whysms without WHYSMS_API_KEY', async () => {
        const { parseEnv } = await loadEnvModule();

        assert.throws(() => parseEnv({
            ...buildValidEnv(),
            SMS_EGYPT_PROVIDER: 'whysms',
            WHYSMS_API_KEY: undefined,
        }), /WHYSMS_API_KEY is required when SMS_EGYPT_PROVIDER=whysms/);
    });
});

class FakeProvider {
    constructor() {
        this.calls = [];
    }

    async send(phone, message) {
        this.calls.push({ phone, message });
        return true;
    }
}

async function loadSmsModule() {
    return withProcessEnv(buildValidEnv(), async () => importFresh('../src/services/sms/sms.service.ts'));
}

async function loadEnvModule() {
    return withProcessEnv(buildValidEnv(), async () => importFresh('../src/config/env.ts'));
}

async function withProcessEnv(nextEnv, callback) {
    const originalEnv = process.env;
    process.env = { ...nextEnv };

    try {
        return await callback();
    } finally {
        process.env = originalEnv;
    }
}

async function importFresh(specifier) {
    const url = new URL(specifier, import.meta.url);
    url.searchParams.set('test', `${Date.now()}-${Math.random()}`);
    return import(url.href);
}

function buildValidEnv() {
    return {
        NODE_ENV: 'test',
        PORT: '3000',
        DB_URI: 'sqlite::memory:',
        REDIS_URL: 'redis://localhost:6379/0',
        APP_NAME: 'alien_fit',
        APP_VERSION: '1.0.0',
        SUPER_ADMIN_PROVIDER: 'admin@example.com',
        SUPER_ADMIN_PASSWORD: 'password',
        JWT_PRIVATE_KEY: 'jwt-secret',
        REFRESH_TOKEN_PRIVATE_KEY: 'refresh-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_CALLBACK_URL: 'https://example.com/google/callback',
        YOUTUBE_CLIENT_ID: 'youtube-client-id',
        YOUTUBE_CLIENT_SECRET: 'youtube-client-secret',
        YOUTUBE_REDIRECT_URI: 'https://example.com/youtube/callback',
        MAIL_HOST: 'smtp.example.com',
        MAIL_PORT: '587',
        MAIL_USER: 'mailer',
        MAIL_PASS: 'mailer-password',
        MAIL_SECURE: 'true',
        STORAGE_TYPE: 'local',
        AWS_REGION: 'us-east-1',
        S3_BUCKET: 'bucket',
        S3_PUBLIC_URL: 'https://cdn.example.com',
        APP_URL: 'https://example.com',
        CLOUDFLARE_BUCKET_NAME: 'cloudflare-bucket',
        CLOUDFLARE_PUBLIC_DOMAIN: 'https://public.example.com',
        CLOUDFLARE_SECRET_ACCESS_KEY: 'cloudflare-secret',
        CLOUDFLARE_ACCOUNT_ID: 'cloudflare-account',
        CLOUDFLARE_ACCESS_KEY_ID: 'cloudflare-access',
        SMS_EGYPT_PROVIDER: 'whysms',
        WHYSMS_API_KEY: 'whysms-key',
        WHYSMS_SENDER_ID: 'AlienFit',
        TORVOCHAT_API_KEY: 'torvo-key',
        TORVOCHAT_SENDER_ID: 'TORVOSMS',
        NOTIFIRE_DEVICE_ID: 'noti-fire-device',
        DEFAULT_FREE_SUBSCRIPTION_DAYS: '7',
        SOCKET_CALL_DEBUG: 'true',
        FAWATERAK_API_KEY: 'fawaterak-key',
        FAWATERAK_BASE_URL: 'https://staging.fawaterk.com',
        calorieninjas_api_key: 'calorie-key',
    };
}
