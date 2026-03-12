import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';

export type SubscriptionFreezeRequestStatus = 'pending' | 'approved' | 'declined';

export class SubscriptionFreezeRequestEntity extends Model {
    declare id: string;
    declare userId: string;
    declare status: SubscriptionFreezeRequestStatus;
    declare requestedDays: number;
    declare requestedNote: string | null;
    declare approvedDays: number | null;
    declare decisionNote: string | null;
    declare resolvedBy: string | null;
    declare resolvedAt: Date | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SubscriptionFreezeRequestEntity.init(
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
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'declined'),
            allowNull: false,
            defaultValue: 'pending',
        },
        requestedDays: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        requestedNote: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        approvedDays: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        decisionNote: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        resolvedBy: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        resolvedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'SubscriptionFreezeRequest',
        tableName: 'subscription_freeze_requests',
        timestamps: true,
        indexes: [
            { fields: ['userId'] },
            { fields: ['status'] },
            { fields: ['createdAt'] },
        ],
    }
);

SubscriptionFreezeRequestEntity.belongsTo(UserEntity, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
});

UserEntity.hasMany(SubscriptionFreezeRequestEntity, {
    foreignKey: 'userId',
    as: 'subscriptionFreezeRequests',
    onDelete: 'CASCADE',
    hooks: true,
});
