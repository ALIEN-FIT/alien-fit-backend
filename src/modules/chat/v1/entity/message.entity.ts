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
    declare messageType: MessageType;
    declare content: string | null;
    declare isRead: boolean;
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
    },
    {
        sequelize,
        modelName: 'Message',
        tableName: 'messages',
        timestamps: true,
    }
);
