import crypto from 'crypto';

export type SignedState<T extends object> = {
    payload: T;
    signature: string;
    state: string;
};

function base64UrlEncode(input: string): string {
    // Node >= 16 supports base64url, but keep compatible via replace.
    return Buffer.from(input, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function sign(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function createSignedState<T extends object>(payload: T, secret: string): SignedState<T> {
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(encodedPayload, secret);
    return {
        payload,
        signature,
        state: `${encodedPayload}.${signature}`,
    };
}

export function verifySignedState<T extends object>(state: string, secret: string): T {
    const [encodedPayload, signature] = state.split('.', 2);
    if (!encodedPayload || !signature) {
        throw new Error('Invalid state format');
    }

    const expected = sign(encodedPayload, secret);
    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) {
        throw new Error('Invalid state signature');
    }

    const raw = base64UrlDecode(encodedPayload);
    return JSON.parse(raw) as T;
}
