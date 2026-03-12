import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';

export type SubscriptionDefrostRequestStatus = 'pending' | 'approved' | 'declined';

export class SubscriptionDefrostRequestEntity extends Model {
    declare id: string;
    declare userId: string;
    declare status: SubscriptionDefrostRequestStatus;
    declare requestedNote: string | null;
    declare decisionNote: string | null;
    declare resolvedBy: string | null;
    declare resolvedAt: Date | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SubscriptionDefrostRequestEntity.init(
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
        requestedNote: {
            type: DataTypes.TEXT,
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
        modelName: 'SubscriptionDefrostRequest',
        tableName: 'subscription_defrost_requests',
        timestamps: true,
        indexes: [
            { fields: ['userId'] },
            { fields: ['status'] },
            { fields: ['createdAt'] },
        ],
    }
);

SubscriptionDefrostRequestEntity.belongsTo(UserEntity, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'CASCADE',
});

UserEntity.hasMany(SubscriptionDefrostRequestEntity, {
    foreignKey: 'userId',
    as: 'subscriptionDefrostRequests',
    onDelete: 'CASCADE',
    hooks: true,
});
