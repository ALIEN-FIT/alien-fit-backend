import { google } from 'googleapis';
import { env } from './env.js';
import type { Credentials } from 'google-auth-library';
import { hasYouTubeStoredTokens, readYouTubeStoredTokens, writeYouTubeStoredTokens } from './youtube-token-store.js';

export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

export function getYouTubeOAuthClient() {
    const oAuth2Client = new google.auth.OAuth2(
        env.YOUTUBE_CLIENT_ID,
        env.YOUTUBE_CLIENT_SECRET,
        env.YOUTUBE_REDIRECT_URI,
    );

    const storedTokens = readYouTubeStoredTokens();
    const refreshToken = env.YOUTUBE_REFRESH_TOKEN;

    if (storedTokens) {
        oAuth2Client.setCredentials(storedTokens);
    } else if (refreshToken) {
        oAuth2Client.setCredentials({ refresh_token: refreshToken });
    }

    return oAuth2Client;
}

export function getYouTubeClient() {
    return google.youtube({ version: 'v3', auth: getYouTubeOAuthClient() });
}

export function hasYouTubeAuthConfigured(): boolean {
    return Boolean(env.YOUTUBE_REFRESH_TOKEN) || hasYouTubeStoredTokens();
}

export function generateYouTubeAuthUrl(state: string) {
    const oAuth2Client = getYouTubeOAuthClient();
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: YOUTUBE_SCOPES,
        state,
    });
}

export async function exchangeYouTubeCodeForTokens(code: string): Promise<Credentials> {
    const oAuth2Client = getYouTubeOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);

    // Google may omit refresh_token on subsequent authorizations.
    const existing = readYouTubeStoredTokens();
    const merged: Credentials = {
        ...existing,
        ...tokens,
        refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? env.YOUTUBE_REFRESH_TOKEN,
    };

    if (!merged.refresh_token) {
        throw new Error('YouTube OAuth did not return a refresh token. Use prompt=consent and access_type=offline.');
    }

    await writeYouTubeStoredTokens(merged);
    return merged;
}
