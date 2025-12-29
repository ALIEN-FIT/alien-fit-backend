import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';

export class SubscriptionCurrencyEntity extends Model {
    declare code: string;
    declare isActive: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SubscriptionCurrencyEntity.init(
    {
        code: {
            type: DataTypes.STRING(10),
            primaryKey: true,
            allowNull: false,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    },
    {
        sequelize,
        modelName: 'SubscriptionCurrency',
        tableName: 'subscription_currencies',
        timestamps: true,
        indexes: [{ fields: ['isActive'] }],
    }
);
