import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';

export class SubscriptionEntity extends Model {
    declare id: string;
    declare userId: string;
    declare isSubscribed: boolean;
    declare startDate: Date | null;
    declare endDate: Date | null;
    declare lastProfileUpdateAt: Date | null;
    declare nextProfileUpdateDue: Date | null;
    declare isActive: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SubscriptionEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
        },
        isSubscribed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        startDate: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        endDate: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        lastProfileUpdateAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        nextProfileUpdateDue: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
        modelName: 'Subscription',
        tableName: 'subscriptions',
        timestamps: true,
        indexes: [
            {
                fields: ['userId'],
                unique: true,
            },
            {
                fields: ['isActive'],
            },
        ],
    }
);

UserEntity.hasOne(SubscriptionEntity, { foreignKey: 'userId', as: 'subscription', onDelete: 'CASCADE', hooks: true });
SubscriptionEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
