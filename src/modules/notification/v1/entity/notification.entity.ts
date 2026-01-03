import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { NotificationType, NOTIFICATION_TYPES } from '../../../../constants/notification-type.js';

export class NotificationEntity extends Model {
    declare id: string;
    declare userId: string;
    declare byUserId: string | null;

    declare type: NotificationType;
    declare title: string;
    declare body: string;

    declare isSeen: boolean;
    declare isRead: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

NotificationEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        byUserId: {
            type: DataTypes.UUID,
            allowNull: true,
            defaultValue: null,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [NOTIFICATION_TYPES],
            },
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        body: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        isSeen: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: 'Notification',
        tableName: 'notifications',
        timestamps: true,
        indexes: [
            { fields: ['userId', 'createdAt'] },
            { fields: ['userId', 'isRead'] },
            { fields: ['userId', 'isSeen'] },
        ],
    }
);

NotificationEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
UserEntity.hasMany(NotificationEntity, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE', hooks: true });

NotificationEntity.belongsTo(UserEntity, { foreignKey: 'byUserId', as: 'byUser', onDelete: 'SET NULL' });
UserEntity.hasMany(NotificationEntity, { foreignKey: 'byUserId', as: 'sentNotifications', onDelete: 'SET NULL', hooks: true });
