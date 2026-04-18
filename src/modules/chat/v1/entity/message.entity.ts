import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { Roles } from '../../../../constants/roles.js';

const SenderRoles = [Roles.USER, Roles.TRAINER, Roles.ADMIN] as const;
export type SenderRole = typeof SenderRoles[number];

const MessageTypes = ['text', 'call'] as const;
export type MessageType = typeof MessageTypes[number];

export class MessageEntity extends Model {
    declare id: string;
    declare chatId: string;
    declare senderId: string;
    declare senderRole: SenderRole;
    declare parentMessageId: string | null;
    declare messageType: MessageType;
    declare content: string | null;
    declare isRead: boolean;
    declare isDeleted: boolean;
    declare deletedAt: Date | null;
    declare deletedById: string | null;
    declare deletedByRole: SenderRole | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

MessageEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        chatId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        senderId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        senderRole: {
            type: DataTypes.ENUM(...SenderRoles),
            allowNull: false,
        },
        parentMessageId: {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: null,
        },
        messageType: {
            type: DataTypes.ENUM(...MessageTypes),
            allowNull: false,
            defaultValue: 'text',
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: '',
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        deletedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },
        deletedById: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        deletedByRole: {
            type: DataTypes.ENUM(...SenderRoles),
            allowNull: true,
            defaultValue: null,
        },
    },
    {
        sequelize,
        modelName: 'Message',
        tableName: 'messages',
        timestamps: true,
    }
);
