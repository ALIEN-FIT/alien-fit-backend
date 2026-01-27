import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChatService } from './chat.service.js';
import { PresenceService } from './presence.service.js';
import { Roles } from '../../../constants/roles.js';
import { MessageEntity, SenderRole } from './entity/message.entity.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { is } from 'zod/locales';

export async function getMyChatController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const chat = await ChatService.getOrCreateUserChat(userId);
    const unreadCount = await ChatService.countUnreadTrainerMessages(userId);
    const presence = await PresenceService.getPresence(userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            chat: {
                id: chat.id,
                lastMessageAt: chat.lastMessageAt,
                lastMessagePreview: chat.lastMessagePreview,
                unreadCount,
            },
            presence,
        },
    });
}

export async function getMyMessagesController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { page = 1, limit = 50 } = req.query;
    const messages = await ChatService.getMessagesForUser(userId, {
        page: 1,
        limit: 1_000_000,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: messages.map((message) => mapMessageForUserViewer(message, userId)),
    });
}

export async function sendMessageAsUserController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { content, mediaIds } = req.body;

    const { message } = await ChatService.sendMessage({
        userId,
        senderId: userId,
        senderRole: Roles.USER as SenderRole,
        content: content ?? '',
        mediaIds,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: mapMessageForUserViewer(message, userId),
    });
}

export async function listChatsController(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 50 } = req.query;
    const result = await ChatService.listUserChats({
        page: Number(page),
        limit: Number(limit),
    });

    const presences = await Promise.all(result.chats.map((chat) => PresenceService.getPresence(chat.userId)));
    const unreadByChat = result.unreadByChat ?? {};

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result.chats.map((chat, index) => ({
            id: chat.id,
            user: mapChatUser(chat.get('user')),
            lastMessageAt: chat.lastMessageAt,
            lastMessagePreview: chat.lastMessagePreview,
            presence: presences[index],
            unreadCount: unreadByChat[chat.id] ?? 0,
        })),
        meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        },
    });
}

export async function getMessagesForUserController(req: Request, res: Response): Promise<void> {
    const targetUserId = req.params.userId;
    const { page = 1, limit = 50 } = req.query;

    const user = await UserService.getUserById(targetUserId);

    const messages = await ChatService.getMessagesForUser(targetUserId, {
        page: 1,
        limit: 1_000_000,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            user,
            messages: messages.map((message) => mapMessageForTrainerViewer(message))
        },
    });
}

export async function markMyTrainerMessagesReadController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const updated = await ChatService.markTrainerMessagesAsRead(userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            updated,
        },
    });
}

export async function markUserMessagesReadController(req: Request, res: Response): Promise<void> {
    const targetUserId = req.params.userId;

    await UserService.getUserById(targetUserId);
    const updated = await ChatService.markUserMessagesAsRead(targetUserId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            updated,
        },
    });
}

export async function sendMessageAsTrainerController(req: Request, res: Response): Promise<void> {
    const sender = req.user!;
    if (![Roles.TRAINER, Roles.ADMIN].includes(sender.role as string)) {
        throw new HttpResponseError(StatusCodes.FORBIDDEN, 'You do not have permission to perform this action');
    }

    const userId = req.params.userId;
    const { content, mediaIds } = req.body;

    const senderRole = sender.role as SenderRole;
    const { message } = await ChatService.sendMessage({
        userId,
        senderId: sender.id.toString(),
        senderRole,
        content: content ?? '',
        mediaIds,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: mapMessageForTrainerViewer(message),
    });
}

export async function getOnlineUsersCountController(req: Request, res: Response): Promise<void> {
    const count = await PresenceService.countOnlineUsers();
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { onlineUsers: count },
    });
}

export async function getUserPresenceController(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId;
    await UserService.getUserById(userId);
    const presence = await PresenceService.getPresence(userId);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: presence,
    });
}

function mapMessageForUserViewer(message: MessageEntity, viewerId: string) {
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
        isRead: message.isRead,
    };
}

function mapMessageForTrainerViewer(message: MessageEntity) {
    return {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderRole: message.senderRole,
        messageType: message.messageType,
        content: message.content ?? '',
        media: formatMessageMedia(message),
        createdAt: message.createdAt,
        isRead: message.isRead,
    };
}

function mapChatUser(user: unknown) {
    const typedUser = user as UserEntity | undefined;
    if (!typedUser) {
        return null;
    }

    return {
        id: typedUser.id,
        name: typedUser.name,
        provider: typedUser.provider,
        imageId: typedUser.imageId,
        isOnline: typedUser.isOnline,
        lastSeen: typedUser.lastSeen,
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
