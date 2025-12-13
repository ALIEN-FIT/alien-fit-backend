import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../database/db-config.js';
import { SupportTicketStatus } from '../../../constants/support-ticket-status.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';

export const FEEDBACK_TYPES = ['compliment', 'suggestion', 'complaint'] as const;
export type FeedbackType = typeof FEEDBACK_TYPES[number];
export type FeedbackStatus = (typeof SupportTicketStatus)[keyof typeof SupportTicketStatus];

export class FeedbackEntity extends Model {
    declare id: string;
    declare userId: string | null;
    declare guestName: string | null;
    declare guestPhone: string | null;
    declare type: FeedbackType;
    declare body: string;
    declare status: FeedbackStatus;
    declare adminReply: string | null;
    declare repliedBy: string | null;
    declare repliedAt: Date | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

FeedbackEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        guestName: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        guestPhone: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        type: {
            type: DataTypes.ENUM(...FEEDBACK_TYPES),
            allowNull: false,
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM(...Object.values(SupportTicketStatus)),
            allowNull: false,
            defaultValue: SupportTicketStatus.OPEN,
        },
        adminReply: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        repliedBy: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        repliedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'Feedback',
        tableName: 'feedback',
        timestamps: true,
        indexes: [
            { fields: ['userId'] },
            { fields: ['status'] },
            { fields: ['type'] },
            { fields: ['createdAt'] },
        ],
    }
);

FeedbackEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'SET NULL' });
UserEntity.hasMany(FeedbackEntity, { foreignKey: 'userId', as: 'feedback', onDelete: 'SET NULL', hooks: true });
