import { FindAndCountOptions, Op, fn } from 'sequelize';
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

interface PaginationOptions {
    page?: number;
    limit?: number;
}

export interface SendMessagePayload {
    userId: string;
    senderId: string;
    senderRole: SenderRole;
    content?: string | null;
    mediaIds?: string[] | null;
    messageType?: MessageType;
}

const MESSAGE_MEDIA_INCLUDE = {
    model: MediaEntity,
    as: 'media',
    through: { attributes: ['sortOrder'] },
};

const DEFAULT_PAGE_SIZE = 50;

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

        const messageType: MessageType = payload.messageType ?? 'text';
        const transaction = await sequelize.transaction();
        try {
            const message = await MessageEntity.create({
                chatId: chat.id,
                senderId: payload.senderId,
                senderRole: payload.senderRole,
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
            await message.reload({ include: [MESSAGE_MEDIA_INCLUDE] });
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

    static async getMessagesForChat(chatId: string, options: PaginationOptions = {}): Promise<MessageEntity[]> {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = options;
        return MessageEntity.findAll({
            where: { chatId },
            order: [['createdAt', 'ASC']],
            limit,
            offset: (page - 1) * limit,
            include: [MESSAGE_MEDIA_INCLUDE],
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

    static async listUserChats(options: PaginationOptions = {}) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE } = options;

        const findOptions: FindAndCountOptions = {
            limit,
            offset: (page - 1) * limit,
            order: [
                ['lastMessageAt', 'DESC'],
                ['createdAt', 'DESC'],
            ],
            include: [{
                model: UserEntity,
                as: 'user',
                attributes: ['id', 'name', 'provider', 'role'],
            }],
        };

        const { rows, count } = await ChatEntity.findAndCountAll(findOptions);

        const unreadByChat = await getUnreadCountsForChats(rows.map((chat) => chat.id), [Roles.USER]);

        return {
            chats: rows,
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit) || 1,
            unreadByChat,
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

async function assertAllMediaExist(mediaIds: string[]) {
    if (!mediaIds.length) {
        return;
    }

    const count = await MediaEntity.count({ where: { id: { [Op.in]: mediaIds } } });
    if (count !== mediaIds.length) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'One or more media items were not found');
    }
}

function buildMessagePreview(content: string, mediaIds: string[]): string {
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

async function countUnreadMessages(chatId: string, senderRoles: SenderRole[]): Promise<number> {
    return MessageEntity.count({
        where: {
            chatId,
            senderRole: { [Op.in]: senderRoles },
            isRead: false,
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
