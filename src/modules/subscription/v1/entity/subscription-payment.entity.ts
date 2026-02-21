import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../../../database/db-config.js';
import { UserEntity } from '../../../user/v1/entity/user.entity.js';
import { SubscriptionPlanType } from '../../../subscription-packages/v1/subscription-plan-type.js';

export type SubscriptionPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export class SubscriptionPaymentEntity extends Model {
    declare id: string;
    declare userId: string;
    declare packageId: string;
    declare planType: SubscriptionPlanType;

    declare provider: 'fawaterak';
    declare status: SubscriptionPaymentStatus;

    declare currency: string;
    declare amount: number;

    // Fawaterak identifiers
    declare invoiceId: number | null;
    declare invoiceKey: string | null;
    declare paymentUrl: string | null;

    // Last webhook payload we processed (debug/audit)
    declare webhookPayload: unknown | null;

    declare paidAt: Date | null;

    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

SubscriptionPaymentEntity.init(
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
        packageId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        planType: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'both',
        },
        provider: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'fawaterak',
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'pending',
        },
        currency: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        amount: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        invoiceId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        invoiceKey: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        paymentUrl: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        webhookPayload: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        paidAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'SubscriptionPayment',
        tableName: 'subscription_payments',
        timestamps: true,
        indexes: [
            { fields: ['userId'] },
            { fields: ['packageId'] },
            { fields: ['planType'] },
            { fields: ['status'] },
            { fields: ['invoiceId'], unique: true },
            { fields: ['invoiceKey'], unique: true },
        ],
    }
);

UserEntity.hasMany(SubscriptionPaymentEntity, { foreignKey: 'userId', as: 'subscriptionPayments', onDelete: 'CASCADE', hooks: true });
SubscriptionPaymentEntity.belongsTo(UserEntity, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
