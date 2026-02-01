import fs from 'fs';
import path from 'path';
import type { Credentials } from 'google-auth-library';

const DEFAULT_TOKEN_PATH = path.resolve(process.cwd(), '.data', 'youtube-token.json');

export function getYouTubeTokenPath() {
    const configured = process.env.YOUTUBE_TOKEN_PATH;
    if (configured && configured.trim().length > 0) {
        return path.resolve(process.cwd(), configured);
    }
    return DEFAULT_TOKEN_PATH;
}

export function hasYouTubeStoredTokens(): boolean {
    return fs.existsSync(getYouTubeTokenPath());
}

export function readYouTubeStoredTokens(): Credentials | null {
    const tokenPath = getYouTubeTokenPath();
    if (!fs.existsSync(tokenPath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(tokenPath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed as Credentials;
    } catch {
        return null;
    }
}

export async function writeYouTubeStoredTokens(tokens: Credentials): Promise<void> {
    const tokenPath = getYouTubeTokenPath();
    await fs.promises.mkdir(path.dirname(tokenPath), { recursive: true });
    await fs.promises.writeFile(tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
}

export async function clearYouTubeStoredTokens(): Promise<void> {
    const tokenPath = getYouTubeTokenPath();
    try {
        await fs.promises.unlink(tokenPath);
    } catch {
        // ignore
    }
}
