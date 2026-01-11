import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';

export type SubscriptionType = 'diet' | 'training' | 'both';
export type SubscriptionPackagePrices = Record<string, number>;
export type SubscriptionPackageTypedPrices = Record<SubscriptionType, SubscriptionPackagePrices>;

export class SubscriptionPackageEntity extends Model {
    declare id: string;
    declare name: string;
    declare description: string | null;
    declare prices: SubscriptionPackageTypedPrices;
    declare features: string[];
    declare cycles: number;
    declare isActive: boolean;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SubscriptionPackageEntity.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(120),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        prices: {
            // Per subscription type. Example: { diet: {"EGP": 299}, training: {"EGP": 299}, both: {"EGP": 399} }
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: {},
        },
        features: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        cycles: {
            // Number of 30-day cycles (1 cycle = 30 days)
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    },
    {
        sequelize,
        modelName: 'SubscriptionPackage',
        tableName: 'subscription_packages',
        timestamps: true,
        indexes: [
            { fields: ['isActive'] },
            { fields: ['name'] },
        ],
    }
);
