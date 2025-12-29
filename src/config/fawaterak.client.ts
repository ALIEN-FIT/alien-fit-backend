import axios from 'axios';
import { env } from './env.js';

function getFawaterakBaseUrl(): string {
    // Defaults to staging if not provided
    return env.FAWATERAK_BASE_URL ?? 'https://staging.fawaterk.com';
}

function requireFawaterakApiKey(): string {
    const key = env.FAWATERAK_API_KEY;
    if (!key) {
        throw new Error('FAWATERAK_API_KEY is not configured');
    }
    return key;
}

export function createFawaterakHttpClient() {
    const apiKey = requireFawaterakApiKey();

    return axios.create({
        baseURL: getFawaterakBaseUrl(),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30_000,
    });
}

export function getFawaterakApiKeyForWebhookVerification(): string {
    return requireFawaterakApiKey();
}
