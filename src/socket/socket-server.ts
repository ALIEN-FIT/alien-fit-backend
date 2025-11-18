import { Server as HTTPServer } from 'http';
import type { IncomingMessage } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { authenticateAccessToken } from '../utils/auth.utils.js';
import { Roles } from '../constants/roles.js';
import { ChatService } from '../modules/chat/v1/chat.service.js';
import { PresenceService } from '../modules/chat/v1/presence.service.js';
import { MessageEntity, SenderRole } from '../modules/chat/v1/entity/message.entity.js';
import { HttpResponseError } from '../utils/appError.js';
import { UserService } from '../modules/user/v1/user.service.js';
import { StatusCodes } from 'http-status-codes';

const TRAINERS_ROOM = 'trainers';
const HEARTBEAT_EVENT = 'heartbeat';
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_MAX_MISSES = 3;
const SEND_MESSAGE_EVENT = 'chat:send';
const MESSAGE_EVENT = 'chat:message';
const USER_ROOM_PREFIX = 'chat:';
const CALL_OFFER_EVENT = 'call:offer';
const CALL_ANSWER_EVENT = 'call:answer';
const CALL_ICE_CANDIDATE_EVENT = 'call:ice-candidate';
const CALL_END_EVENT = 'call:end';

interface CallSession {
    userId: string;
    initiatorId: string;
    initiatorSocketId: string;
    startedAt: Date;
    status: 'ringing' | 'active';
    trainerId?: string;
    trainerSocketId?: string;
}

type CallTerminator = 'user' | 'trainer' | 'system';
type CallHistoryStatus = 'started' | 'answered' | 'ended' | 'missed';

interface HeartbeatState {
    missedPings: number;
    intervalId: NodeJS.Timeout;
}

declare module 'socket.io' {
    interface SocketData {
        userId: string;
        role: string;
    }
}

const connectionCounters = new Map<string, number>();
const activeCallSessions = new Map<string, CallSession>();
const heartbeatStates = new Map<string, HeartbeatState>();

export function initializeSocketServer(server: HTTPServer) {
    const io = new SocketIOServer(server, {
        cors: {
            origin: '*',
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        try {
            console.log('Socket handshake headers:', socket.handshake.headers);
            const token = extractToken(socket);
            const { user } = await authenticateAccessToken(token);
            socket.data.userId = user.id.toString();
            socket.data.role = user.role;
            console.log(`Socket connected: userId=${socket.data.userId}, role=${socket.data.role}`);
            next();
        } catch (error) {
            console.log('Socket authentication error:', error);
            next(error as Error);
        }
    });

    io.engine.on('connection_error', (err) => {
        const engineError = err as {
            code?: string;
            message: string;
            context?: unknown;
            req?: IncomingMessage;
        };
        const requestInfo = engineError.req
            ? {
                url: engineError.req.url,
                origin: engineError.req.headers.origin,
                userAgent: engineError.req.headers['user-agent'],
                remoteAddress: engineError.req.socket?.remoteAddress,
            }
            : undefined;
        console.error('Socket engine connection error', {
            code: engineError.code,
            message: engineError.message,
            context: engineError.context,
            request: requestInfo,
        });
    });

    io.on('connection', async (socket) => {
        const { userId, role } = socket.data;
        registerConnection(userId);

        if (role === Roles.USER) {
            socket.join(getUserRoom(userId));
        } else if (role === Roles.TRAINER || role === Roles.ADMIN) {
            socket.join(TRAINERS_ROOM);
        }

        await PresenceService.heartbeat(userId);

        socket.on(HEARTBEAT_EVENT, async () => {
            resetHeartbeat(socket.id);
            await PresenceService.heartbeat(userId);
        });

        startHeartbeatLoop(socket, userId);

        socket.on(SEND_MESSAGE_EVENT, async (payload, callback) => {
            try {
                const { content, mediaIds, userId: targetUserId } = payload as { content?: string; mediaIds?: string[]; userId?: string };
                const resolvedUserId = role === Roles.USER ? userId : targetUserId;

                if (!resolvedUserId) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Target userId is required');
                }

                const senderRole = (role === Roles.USER ? Roles.USER : role) as SenderRole;
                const { message } = await ChatService.sendMessage({
                    userId: resolvedUserId,
                    senderId: userId,
                    senderRole,
                    content: content ?? '',
                    mediaIds,
                });

                await PresenceService.heartbeat(userId);

                io.to(getUserRoom(resolvedUserId)).emit(MESSAGE_EVENT, mapMessageForUser(resolvedUserId, message));
                io.to(TRAINERS_ROOM).emit(MESSAGE_EVENT, mapMessageForTrainer(message));

                callback?.({ status: 'ok' });
            } catch (error) {
                if (callback) {
                    callback({ status: 'error', message: (error as Error).message });
                }
            }
        });

        // --- WebRTC signaling bridge ---
        // We maintain a per-user CallSession so that a single trainer/admin can pick up
        // an incoming WebRTC call. All offers/answers/ICE are funneled through Socket.IO.
        socket.on(CALL_OFFER_EVENT, async (payload, callback) => {
            try {
                if (role !== Roles.USER) {
                    throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only users can start calls');
                }

                const { offer } = payload as { offer?: unknown };
                if (!offer) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'WebRTC SDP offer is required');
                }

                if (activeCallSessions.has(userId)) {
                    throw new HttpResponseError(StatusCodes.CONFLICT, 'A call is already in progress for this user');
                }

                const caller = await UserService.getUserById(userId);

                activeCallSessions.set(userId, {
                    userId,
                    initiatorId: userId,
                    initiatorSocketId: socket.id,
                    startedAt: new Date(),
                    status: 'ringing',
                });

                await recordCallHistoryMessage({
                    userId,
                    senderId: userId,
                    senderRole: Roles.USER as SenderRole,
                    status: 'started',
                    metadata: {
                        direction: 'outgoing',
                        initiatorId: userId,
                    },
                });

                await PresenceService.heartbeat(userId);

                io.to(TRAINERS_ROOM).emit(CALL_OFFER_EVENT, {
                    userId,
                    offer,
                    caller: {
                        id: userId,
                        name: caller.name,
                        provider: caller.provider,
                        role: Roles.USER,
                    },
                });

                callback?.({ status: 'ok' });
            } catch (error) {
                callback?.({ status: 'error', message: (error as Error).message });
            }
        });

        socket.on(CALL_ANSWER_EVENT, async (payload, callback) => {
            try {
                if (![Roles.TRAINER, Roles.ADMIN].includes(role)) {
                    throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Only trainers or admins can answer calls');
                }

                const { userId: payloadUserId, target, answer } = payload as { userId?: string; target?: string; answer?: unknown };
                const normalizedTarget = typeof target === 'string' ? target.trim() : undefined;
                const targetUserId = payloadUserId ?? (normalizedTarget && normalizedTarget !== TRAINERS_ROOM ? normalizedTarget : undefined);

                if (!targetUserId) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Target userId is required');
                }
                if (!answer) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'WebRTC SDP answer is required');
                }

                const session = activeCallSessions.get(targetUserId);
                if (!session) {
                    throw new HttpResponseError(StatusCodes.NOT_FOUND, 'No pending call for this user');
                }
                if (session.status === 'active') {
                    throw new HttpResponseError(StatusCodes.CONFLICT, 'This call has already been answered');
                }

                session.status = 'active';
                session.trainerId = userId;
                session.trainerSocketId = socket.id;

                await recordCallHistoryMessage({
                    userId: targetUserId,
                    senderId: userId,
                    senderRole: role as SenderRole,
                    status: 'answered',
                    metadata: {
                        trainerId: userId,
                    },
                });

                await PresenceService.heartbeat(userId);

                io.to(getUserRoom(targetUserId)).emit(CALL_ANSWER_EVENT, {
                    answer,
                    trainer: {
                        label: 'trainer',
                        id: userId,
                    },
                    userId: targetUserId,
                });

                callback?.({ status: 'ok' });
            } catch (error) {
                callback?.({ status: 'error', message: (error as Error).message });
            }
        });

        socket.on(CALL_ICE_CANDIDATE_EVENT, (payload, callback) => {
            try {
                const { candidate, userId: payloadUserId, target } = payload as { candidate?: unknown; userId?: string; target?: string };
                if (!candidate) {
                    throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'ICE candidate is required');
                }

                const normalizedPayloadUserId = typeof payloadUserId === 'string' ? payloadUserId.trim() : undefined;
                const normalizedTarget = typeof target === 'string' ? target.trim() : undefined;
                const resolvedTarget = normalizedTarget ?? normalizedPayloadUserId;

                if (role === Roles.USER) {
                    const session = activeCallSessions.get(userId);
                    if (session?.trainerSocketId) {
                        io.to(session.trainerSocketId).emit(CALL_ICE_CANDIDATE_EVENT, {
                            userId,
                            candidate,
                        });
                    } else {
                        io.to(TRAINERS_ROOM).emit(CALL_ICE_CANDIDATE_EVENT, {
                            userId,
                            candidate,
                        });
                    }
                } else if ([Roles.TRAINER, Roles.ADMIN].includes(role)) {
                    const targetUserId = resolvedTarget && resolvedTarget !== TRAINERS_ROOM ? resolvedTarget : undefined;
                    if (!targetUserId) {
                        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Target userId is required');
                    }

                    const session = activeCallSessions.get(targetUserId);
                    if (session && session.trainerSocketId && session.trainerSocketId !== socket.id) {
                        throw new HttpResponseError(StatusCodes.FORBIDDEN, 'You are not attached to this call');
                    }

                    io.to(getUserRoom(targetUserId)).emit(CALL_ICE_CANDIDATE_EVENT, {
                        candidate,
                    });
                } else {
                    throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Unsupported role for ICE exchange');
                }

                callback?.({ status: 'ok' });
            } catch (error) {
                callback?.({ status: 'error', message: (error as Error).message });
            }
        });

        socket.on(CALL_END_EVENT, async (payload, callback) => {
            try {
                const { reason, status, userId: payloadUserId, target } = payload as { reason?: string; status?: string; userId?: string; target?: string };
                const normalizedTarget = typeof target === 'string' ? target.trim() : undefined;
                const targetUserId = payloadUserId ?? (normalizedTarget && normalizedTarget !== TRAINERS_ROOM ? normalizedTarget : undefined);
                const resolvedReason = reason ?? status;

                if (role === Roles.USER) {
                    const ended = await finalizeCallSession(userId, {
                        actorId: userId,
                        actorRole: Roles.USER as SenderRole,
                        endedBy: 'user',
                        reason: resolvedReason,
                        refreshPresence: true,
                    });

                    callback?.({ status: ended ? 'ok' : 'noop' });
                } else if ([Roles.TRAINER, Roles.ADMIN].includes(role)) {
                    if (!targetUserId) {
                        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Target userId is required');
                    }

                    const session = activeCallSessions.get(targetUserId);
                    if (session && session.trainerSocketId && session.trainerSocketId !== socket.id) {
                        throw new HttpResponseError(StatusCodes.FORBIDDEN, 'You are not attached to this call');
                    }

                    const ended = await finalizeCallSession(targetUserId, {
                        actorId: userId,
                        actorRole: role as SenderRole,
                        endedBy: 'trainer',
                        reason: resolvedReason,
                        refreshPresence: true,
                    });

                    callback?.({ status: ended ? 'ok' : 'noop' });
                } else {
                    throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Unsupported role for ending calls');
                }
            } catch (error) {
                callback?.({ status: 'error', message: (error as Error).message });
            }
        });

        socket.on('disconnect', async () => {
            stopHeartbeatLoop(socket.id);
            if (deregisterConnection(userId)) {
                await PresenceService.markOffline(userId);
            }

            if (role === Roles.USER) {
                const session = activeCallSessions.get(userId);
                if (session && session.initiatorSocketId === socket.id) {
                    await finalizeCallSession(userId, {
                        actorId: userId,
                        actorRole: Roles.USER as SenderRole,
                        endedBy: 'user',
                        reason: 'disconnect',
                        refreshPresence: false,
                    });
                }
            } else if (role === Roles.TRAINER || role === Roles.ADMIN) {
                const session = findCallSessionByTrainerSocketId(socket.id);
                if (session) {
                    await finalizeCallSession(session.userId, {
                        actorId: userId,
                        actorRole: role as SenderRole,
                        endedBy: 'trainer',
                        reason: 'disconnect',
                        refreshPresence: false,
                    });
                }
            }
        });
    });

    // Persist each call lifecycle step as a chat message so WhatsApp-style history
    // appears inline with the rest of the conversation.
    async function recordCallHistoryMessage(params: { userId: string; senderId: string; senderRole: SenderRole; status: CallHistoryStatus; metadata?: Record<string, unknown>; }) {
        const messageContent = JSON.stringify({
            type: 'call',
            status: params.status,
            timestamp: new Date().toISOString(),
            ...(params.metadata ?? {}),
        });

        const { message } = await ChatService.sendMessage({
            userId: params.userId,
            senderId: params.senderId,
            senderRole: params.senderRole,
            content: messageContent,
            messageType: 'call',
        });

        io.to(getUserRoom(params.userId)).emit(MESSAGE_EVENT, mapMessageForUser(params.userId, message));
        io.to(TRAINERS_ROOM).emit(MESSAGE_EVENT, mapMessageForTrainer(message));

        return message;
    }

    async function finalizeCallSession(userId: string, options: { actorId: string; actorRole: SenderRole; endedBy: CallTerminator; reason?: string; refreshPresence?: boolean; }): Promise<boolean> {
        const session = activeCallSessions.get(userId);
        if (!session) {
            return false;
        }

        activeCallSessions.delete(userId);
        const status: CallHistoryStatus = session.status === 'active' ? 'ended' : 'missed';

        await recordCallHistoryMessage({
            userId,
            senderId: options.actorId,
            senderRole: options.actorRole,
            status,
            metadata: {
                endedBy: options.endedBy,
                reason: options.reason,
                initiatorId: session.initiatorId,
                trainerId: session.trainerId,
            },
        });

        if (options.refreshPresence) {
            await PresenceService.heartbeat(options.actorId);
        }

        const payload = {
            userId,
            endedBy: options.endedBy,
            reason: options.reason,
            status,
        };

        io.to(getUserRoom(userId)).emit(CALL_END_EVENT, payload);

        if (session.trainerSocketId) {
            io.to(session.trainerSocketId).emit(CALL_END_EVENT, payload);
        } else {
            io.to(TRAINERS_ROOM).emit(CALL_END_EVENT, payload);
        }

        return true;
    }

    function findCallSessionByTrainerSocketId(socketId: string): CallSession | undefined {
        for (const session of activeCallSessions.values()) {
            if (session.trainerSocketId === socketId) {
                return session;
            }
        }
        return undefined;
    }

    return io;
}

function extractToken(socket: Socket): string | undefined {
    const { authorization } = socket.handshake.headers;
    const headerToken = normalizeToken(typeof authorization === 'string' ? authorization : undefined);
    if (headerToken) {
        return headerToken;
    }

    const authToken = typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : undefined;
    const normalizedAuthToken = normalizeToken(authToken);
    if (normalizedAuthToken) {
        return normalizedAuthToken;
    }

    const queryToken = typeof socket.handshake.query?.token === 'string'
        ? socket.handshake.query.token as string
        : undefined;

    return normalizeToken(queryToken);
}

function normalizeToken(token?: string): string | undefined {
    if (!token) {
        return undefined;
    }

    const trimmed = token.trim();
    if (!trimmed) {
        return undefined;
    }

    if (/^Bearer\s+/i.test(trimmed)) {
        return trimmed.replace(/^Bearer\s+/i, '').trim();
    }

    return trimmed;
}

function getUserRoom(userId: string): string {
    return `${USER_ROOM_PREFIX}${userId}`;
}

function mapMessageForUser(viewerId: string, message: MessageEntity) {
    const senderType = message.senderRole === Roles.USER ? 'user' : 'trainer';
    const isMine = message.senderId === viewerId;
    return {
        id: message.id,
        content: message.content ?? '',
        messageType: message.messageType,
        media: formatMessageMedia(message),
        createdAt: message.createdAt,
        senderType,
        isMine,
    };
}

function mapMessageForTrainer(message: MessageEntity) {
    return {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderRole: message.senderRole,
        messageType: message.messageType,
        content: message.content ?? '',
        media: formatMessageMedia(message),
        createdAt: message.createdAt,
    };
}

function formatMessageMedia(message: MessageEntity) {
    const media = message.get('media') as unknown;
    if (!Array.isArray(media)) {
        return [];
    }

    return media
        .map((item) => {
            const plain = typeof (item as any)?.get === 'function' ? (item as any).get({ plain: true }) : item;
            const sortOrder = plain?.MessageMedia?.sortOrder ?? 0;
            const { MessageMedia, ...rest } = plain ?? {};
            return { ...rest, sortOrder };
        })
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function startHeartbeatLoop(socket: Socket, userId: string) {
    stopHeartbeatLoop(socket.id);
    const state: HeartbeatState = {
        missedPings: 0,
        intervalId: setInterval(() => {
            sendHeartbeatPing(socket, state, userId);
        }, HEARTBEAT_INTERVAL_MS),
    };

    heartbeatStates.set(socket.id, state);
    sendHeartbeatPing(socket, state, userId);
}

function sendHeartbeatPing(socket: Socket, state: HeartbeatState, userId: string) {
    if (socket.disconnected) {
        stopHeartbeatLoop(socket.id);
        return;
    }

    const attempt = state.missedPings + 1;
    socket.emit(HEARTBEAT_EVENT, {
        type: 'ping',
        attempt,
        timestamp: Date.now(),
        userId,
    });

    state.missedPings = attempt;

    if (state.missedPings >= HEARTBEAT_MAX_MISSES) {
        socket.emit(HEARTBEAT_EVENT, { type: 'timeout', userId });
        stopHeartbeatLoop(socket.id);
        socket.disconnect(true);
    }
}

function resetHeartbeat(socketId: string) {
    const state = heartbeatStates.get(socketId);
    if (state) {
        state.missedPings = 0;
    }
}

function stopHeartbeatLoop(socketId: string) {
    const state = heartbeatStates.get(socketId);
    if (!state) {
        return;
    }
    clearInterval(state.intervalId);
    heartbeatStates.delete(socketId);
}

function registerConnection(userId: string) {
    const count = connectionCounters.get(userId) ?? 0;
    connectionCounters.set(userId, count + 1);
}

function deregisterConnection(userId: string): boolean {
    const count = connectionCounters.get(userId) ?? 0;
    if (count <= 1) {
        connectionCounters.delete(userId);
        return true;
    }
    connectionCounters.set(userId, count - 1);
    return false;
}
