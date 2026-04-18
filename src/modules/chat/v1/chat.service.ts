import { FindAndCountOptions, Op, QueryTypes, Transaction, fn } from 'sequelize';
import { ChatEntity } from './entity/chat.entity.js';
import { MessageEntity, MessageType, SenderRole } from './entity/message.entity.js';
import './entity/associate-models.js';
import { UserService } from '../../user/v1/user.service.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { Roles } from '../../../constants/roles.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { MessageMediaEntity } from './entity/message-media.entity.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';
import { sequelize } from '../../../database/db-config.js';
import { SubscriptionEntity } from '../../subscription/v1/entity/subscription.entity.js';

interface PaginationOptions {
    page?: number;
    limit?: number;
}

export type ChatListStatusFilter = 'active_valid' | 'inactive_valid' | 'inactive_invalid';

interface ListUserChatsOptions extends PaginationOptions {
    active?: boolean;
    validSubscription?: boolean;
    status?: ChatListStatusFilter;
}

interface UnreadChatCounters {
    activeValid: number;
    inactiveValid: number;
    inactiveInvalid: number;
}

export interface SendMessagePayload {
    userId: string;
    senderId: string;
    senderRole: SenderRole;
    content?: string | null;
    mediaIds?: string[] | null;
    parentMessageId?: string | null;
    messageType?: MessageType;
}

export interface UpdateMessagePayload {
    userId: string;
    messageId: string;
    actorId: string;
    actorRole: SenderRole;
    content?: string | null;
    mediaIds?: string[] | null;
    parentMessageId?: string | null;
}

export interface DeleteMessagePayload {
    userId: string;
    messageId: string;
    actorId: string;
    actorRole: SenderRole;
}

const MESSAGE_MEDIA_INCLUDE = {
    model: MediaEntity,
    as: 'media',
    through: { attributes: ['sortOrder'] },
};

const MESSAGE_PARENT_INCLUDE = {
    model: MessageEntity,
    as: 'parentMessage',
    attributes: ['id', 'content', 'messageType', 'parentMessageId', 'createdAt', 'isDeleted', 'deletedAt'],
    include: [MESSAGE_MEDIA_INCLUDE],
};

const CHAT_USER_INCLUDE = {
    model: UserEntity,
    as: 'user',
    attributes: ['id', 'name', 'provider', 'role', 'gender', 'imageId', 'isOnline', 'lastSeen'],
    include: [{
        model: SubscriptionEntity,
        as: 'subscription',
        attributes: ['id', 'isActive', 'isSubscribed', 'isFrozen', 'startDate', 'endDate', 'planType'],
        required: false,
    }],
};

const DEFAULT_PAGE_SIZE = 10000;

export class ChatService {
    static async getOrCreateUserChat(userId: string): Promise<ChatEntity> {
        const [chat] = await ChatEntity.findOrCreate({
            where: { userId },
            defaults: {
                userId,
            }
        });
        return chat;
    }

    static async sendMessage(payload: SendMessagePayload): Promise<{ chat: ChatEntity; message: MessageEntity; }> {
        const trimmedContent = normalizeMessageContent(payload.content);
        const mediaIds = sanitizeMediaIds(payload.mediaIds);
        const parentMessageId = normalizeParentMessageId(payload.parentMessageId);

        if (!trimmedContent && !mediaIds.length) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Message must include content or media');
        }

        if (mediaIds.length) {
            await assertAllMediaExist(mediaIds);
        }

        if (payload.senderRole === Roles.TRAINER || payload.senderRole === Roles.ADMIN) {
            await UserService.getUserById(payload.userId);
        }

        const chat = await this.getOrCreateUserChat(payload.userId);
        if (parentMessageId) {
            await assertParentMessageBelongsToChat(parentMessageId, chat.id);
        }

        const messageType: MessageType = payload.messageType ?? 'text';
        const transaction = await sequelize.transaction();
        try {
            const message = await MessageEntity.create({
                chatId: chat.id,
                senderId: payload.senderId,
                senderRole: payload.senderRole,
                parentMessageId,
                messageType,
                content: trimmedContent,
                isRead: false,
            }, { transaction });

            if (mediaIds.length) {
                await MessageMediaEntity.bulkCreate(
                    mediaIds.map((mediaId, index) => ({
                        messageId: message.id,
                        mediaId,
                        sortOrder: index,
                    })),
                    { transaction },
                );
            }

            const preview = buildMessagePreview(trimmedContent, mediaIds);
            await chat.update({
                lastMessageAt: message.createdAt,
                lastMessagePreview: preview,
            }, { transaction });

            await transaction.commit();
            await message.reload({ include: [MESSAGE_MEDIA_INCLUDE, MESSAGE_PARENT_INCLUDE] });
            return { chat, message };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async getMessagesForUser(userId: string, options: PaginationOptions = {}): Promise<MessageEntity[]> {
        const chat = await this.getOrCreateUserChat(userId);
        return this.getMessagesForChat(chat.id, options);
    }

    static async updateMessage(payload: UpdateMessagePayload): Promise<{ chat: ChatEntity; message: MessageEntity; }> {
        const chat = await getChatByUserIdOrThrow(payload.userId);
        const message = await getMessageForChatOrThrow(chat.id, payload.messageId);
        assertMessageMutationAllowed(message, payload.actorId, payload.actorRole);
        ensureMessageIsNotDeleted(message);

        const hasContentField = hasOwnField(payload, 'content');
        const hasMediaIdsField = hasOwnField(payload, 'mediaIds');
        const hasParentMessageIdField = hasOwnField(payload, 'parentMessageId');

        const nextContent = hasContentField
            ? normalizeMessageContent(payload.content)
            : (message.content ?? '');
        const nextMediaIds = hasMediaIdsField
            ? sanitizeMediaIds(payload.mediaIds)
            : await getMessageMediaIds(message.id);
        const nextParentMessageId = hasParentMessageIdField
            ? normalizeParentMessageId(payload.parentMessageId)
            : (message.parentMessageId ?? null);

        if (nextParentMessageId === message.id) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Message cannot reply to itself');
        }

        if (!nextContent && !nextMediaIds.length) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Message must include content or media');
        }

        if (hasMediaIdsField && nextMediaIds.length) {
            await assertAllMediaExist(nextMediaIds);
        }

        if (nextParentMessageId) {
            await assertParentMessageBelongsToChat(nextParentMessageId, chat.id, message.id);
        }

        const transaction = await sequelize.transaction();
        try {
            await message.update({
                ...(hasContentField ? { content: nextContent } : {}),
                ...(hasParentMessageIdField ? { parentMessageId: nextParentMessageId } : {}),
            }, { transaction });

            if (hasMediaIdsField) {
                await MessageMediaEntity.destroy({
                    where: { messageId: message.id },
                    transaction,
                });

                if (nextMediaIds.length) {
                    await MessageMediaEntity.bulkCreate(
                        nextMediaIds.map((mediaId, index) => ({
                            messageId: message.id,
                            mediaId,
                            sortOrder: index,
                        })),
                        { transaction },
                    );
                }
            }

            await refreshChatSummary(chat.id, transaction);

            await transaction.commit();
            await message.reload({ include: [MESSAGE_MEDIA_INCLUDE, MESSAGE_PARENT_INCLUDE] });

            return { chat, message };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async deleteMessage(payload: DeleteMessagePayload): Promise<{
        chatId: string;
        messageId: string;
        deletedAt: Date;
        deletedById: string;
        deletedByRole: SenderRole;
    }> {
        const chat = await getChatByUserIdOrThrow(payload.userId);
        const message = await getMessageForChatOrThrow(chat.id, payload.messageId);
        assertMessageMutationAllowed(message, payload.actorId, payload.actorRole);
        ensureMessageIsNotDeleted(message);

        const transaction = await sequelize.transaction();
        try {
            const deletedAt = new Date();
            await message.update({
                content: '',
                isRead: true,
                isDeleted: true,
                deletedAt,
                deletedById: payload.actorId,
                deletedByRole: payload.actorRole,
                parentMessageId: null,
            }, { transaction });
            await refreshChatSummary(chat.id, transaction);
            await transaction.commit();

            return {
                chatId: chat.id,
                messageId: message.id,
                deletedAt,
                deletedById: payload.actorId,
                deletedByRole: payload.actorRole,
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async getMessagesForChat(chatId: string, options: PaginationOptions = {}): Promise<MessageEntity[]> {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = options;
        return MessageEntity.findAll({
            where: { chatId },
            order: [['createdAt', 'ASC']],
            limit,
            offset: (page - 1) * limit,
            include: [MESSAGE_MEDIA_INCLUDE, MESSAGE_PARENT_INCLUDE],
        });
    }

    static async markUserMessagesAsRead(userId: string): Promise<number> {
        const chat = await this.getOrCreateUserChat(userId);
        const [updated] = await MessageEntity.update({
            isRead: true,
        }, {
            where: {
                chatId: chat.id,
                senderRole: Roles.USER,
                isRead: false,
                isDeleted: false,
            },
        });

        return updated;
    }

    static async markTrainerMessagesAsRead(userId: string): Promise<number> {
        const chat = await this.getOrCreateUserChat(userId);
        const [updated] = await MessageEntity.update({
            isRead: true,
        }, {
            where: {
                chatId: chat.id,
                senderRole: { [Op.in]: [Roles.TRAINER, Roles.ADMIN] },
                isRead: false,
                isDeleted: false,
            },
        });

        return updated;
    }

    static async countUnreadUserMessages(userId: string): Promise<number> {
        const chat = await this.getOrCreateUserChat(userId);
        return countUnreadMessages(chat.id, [Roles.USER]);
    }

    static async countUnreadTrainerMessages(userId: string): Promise<number> {
        const chat = await this.getOrCreateUserChat(userId);
        return countUnreadMessages(chat.id, [Roles.TRAINER, Roles.ADMIN]);
    }

    static async listUserChats(options: ListUserChatsOptions = {}) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = options;
        const where = buildChatListWhere(options);

        const findOptions: FindAndCountOptions = {
            limit,
            offset: (page - 1) * limit,
            distinct: true,
            order: [
                ['lastMessageAt', 'DESC'],
                ['createdAt', 'DESC'],
            ],
            where,
            include: [CHAT_USER_INCLUDE],
        };

        const { rows, count } = await ChatEntity.findAndCountAll(findOptions);

        const chatIds = rows.map((chat) => chat.id);
        const [unreadByChat, lastMessageByChat, unreadChatCounters] = await Promise.all([
            getUnreadCountsForChats(chatIds, [Roles.USER]),
            getLatestMessagesForChats(chatIds),
            getUnreadChatCounters([Roles.USER]),
        ]);

        return {
            chats: rows,
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit) || 1,
            unreadByChat,
            unreadChatCounters,
            lastMessageByChat,
        };
    }
}

function normalizeMessageContent(value?: string | null): string {
    if (typeof value === 'string') {
        return value.trim();
    }
    return '';
}

function sanitizeMediaIds(mediaIds?: string[] | null): string[] {
    if (!Array.isArray(mediaIds)) {
        return [];
    }

    return mediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function normalizeParentMessageId(parentMessageId?: string | null): string | null {
    if (typeof parentMessageId !== 'string') {
        return null;
    }

    const normalized = parentMessageId.trim();
    return normalized || null;
}

async function assertAllMediaExist(mediaIds: string[]) {
    if (!mediaIds.length) {
        return;
    }

    const count = await MediaEntity.count({ where: { id: { [Op.in]: mediaIds } } });
    if (count !== mediaIds.length) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'One or more media items were not found');
    }
}

async function assertParentMessageBelongsToChat(parentMessageId: string, chatId: string, currentMessageId?: string) {
    const parentMessage = await MessageEntity.findByPk(parentMessageId);

    if (!parentMessage || parentMessage.chatId !== chatId) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Parent message was not found in this chat');
    }

    if (parentMessage.isDeleted) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Deleted messages cannot be used as replies');
    }

    if (currentMessageId && parentMessage.id === currentMessageId) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Message cannot reply to itself');
    }
}

async function getChatByUserIdOrThrow(userId: string): Promise<ChatEntity> {
    const chat = await ChatEntity.findOne({ where: { userId } });
    if (!chat) {
        throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Chat not found');
    }
    return chat;
}

async function getMessageForChatOrThrow(chatId: string, messageId: string): Promise<MessageEntity> {
    const message = await MessageEntity.findOne({
        where: {
            id: messageId,
            chatId,
        },
    });

    if (!message) {
        throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Message not found');
    }

    return message;
}

async function getMessageMediaIds(messageId: string): Promise<string[]> {
    const rows = await MessageMediaEntity.findAll({
        where: { messageId },
        attributes: ['mediaId'],
        order: [['sortOrder', 'ASC']],
        raw: true,
    });

    return rows
        .map((row) => String((row as any).mediaId ?? ''))
        .filter(Boolean);
}

function buildMessagePreview(content: string, mediaIds: string[], isDeleted = false): string {
    if (isDeleted) {
        return 'Message deleted';
    }

    if (content) {
        return content.substring(0, 280);
    }

    if (mediaIds.length === 1) {
        return '[Attachment]';
    }

    if (mediaIds.length > 1) {
        return `[${mediaIds.length} attachments]`;
    }

    return '';
}

async function refreshChatSummary(chatId: string, transaction?: Transaction) {
    const chat = await ChatEntity.findByPk(chatId, { transaction });
    if (!chat) {
        throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Chat not found');
    }

    const latestMessage = await MessageEntity.findOne({
        where: { chatId },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        include: [MESSAGE_MEDIA_INCLUDE],
        transaction,
    });

    if (!latestMessage) {
        await chat.update({
            lastMessageAt: null,
            lastMessagePreview: null,
        }, { transaction });
        return;
    }

    const media = latestMessage.get('media') as MediaEntity[] | undefined;
    await chat.update({
        lastMessageAt: latestMessage.createdAt,
        lastMessagePreview: buildMessagePreview(
            latestMessage.content ?? '',
            Array.isArray(media) ? media.map((item) => item.id) : [],
            Boolean(latestMessage.isDeleted),
        ),
    }, { transaction });
}

async function countUnreadMessages(chatId: string, senderRoles: SenderRole[]): Promise<number> {
    return MessageEntity.count({
        where: {
            chatId,
            senderRole: { [Op.in]: senderRoles },
            isRead: false,
            isDeleted: false,
        },
    });
}

async function getUnreadCountsForChats(chatIds: string[], senderRoles: SenderRole[]): Promise<Record<string, number>> {
    if (!chatIds.length) {
        return {};
    }

    const rows = await MessageEntity.findAll({
        attributes: [
            'chatId',
            [fn('COUNT', '*'), 'unreadCount'],
        ],
        where: {
            chatId: { [Op.in]: chatIds },
            senderRole: { [Op.in]: senderRoles },
            isRead: false,
            isDeleted: false,
        },
        group: ['chatId'],
        raw: true,
    });

    return rows.reduce<Record<string, number>>((acc, row) => {
        const chatId = (row as any).chatId as string;
        const unreadCount = Number((row as any).unreadCount ?? 0) || 0;
        acc[chatId] = unreadCount;
        return acc;
    }, {});
}

function buildChatListWhere(options: ListUserChatsOptions) {
    const { active, validSubscription } = resolveChatListFilters(options);
    const conditions: any[] = [];

    if (typeof active === 'boolean') {
        conditions.push({ '$user.isOnline$': active });
    }

    if (typeof validSubscription === 'boolean') {
        conditions.push(
            validSubscription
                ? buildValidSubscriptionCondition()
                : buildInvalidSubscriptionCondition()
        );
    }

    if (!conditions.length) {
        return undefined;
    }

    return { [Op.and]: conditions };
}

function resolveChatListFilters(options: ListUserChatsOptions): Pick<ListUserChatsOptions, 'active' | 'validSubscription'> {
    if (options.status === 'active_valid') {
        return { active: true, validSubscription: true };
    }

    if (options.status === 'inactive_valid') {
        return { active: false, validSubscription: true };
    }

    if (options.status === 'inactive_invalid') {
        return { active: false, validSubscription: false };
    }

    return {
        active: options.active,
        validSubscription: options.validSubscription,
    };
}

function buildValidSubscriptionCondition() {
    return {
        [Op.and]: [
            { '$user.subscription.id$': { [Op.ne]: null } },
            { '$user.subscription.isActive$': true },
            { '$user.subscription.isSubscribed$': true },
            { '$user.subscription.endDate$': { [Op.gte]: new Date() } },
        ],
    };
}

function buildInvalidSubscriptionCondition() {
    return {
        [Op.or]: [
            { '$user.subscription.id$': null },
            { '$user.subscription.isActive$': false },
            { '$user.subscription.isSubscribed$': false },
            { '$user.subscription.endDate$': null },
            { '$user.subscription.endDate$': { [Op.lt]: new Date() } },
        ],
    };
}

async function getLatestMessagesForChats(chatIds: string[]): Promise<Record<string, MessageEntity>> {
    if (!chatIds.length) {
        return {};
    }

    const latestRows = await sequelize.query<{ id: string; chatId: string }>(
        `
            SELECT DISTINCT ON ("chatId") "id", "chatId"
            FROM "messages"
            WHERE "chatId" IN (:chatIds)
            ORDER BY "chatId", "createdAt" DESC, "id" DESC
        `,
        {
            replacements: { chatIds },
            type: QueryTypes.SELECT,
        },
    );

    const latestMessageIds = latestRows.map((row) => row.id);
    if (!latestMessageIds.length) {
        return {};
    }

    const messages = await MessageEntity.findAll({
        where: {
            id: { [Op.in]: latestMessageIds },
        },
        include: [MESSAGE_MEDIA_INCLUDE, MESSAGE_PARENT_INCLUDE],
    });

    return messages.reduce<Record<string, MessageEntity>>((acc, message) => {
        acc[message.chatId] = message;
        return acc;
    }, {});
}

async function getUnreadChatCounters(senderRoles: SenderRole[]): Promise<UnreadChatCounters> {
    const unreadChats = await MessageEntity.findAll({
        attributes: ['chatId'],
        where: {
            senderRole: { [Op.in]: senderRoles },
            isRead: false,
            isDeleted: false,
        },
        group: ['chatId'],
        raw: true,
    });

    const unreadChatIds = unreadChats
        .map((row) => String((row as any).chatId ?? ''))
        .filter(Boolean);

    if (!unreadChatIds.length) {
        return {
            activeValid: 0,
            inactiveValid: 0,
            inactiveInvalid: 0,
        };
    }

    const chats = await ChatEntity.findAll({
        where: {
            id: { [Op.in]: unreadChatIds },
        },
        attributes: ['id'],
        include: [CHAT_USER_INCLUDE],
    });

    return chats.reduce<UnreadChatCounters>((acc, chat) => {
        const category = classifyChat(chat.get('user') as UserEntity | undefined);
        if (category === 'activeValid') {
            acc.activeValid += 1;
        }
        if (category === 'inactiveValid') {
            acc.inactiveValid += 1;
        }
        if (category === 'inactiveInvalid') {
            acc.inactiveInvalid += 1;
        }
        return acc;
    }, {
        activeValid: 0,
        inactiveValid: 0,
        inactiveInvalid: 0,
    });
}

function classifyChat(user: UserEntity | undefined): keyof UnreadChatCounters | 'other' {
    const isOnline = Boolean(user?.isOnline);
    const subscription = getUserSubscription(user);
    const validSubscription = hasValidSubscription(subscription);

    if (isOnline && validSubscription) {
        return 'activeValid';
    }

    if (!isOnline && validSubscription) {
        return 'inactiveValid';
    }

    if (!isOnline && !validSubscription) {
        return 'inactiveInvalid';
    }

    return 'other';
}

function getUserSubscription(user: UserEntity | undefined): SubscriptionEntity | null {
    if (!user) {
        return null;
    }

    return (user.get('subscription') as SubscriptionEntity | null) ?? null;
}

function hasOwnField<T extends object>(value: T, key: keyof T): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
}

function ensureMessageIsNotDeleted(message: MessageEntity) {
    if (message.isDeleted) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Message is already deleted');
    }
}

function assertMessageMutationAllowed(message: MessageEntity, actorId: string, actorRole: SenderRole) {
    if (actorRole === Roles.ADMIN) {
        return;
    }

    if (message.senderId !== actorId || message.senderRole !== actorRole) {
        throw new HttpResponseError(StatusCodes.FORBIDDEN, 'You do not have permission to modify this message');
    }
}

function hasValidSubscription(subscription: SubscriptionEntity | null): boolean {
    if (!subscription || !subscription.endDate) {
        return false;
    }

    return Boolean(subscription.isActive)
        && Boolean(subscription.isSubscribed)
        && !subscription.isFrozen
        && subscription.endDate.getTime() >= Date.now();
}
