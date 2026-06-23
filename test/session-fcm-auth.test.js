import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, it } from 'node:test';

const execFileAsync = promisify(execFile);

describe('session and FCM regressions', () => {
    it('covers device-aware FCM registration, stale-token filtering, and TTL payload settings', async () => {
        await runNodeScript(buildSessionAndFcmScript());
    });
});

describe('auth session regressions', () => {
    it('covers bearer-first logout and expired session rejection paths', async () => {
        await runNodeScript(buildAuthScript());
    });
});

async function runNodeScript(script) {
    const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ['--import', 'tsx', '-e', script],
        {
            cwd: process.cwd(),
            timeout: 30000,
            env: {
                ...process.env,
                ...buildValidEnv(),
                NODE_ENV: 'development',
            },
        }
    );

    if (stderr) {
        assert.fail(`Child script wrote to stderr:\n${stderr}`);
    }

    assert.match(stdout, /OK/);
}

function buildSessionAndFcmScript() {
    return `
        import assert from 'node:assert/strict';
        import { Op } from 'sequelize';

        const { sequelize } = await import('./src/database/db-config.ts');
        const { admin } = await import('./src/firebase/firebase.ts');
        const { errorLogger, infoLogger, debugLogger, httpLogger } = await import('./src/config/logger.config.ts');
        const { UserSessionEntity } = await import('./src/modules/user-session/v1/entity/user-session.entity.ts');
        const { UserSessionService } = await import('./src/modules/user-session/v1/user-session.service.ts');
        const { getUserFcmTokens, buildFcmMulticastMessage } = await import('./src/utils/fcm.utils.ts');

        try {
            {
                const transactionRef = { id: 'tx-1' };
                const saveCalls = [];
                const session = buildSession({ id: 'session-b', userId: 'user-b' }, saveCalls);
                const destroyCalls = [];
                const updateCalls = [];

                await withStubs([
                    [sequelize, 'transaction', async (callback) => callback(transactionRef)],
                    [UserSessionEntity, 'findByPk', async (id, options) => {
                        assert.equal(id, 'session-b');
                        assert.equal(options.transaction, transactionRef);
                        return session;
                    }],
                    [UserSessionEntity, 'destroy', async (options) => {
                        destroyCalls.push(options);
                        return 1;
                    }],
                    [UserSessionEntity, 'update', async (...args) => {
                        updateCalls.push(args);
                        return [1];
                    }],
                ], async () => {
                    await UserSessionService.updateFCMToken('session-b', {
                        fcmToken: ' token-b ',
                        deviceId: ' device-1 ',
                    });
                });

                assert.equal(destroyCalls[0].where.deviceId, 'device-1');
                assert.equal(destroyCalls[0].where.id[Op.ne], 'session-b');
                assert.equal(updateCalls[0][1].where.fcmToken, 'token-b');
                assert.equal(updateCalls[0][1].where.id[Op.ne], 'session-b');
                assert.equal(session.deviceId, 'device-1');
                assert.equal(session.fcmToken, 'token-b');
                assert.ok(session.fcmTokenUpdatedAt instanceof Date);
                assert.equal(saveCalls.length, 1);
            }

            {
                const session = buildSession({ id: 'session-a', userId: 'user-a' });
                let destroyCalled = false;
                let updateArgs;

                await withStubs([
                    [sequelize, 'transaction', async (callback) => callback({ id: 'tx-2' })],
                    [UserSessionEntity, 'findByPk', async () => session],
                    [UserSessionEntity, 'destroy', async () => {
                        destroyCalled = true;
                        return 0;
                    }],
                    [UserSessionEntity, 'update', async (...args) => {
                        updateArgs = args;
                        return [1];
                    }],
                ], async () => {
                    await UserSessionService.updateFCMToken('session-a', {
                        fcmToken: 'legacy-token',
                    });
                });

                assert.equal(destroyCalled, false);
                assert.equal(updateArgs[1].where.fcmToken, 'legacy-token');
                assert.equal(session.deviceId, undefined);
                assert.equal(session.fcmToken, 'legacy-token');
            }

            {
                let findAllOptions;
                const tokens = await withStubs([
                    [UserSessionEntity, 'findAll', async (options) => {
                        findAllOptions = options;
                        return [
                            { fcmToken: 'token-1' },
                            { fcmToken: 'token-1' },
                            { fcmToken: 'token-2' },
                        ];
                    }],
                ], async () => getUserFcmTokens('user-1'));

                assert.deepEqual(tokens, ['token-1', 'token-2']);
                assert.equal(findAllOptions.where.userId, 'user-1');
                assert.equal(findAllOptions.where.fcmToken[Op.ne], null);
                assert.ok(Array.isArray(findAllOptions.where[Op.or]));
                assert.ok(Array.isArray(findAllOptions.where[Op.and]));
            }

            {
                const now = new Date('2026-06-03T00:00:00.000Z');
                const message = buildFcmMulticastMessage(['token-1'], {
                    title: 'Hello',
                    body: 'World',
                    data: { type: 'GENERAL' },
                }, now);

                assert.equal(message.android.ttl, 2419200000);
                assert.equal(message.apns.headers['apns-expiration'], String(Math.floor(now.getTime() / 1000) + 2419200));
            }

            {
                const now = new Date('2026-06-03T12:00:00.000Z');
                let updateOptions;
                let destroyOptions;

                const result = await withStubs([
                    [UserSessionEntity, 'update', async (...args) => {
                        updateOptions = args;
                        return [3];
                    }],
                    [UserSessionEntity, 'destroy', async (options) => {
                        destroyOptions = options;
                        return 2;
                    }],
                ], async () => UserSessionService.cleanupExpiredSessionsAndStaleFcmTokens(now));

                assert.equal(updateOptions[0].fcmToken, null);
                assert.equal(updateOptions[1].where.fcmToken[Op.ne], null);
                assert.equal(destroyOptions.where.expiresAt[Op.lt], now);
                assert.deepEqual(result, { clearedTokens: 3, deletedSessions: 2 });
            }

            console.log('OK');
        } finally {
            await sequelize.close().catch(() => {});
            await admin.app().delete().catch(() => {});
            errorLogger.close();
            infoLogger.close();
            debugLogger.close();
            httpLogger.close();
            process.exit(0);
        }

        function buildSession(fields = {}, saveCalls = []) {
            return {
                deviceId: undefined,
                fcmToken: undefined,
                fcmTokenUpdatedAt: undefined,
                async save(options) {
                    saveCalls.push(options);
                    return this;
                },
                ...fields,
            };
        }

        async function withStubs(entries, callback) {
            const restores = entries.map(([target, key, replacement]) => {
                const original = target[key];
                target[key] = replacement;
                return () => {
                    target[key] = original;
                };
            });

            try {
                return await callback();
            } finally {
                restores.reverse().forEach((restore) => restore());
            }
        }
    `;
}

function buildAuthScript() {
    return `
        import assert from 'node:assert/strict';
        import jwt from 'jsonwebtoken';

        const { sequelize } = await import('./src/database/db-config.ts');
        const { admin } = await import('./src/firebase/firebase.ts');
        const { errorLogger, infoLogger, debugLogger, httpLogger } = await import('./src/config/logger.config.ts');
        const { notificationQueue } = await import('./src/workers/notification/notification.queue.ts');
        const { UserSessionEntity } = await import('./src/modules/user-session/v1/entity/user-session.entity.ts');
        const { UserEntity } = await import('./src/modules/user/v1/entity/user.entity.ts');
        const { UserService } = await import('./src/modules/user/v1/user.service.ts');
        const { authenticateAccessToken } = await import('./src/utils/auth.utils.ts');
        const { hashPassword } = await import('./src/utils/password.utils.ts');
        const { AuthService } = await import('./src/modules/auth/v1/auth.service.ts');
        const { logoutController } = await import('./src/modules/auth/v1/auth.controller.ts');

        try {
            {
                const accessToken = jwt.sign(
                    { _id: 'user-1', role: 'USER', sessionId: 'session-1' },
                    'jwt-secret',
                    { expiresIn: '1d' }
                );

                let logoutArgs;
                const req = {
                    headers: { authorization: \`Bearer \${accessToken}\` },
                    body: { refreshToken: 'legacy-refresh-token' },
                };
                const res = createResponseRecorder();

                await withStubs([
                    [UserService, 'getUserById', async () => ({ id: 'user-1', isBlocked: false })],
                    [UserSessionEntity, 'findByPk', async () => ({
                        id: 'session-1',
                        userId: 'user-1',
                        expiresAt: new Date(Date.now() + 60_000),
                    })],
                    [AuthService, 'logout', async (args) => {
                        logoutArgs = args;
                    }],
                ], async () => {
                    await logoutController(req, res);
                });

                assert.deepEqual(logoutArgs, {
                    sessionId: 'session-1',
                    refreshToken: 'legacy-refresh-token',
                });
                assert.equal(res.statusCode, 200);
                assert.deepEqual(res.payload, { status: 'success' });
            }

            {
                let destroyed = false;
                await withStubs([
                    [UserSessionEntity, 'findOne', async ({ where }) => {
                        assert.equal(where.refreshToken, 'legacy-refresh-token');
                        return {
                            destroy: async () => {
                                destroyed = true;
                            },
                        };
                    }],
                ], async () => {
                    await AuthService.logout({ refreshToken: 'legacy-refresh-token' });
                });
                assert.equal(destroyed, true);
            }

            {
                const refreshToken = jwt.sign(
                    { _id: 'user-1', tokenId: 'token-1', sessionId: 'session-1' },
                    'refresh-secret',
                    { expiresIn: '30d' }
                );

                let destroyed = false;
                await withStubs([
                    [UserSessionEntity, 'findOne', async () => ({
                        expiresAt: new Date(Date.now() - 60_000),
                        destroy: async () => {
                            destroyed = true;
                        },
                    })],
                ], async () => {
                    await assert.rejects(() => AuthService.refreshToken(refreshToken), /Refresh token expired/);
                });
                assert.equal(destroyed, true);
            }

            {
                const accessToken = jwt.sign(
                    { _id: 'user-1', role: 'USER', sessionId: 'session-1' },
                    'jwt-secret',
                    { expiresIn: '1d' }
                );

                let destroyed = false;
                await withStubs([
                    [UserService, 'getUserById', async () => ({ id: 'user-1', isBlocked: false })],
                    [UserSessionEntity, 'findByPk', async () => ({
                        userId: 'user-1',
                        expiresAt: new Date(Date.now() - 60_000),
                        destroy: async () => {
                            destroyed = true;
                        },
                    })],
                ], async () => {
                    await assert.rejects(() => authenticateAccessToken(accessToken), /Session expired/);
                });
                assert.equal(destroyed, true);
            }

            {
                const destroyCalls = [];
                const createCalls = [];
                const hashedPassword = await hashPassword('Ss123456*');

                await withStubs([
                    [UserEntity, 'scope', () => ({
                        findOne: async ({ where }) => {
                            assert.equal(where.provider, '+201000000000');
                            return {
                                id: 'user-login',
                                isBlocked: false,
                                password: hashedPassword,
                                generateAuthToken: (sessionId) => ({ token: `access-${sessionId}` }),
                                generateRefreshToken: async (sessionId) => `refresh-${sessionId}`,
                            };
                        },
                    })],
                    [UserSessionEntity, 'destroy', async (options) => {
                        destroyCalls.push(options);
                        return 1;
                    }],
                    [UserSessionEntity, 'create', async (payload) => {
                        createCalls.push(payload);
                        return { id: 'session-login' };
                    }],
                ], async () => {
                    const result = await AuthService.login('+201000000000', 'Ss123456*', ' device-login ');

                    assert.equal(result.accessToken.token, 'access-session-login');
                    assert.equal(result.refreshToken, 'refresh-session-login');
                });

                assert.equal(destroyCalls[0].where.userId, 'user-login');
                assert.equal(destroyCalls[0].where.deviceId, 'device-login');
                assert.deepEqual(createCalls[0], {
                    userId: 'user-login',
                    deviceId: 'device-login',
                });
            }

            console.log('OK');
        } finally {
            await sequelize.close().catch(() => {});
            await notificationQueue.close().catch(() => {});
            await admin.app().delete().catch(() => {});
            errorLogger.close();
            infoLogger.close();
            debugLogger.close();
            httpLogger.close();
            process.exit(0);
        }

        function createResponseRecorder() {
            return {
                statusCode: null,
                payload: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.payload = payload;
                    return this;
                },
            };
        }

        async function withStubs(entries, callback) {
            const restores = entries.map(([target, key, replacement]) => {
                const original = target[key];
                target[key] = replacement;
                return () => {
                    target[key] = original;
                };
            });

            try {
                return await callback();
            } finally {
                restores.reverse().forEach((restore) => restore());
            }
        }
    `;
}

function buildValidEnv() {
    return {
        PORT: '3000',
        DB_URI: 'postgres://postgres:postgres@localhost:5432/alien_fit_test',
        REDIS_URL: 'redis://localhost:6379/0',
        APP_NAME: 'alien_fit',
        APP_VERSION: '1.0.0',
        SUPER_ADMIN_PROVIDER: 'admin@example.com',
        SUPER_ADMIN_PASSWORD: 'password',
        JWT_PRIVATE_KEY: 'jwt-secret',
        REFRESH_TOKEN_PRIVATE_KEY: 'refresh-secret',
        JWT_ACCESS_TOKEN_TTL: '1d',
        JWT_REFRESH_TOKEN_TTL: '30d',
        FCM_TOKEN_MAX_AGE_DAYS: '30',
        FCM_MESSAGE_TTL_SECONDS: '2419200',
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
