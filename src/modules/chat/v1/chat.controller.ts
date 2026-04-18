import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChatListStatusFilter, ChatService } from './chat.service.js';
import { PresenceService } from './presence.service.js';
import { Roles } from '../../../constants/roles.js';
import { MessageEntity, SenderRole } from './entity/message.entity.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { NotificationService } from '../../notification/v1/notification.service.js';
import { NotificationTypes } from '../../../constants/notification-type.js';
import { SubscriptionEntity } from '../../subscription/v1/entity/subscription.entity.js';

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
    const { content, mediaIds, parentMessageId } = req.body;

    const { message } = await ChatService.sendMessage({
        userId,
        senderId: userId,
        senderRole: Roles.USER as SenderRole,
        content: content ?? '',
        mediaIds,
        parentMessageId,
    });

    const trimmed = typeof content === 'string' ? content.trim() : '';
    const preview = trimmed
        ? trimmed.slice(0, 280)
        : (Array.isArray(mediaIds) && mediaIds.length > 0 ? '[Attachment]' : 'New message');

    await NotificationService.notifyAdminsAndTrainers({
        type: NotificationTypes.MESSAGE,
        title: `New message from ${req.user!.name}`,
        body: preview,
        byUserId: userId,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: mapMessageForUserViewer(message, userId),
    });
}

export async function listChatsController(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = 10000, active, validSubscription, status } = req.query;
    const result = await ChatService.listUserChats({
        page: Number(page),
        limit: Number(limit),
        active: parseOptionalBoolean(active),
        validSubscription: parseOptionalBoolean(validSubscription),
        status: typeof status === 'string' ? status as ChatListStatusFilter : undefined,
    });

    const presences = await Promise.all(result.chats.map((chat) => PresenceService.getPresence(chat.userId)));
    const unreadByChat = result.unreadByChat ?? {};
    const lastMessageByChat = result.lastMessageByChat ?? {};

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result.chats.map((chat, index) => ({
            id: chat.id,
            user: mapChatUser(chat.get('user')),
            lastMessageAt: chat.lastMessageAt,
            lastMessagePreview: chat.lastMessagePreview,
            lastMessage: formatLastChatMessage(lastMessageByChat[chat.id]),
            presence: presences[index],
            unreadCount: unreadByChat[chat.id] ?? 0,
        })),
        meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            unreadChatCounters: result.unreadChatCounters,
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
    const { content, mediaIds, parentMessageId } = req.body;

    const senderRole = sender.role as SenderRole;
    const { message } = await ChatService.sendMessage({
        userId,
        senderId: sender.id.toString(),
        senderRole,
        content: content ?? '',
        mediaIds,
        parentMessageId,
    });

    const trimmed = typeof content === 'string' ? content.trim() : '';
    const preview = trimmed
        ? trimmed.slice(0, 280)
        : (Array.isArray(mediaIds) && mediaIds.length > 0 ? '[Attachment]' : 'New message');

    await NotificationService.notifyUserAboutAdminMessage({
        userId,
        adminId: sender.id.toString(),
        adminName: sender.name,
        preview,
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: mapMessageForTrainerViewer(message),
    });
}

export async function updateMyMessageController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { messageId } = req.params;
    const { content, mediaIds, parentMessageId } = req.body;

    const { message } = await ChatService.updateMessage({
        userId,
        messageId,
        actorId: userId,
        actorRole: Roles.USER as SenderRole,
        ...('content' in req.body ? { content } : {}),
        ...('mediaIds' in req.body ? { mediaIds } : {}),
        ...('parentMessageId' in req.body ? { parentMessageId } : {}),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: mapMessageForUserViewer(message, userId),
    });
}

export async function updateUserMessageController(req: Request, res: Response): Promise<void> {
    const { userId, messageId } = req.params;
    const { content, mediaIds, parentMessageId } = req.body;

    const { message } = await ChatService.updateMessage({
        userId,
        messageId,
        actorId: req.user!.id.toString(),
        actorRole: req.user!.role as SenderRole,
        ...('content' in req.body ? { content } : {}),
        ...('mediaIds' in req.body ? { mediaIds } : {}),
        ...('parentMessageId' in req.body ? { parentMessageId } : {}),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: mapMessageForTrainerViewer(message),
    });
}

export async function deleteMyMessageController(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id.toString();
    const { messageId } = req.params;
    const result = await ChatService.deleteMessage({
        userId,
        messageId,
        actorId: userId,
        actorRole: Roles.USER as SenderRole,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            deleted: true,
            userId,
            chatId: result.chatId,
            messageId: result.messageId,
            isDeleted: true,
            deletedAt: result.deletedAt,
            deletedById: result.deletedById,
            deletedByRole: result.deletedByRole,
        },
    });
}

export async function deleteUserMessageController(req: Request, res: Response): Promise<void> {
    const { userId, messageId } = req.params;
    const result = await ChatService.deleteMessage({
        userId,
        messageId,
        actorId: req.user!.id.toString(),
        actorRole: req.user!.role as SenderRole,
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: {
            deleted: true,
            userId,
            chatId: result.chatId,
            messageId: result.messageId,
            isDeleted: true,
            deletedAt: result.deletedAt,
            deletedById: result.deletedById,
            deletedByRole: result.deletedByRole,
        },
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
    const reply = formatReplyMeta(message);

    return {
        id: message.id,
        parentMessageId: reply?.id ?? null,
        parentMessagePreview: reply?.preview ?? null,
        reply,
        content: message.isDeleted ? '' : (message.content ?? ''),
        messageType: message.messageType,
        media: formatMessageMedia(message),
        createdAt: message.createdAt,
        senderType,
        isMine,
        isRead: message.isRead,
        isDeleted: message.isDeleted,
        deletedAt: message.deletedAt ?? null,
        deletedById: message.deletedById ?? null,
        deletedByRole: message.deletedByRole ?? null,
    };
}

function mapMessageForTrainerViewer(message: MessageEntity) {
    const reply = formatReplyMeta(message);

    return {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderRole: message.senderRole,
        parentMessageId: reply?.id ?? null,
        parentMessagePreview: reply?.preview ?? null,
        reply,
        messageType: message.messageType,
        content: message.isDeleted ? '' : (message.content ?? ''),
        media: formatMessageMedia(message),
        createdAt: message.createdAt,
        isRead: message.isRead,
        isDeleted: message.isDeleted,
        deletedAt: message.deletedAt ?? null,
        deletedById: message.deletedById ?? null,
        deletedByRole: message.deletedByRole ?? null,
    };
}

function mapChatUser(user: unknown) {
    const typedUser = user as UserEntity | undefined;
    if (!typedUser) {
        return null;
    }

    const subscription = getIncludedSubscription(typedUser);
    const validSubscription = hasValidSubscription(subscription);

    return {
        id: typedUser.id,
        name: typedUser.name,
        provider: typedUser.provider,
        gender: typedUser.gender ?? null,
        imageId: typedUser.imageId,
        isOnline: typedUser.isOnline,
        lastSeen: typedUser.lastSeen,
        active: typedUser.isOnline,
        validSubscription,
        subscription: subscription ? {
            isActive: subscription.isActive,
            isSubscribed: subscription.isSubscribed,
            isFrozen: subscription.isFrozen,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            planType: subscription.planType,
            valid: validSubscription,
        } : null,
    };
}

function formatMessageMedia(message: MessageEntity) {
    if (message.isDeleted) {
        return [];
    }

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

function formatLastChatMessage(message?: MessageEntity | null) {
    if (!message) {
        return null;
    }

    const media = formatMessageMedia(message);
    const mediaTypes = Array.from(new Set(
        media
            .map((item) => item?.mediaType)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ));

    return {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        senderRole: message.senderRole,
        parentMessageId: message.parentMessageId ?? null,
        messageType: message.messageType,
        content: message.isDeleted ? '' : (message.content ?? ''),
        createdAt: message.createdAt,
        mediaType: mediaTypes[0] ?? null,
        mediaTypes,
        hasMedia: media.length > 0,
        isDeleted: message.isDeleted,
        deletedAt: message.deletedAt ?? null,
        deletedById: message.deletedById ?? null,
        deletedByRole: message.deletedByRole ?? null,
    };
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }

    if (value === 'true') {
        return true;
    }

    if (value === 'false') {
        return false;
    }

    return undefined;
}

function getIncludedSubscription(user: UserEntity): SubscriptionEntity | null {
    return (user.get('subscription') as SubscriptionEntity | null) ?? null;
}

function hasValidSubscription(subscription: SubscriptionEntity | null): boolean {
    if (!subscription?.endDate) {
        return false;
    }

    return Boolean(subscription.isActive)
        && Boolean(subscription.isSubscribed)
        && !subscription.isFrozen
        && subscription.endDate.getTime() >= Date.now();
}

function formatReplyMeta(message: MessageEntity) {
    const parentMessage = getParentMessage(message);
    if (!parentMessage) {
        return null;
    }

    return {
        id: parentMessage.id,
        preview: buildReplyPreview(parentMessage),
    };
}

function getParentMessage(message: MessageEntity): MessageEntity | null {
    return (message.get('parentMessage') as MessageEntity | null) ?? null;
}

function buildReplyPreview(message: MessageEntity): string {
    if (message.isDeleted) {
        return 'Message deleted';
    }

    const content = (message.content ?? '').trim();
    if (content) {
        return content.slice(0, 30);
    }

    const media = formatMessageMedia(message);
    if (media.length === 1) {
        return '[Attachment]';
    }

    if (media.length > 1) {
        return `[${media.length} attachments]`;
    }

    return '';
}
